from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import auth_service # Import the new service
import threading
import time
import requests
import json
import os
from typing import List, Optional
import uuid
import settings_service
import calendar_service
from datetime import datetime  # Added missing import
import logging

# Setup logging
# Setup logging
# Setup logging
logging.basicConfig(
    filename='debug.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    force=True
)

class SettingUpdate(BaseModel):
    key: str
    value: bool

app = FastAPI()

# Allow relaxing scope for dev (fixes "Scope has changed" error)
import os
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class UserInput(BaseModel):
    text: str
    client_time: Optional[str] = None # Capture client-side time string

import google.generativeai as genai
from fastapi.encoders import jsonable_encoder

# Configuration
FAST_MODEL = "llama3.2"
SMART_MODEL = "llama3.2" 
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
        logging.info(f"Calling Ollama with model: {model}")
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
        logging.info(f"Ollama Status: {res.status_code}")
        
        if not res.ok:
            logging.error(f"Ollama Error: {res.text}")
            return f"Error connecting to Ollama: Status {res.status_code}, Response: {res.text}"
        
        try:
            data = res.json()
            response_text = data.get("response", "Error: No response key in Ollama output")
            logging.info("Ollama Response received")
            return response_text
        except json.JSONDecodeError:
            logging.error("Failed to parse Ollama response")
            return "Error: Failed to parse Ollama response"
            
    except Exception as e:
        logging.error(f"Ollama Exception: {str(e)}")
        return f"Error: Unexpected error calling Ollama: {str(e)}"


# Search service removed




def extract_event_details(text: str, client_time_str: str = None):
    """Uses Ollama to extract structured event data from text."""
    
    if client_time_str:
        # Use provided client time directly (rich format expected from JS: "Wed Feb 04 2026 ...")
        current_time_context = client_time_str
        logging.info(f"Using Client Time: {current_time_context}")
    else:
        # Fallback to Server Time
        now = datetime.now().astimezone()
        current_time_str = now.strftime("%Y-%m-%d %H:%M:%S %Z%z")
        current_day = now.strftime("%A")
        current_time_context = f"{current_day}, {current_time_str}"
        logging.info(f"Using Server Time: {current_time_context}")
    
    prompt = f"""
    [INST] 
    You are a precise JSON extractor. You do NOT write code. You do NOT explain.
    
    Task: Extract event details from the user text.
    User's Current Time: {current_time_context}
    
    Rules:
    - "summary": Short title of the event.
    - "start_time": Calculate exact ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SS+HH:MM). Convert 12h to 24h (e.g. 2pm -> 14:00).
    - If "tomorrow" is mentioned, add 1 day to Current Date.
    - "duration_minutes": Default 30.
    
    Example 1:
    Current Date: Tuesday, 2024-01-02
    User: "Meeting tomorrow at 2pm"
    Output: {{ "summary": "Meeting", "start_time": "2024-01-03T14:00:00+05:30", "duration_minutes": 30 }}

    Example 2:
    Current Date: Friday, 2024-01-05
    User: "Lunch at 12:30"
    Output: {{ "summary": "Lunch", "start_time": "2024-01-05T12:30:00+05:30", "duration_minutes": 30 }}
    
    User Request: "{text}"
    
    Response (JSON ONLY):
    [/INST]
    """
    try:
        logging.info("--- Starting Extraction ---")
        response = call_ollama(prompt, model=SMART_MODEL) 
        logging.info(f"Ollama Raw Response: {response}")
        
        # Clean response (remove markdown code blocks)
        cleaned_response = response.replace("```json", "").replace("```python", "").replace("```", "").strip()
        
        # Try finding JSON object
        import re
        json_match = re.search(r'\{.*\}', cleaned_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                logging.info(f"Successfully parsed JSON: {data}")
                return data
            except json.JSONDecodeError as e:
                logging.error(f"JSON Parse Error: {e}")
                return None
        
        logging.warning("No JSON found in response")
        return None
    except Exception as e:
        print(f"Extraction Error: {e}")
        return None

def background_task_simulation(task_id: str, requires_internet: bool, task_text: str, client_time: str = None):
    """Simulates a task progressing through states, executing actions if needed."""
    # Simulate thinking/planning time
    time.sleep(2)
    
    update_task_status(task_id, "waiting_for_internet")
    
    if requires_internet:
        print(f"Task {task_id} paused for internet")
        return # PAUSE EXECUTION HERE
        
    time.sleep(2)
    update_task_status(task_id, "executing")
    
    # --- REAL ACTION EXECUTION ---
    result_update = ""
    triggers = ["calendar", "calender", "schedule", "meeting", "appointment", "event", "remind", "mark"]
    if any(valid_trigger in task_text.lower() for valid_trigger in triggers):
        logging.info(f"Executing Calendar Action for task {task_id}")
        
        # 1. Extract Details
        details = extract_event_details(task_text, client_time_str=client_time)
        logging.info(f"Extracted details: {details}")
        
        if details:
            # 2. Create Event
            cal_result = calendar_service.create_event(
                summary=details.get("summary", "New Event"),
                start_time_iso=details.get("start_time"),
                duration_minutes=details.get("duration_minutes", 30)
            )
            logging.info(f"Calendar Result: {cal_result}")
            
            if "link" in cal_result:
                 result_update = f"\n\n✅ Event Created: **{details.get('summary')}**\n[View on Google Calendar]({cal_result['link']})"
            else:
                 result_update = f"\n\n❌ Event Creation Failed: {cal_result.get('error')}"
        else:
             result_update = "\n\n❌ Could not understand event details."
             
    # -----------------------------

    time.sleep(3)
    
    # Update the task with the result
    tasks = load_tasks()
    if task_id in tasks:
        tasks[task_id]["plan"] += result_update
        save_tasks(tasks)

    update_task_status(task_id, "completed")

def choose_model(text: str) -> str:
    # Rule-based routing
    if len(text) > 120:
        return SMART_MODEL
    
    keywords = ["plan", "workflow", "steps", "analyze", "after that", "then"]
    if any(k in text.lower() for k in keywords):
        return SMART_MODEL
        
    return FAST_MODEL

class AuthCode(BaseModel):
    code: str

@app.post("/auth/google")
def google_auth(auth_data: AuthCode):
    try:
        return auth_service.exchange_code_for_token(auth_data.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/auth/status")
def auth_status():
    return {"connected": auth_service.is_connected()}

@app.get("/auth/user")
def get_user():
    info = auth_service.get_user_info()
    if not info:
        raise HTTPException(status_code=401, detail="Not connected")
    return info

@app.post("/auth/logout")
def logout():
    auth_service.revoke_credentials()
    return {"status": "logged_out"}

@app.get("/settings")
def get_settings():
    return settings_service.load_settings()

@app.post("/settings")
def update_settings(update: SettingUpdate):
    return settings_service.update_setting(update.key, update.value)

@app.post("/test/calendar")
def test_calendar():
    return calendar_service.create_test_event()

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

    # Start background task simulation
    background_tasks.add_task(
        background_task_simulation, 
        new_task["id"], 
        requires_internet, 
        input.text,
        input.client_time # Pass the client time
    )

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
