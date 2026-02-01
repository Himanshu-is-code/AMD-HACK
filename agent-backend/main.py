from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import threading
import time
import requests
import json
import os
from typing import List, Optional
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserInput(BaseModel):
    text: str

import google.generativeai as genai
from fastapi.encoders import jsonable_encoder

# Configuration
FAST_MODEL = "llama3.2:1b"
SMART_MODEL = "qwen3:4b" 
TASKS_FILE = "tasks.json"

class Task(BaseModel):
    id: str
    original_request: str
    plan: str
    status: str # planned | waiting_for_internet | executing | completed
    requires_internet: bool = False
    model_used: str = FAST_MODEL
    sources: Optional[List[dict]] = []

class ResumeRequest(BaseModel):
    api_key: str

def load_tasks() -> List[dict]:
    if not os.path.exists(TASKS_FILE):
        return []
    try:
        with open(TASKS_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_task(task: dict):
    tasks = load_tasks()
    # Check if task already exists and update it
    existing_index = next((index for (index, d) in enumerate(tasks) if d["id"] == task["id"]), None)
    if existing_index is not None:
        tasks[existing_index] = task
    else:
        tasks.append(task)
        
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)

def update_task_status(task_id: str, status: str, plan_update: str = None):
    tasks = load_tasks()
    for task in tasks:
        if task["id"] == task_id:
            task["status"] = status
            if plan_update:
                task["plan"] = plan_update
            save_task(task)
            break

def call_ollama(prompt: str, model: str = FAST_MODEL):
    try:
        print(f"Calling Ollama with model: {model}")
        res = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
            },
            timeout=300  
        )
        print("Ollama Status:", res.status_code)
        
        if not res.ok:
            return f"Error connecting to Ollama: Status {res.status_code}, Response: {res.text}"
        
        try:
            data = res.json()
            return data.get("response", "Error: No response key in Ollama output")
        except json.JSONDecodeError:
            return "Error: Failed to parse Ollama response"
            
    except requests.exceptions.Timeout:
        return "Error: Ollama request timed out (300s)."
    except requests.exceptions.ConnectionError:
        return "Error: Could not connect to Ollama. Is it running on port 11434?"
    except Exception as e:
        return f"Error: Unexpected error calling Ollama: {str(e)}"


# Search service removed




def background_task_simulation(task_id: str, requires_internet: bool):
    """Simulates a task progressing through states"""
    # Simulate thinking/planning time
    time.sleep(2)
    
    update_task_status(task_id, "waiting_for_internet")
    
    if requires_internet:
        print(f"Task {task_id} paused for internet")
        return # PAUSE EXECUTION HERE
        
    time.sleep(2)
    update_task_status(task_id, "executing")
    time.sleep(3)
    update_task_status(task_id, "completed")

def choose_model(text: str) -> str:
    # Rule-based routing
    if len(text) > 120:
        return SMART_MODEL
    
    keywords = ["plan", "workflow", "steps", "analyze", "after that", "then"]
    if any(k in text.lower() for k in keywords):
        return SMART_MODEL
        
    return FAST_MODEL

@app.post("/agent")
def agent(input: UserInput, background_tasks: BackgroundTasks):
    # 0. Choose Model
    selected_model = choose_model(input.text)
    
    # 1. Generate plan with Ollama
    prompt = f"Break this request into steps. Keep it very brief and concise (under 100 words):\n{input.text}"
    plan_text = call_ollama(prompt, model=selected_model)
    
    # 2. Check for errors
    if "Error connecting" in plan_text:
         return {"plan": plan_text, "status": "error"}
    
    # Check if internet is required (simple keyword heuristic)
    keywords = ["research", "search", "find", "who", "what", "where", "weather", "stock", "price", "news"]
    requires_internet = any(k in input.text.lower() for k in keywords)

    # 3. Create Task object
    new_task = {
        "id": str(uuid.uuid4()),
        "original_request": input.text,
        "plan": plan_text,
        "status": "planned",
        "requires_internet": requires_internet,
        "model_used": selected_model
    }

    # 4. Save to disk
    save_task(new_task)

    # 5. Start background simulation
    background_tasks.add_task(background_task_simulation, new_task["id"], requires_internet)

    return new_task

@app.post("/tasks/{task_id}/resume")
def resume_task(task_id: str, req: ResumeRequest, background_tasks: BackgroundTasks):
    # This endpoint is kept for compatibility but effectively deprecated for search
    return {"status": "deprecated", "message": "Search is now handled client-side"}

class CompleteTaskRequest(BaseModel):
    plan_update: str
    sources: Optional[List[dict]] = []

@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str, req: CompleteTaskRequest):
    update_task_status(task_id, "completed", plan_update=req.plan_update)
    
    # Update sources if provided
    tasks = load_tasks()
    for task in tasks:
        if task["id"] == task_id:
            if req.sources:
                task["sources"] = req.sources
            save_task(task)
            break
            
    return {"status": "success"}

@app.get("/tasks")
def get_tasks():
    return load_tasks()

@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    tasks = load_tasks()
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
