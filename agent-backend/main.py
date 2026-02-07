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
    extracted_time: Optional[str] = None # Captured by frontend (chrono-node)

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
    extracted_time: Optional[str] = None # Store for execution

class ResumeRequest(BaseModel):
    api_key: str

# File Lock
file_lock = threading.Lock()

def load_tasks() -> List[dict]:
    with file_lock:
        if not os.path.exists(TASKS_FILE):
            return []
        try:
            with open(TASKS_FILE, "r") as f:
                return json.load(f)
        except:
            return []

def save_task(task: dict):
    with file_lock:
        # We need to re-read inside the lock to ensure we have latest state
        if not os.path.exists(TASKS_FILE):
             tasks = []
        else:
             try:
                with open(TASKS_FILE, "r") as f:
                    tasks = json.load(f)
             except:
                tasks = []

        # Check if task already exists and update it
        existing_index = next((index for (index, d) in enumerate(tasks) if d["id"] == task["id"]), None)
        if existing_index is not None:
            tasks[existing_index] = task
        else:
            tasks.append(task)
            
        with open(TASKS_FILE, "w") as f:
            json.dump(tasks, f, indent=2)

def update_task_status(task_id: str, status: str, plan_update: str = None):
    # This function combines load/save, so we need the lock to generate the full sequence
    # However, save_task already takes lock. To avoid deadlock (if we used recursive lock) or complexity,
    # let's just implement the logic here directly or ensure save_task logic is safe.
    # Actually, best to just use the lock here and call a helper that doesn't lock? 
    # Or simply:
    with file_lock:
        if not os.path.exists(TASKS_FILE):
            return
        
        try:
             with open(TASKS_FILE, "r") as f:
                tasks = json.load(f)
        except:
             return

        for task in tasks:
            if task["id"] == task_id:
                task["status"] = status
                if plan_update:
                    task["plan"] = plan_update
                
                # Save immediately
                with open(TASKS_FILE, "w") as f:
                    json.dump(tasks, f, indent=2)
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




def extract_event_details(text: str, client_time_str: str = None, extracted_time_override: str = None):
    """Uses Ollama to extract structured event data from text."""
    
    # 1. Frontend Override (Highest Priority)
    # If the frontend deterministic parser found a date, we TRUST it.
    # We only ask the LLM to extract the Summary (Title).
    if extracted_time_override:
        logging.info(f"Using Frontend Extracted Time: {extracted_time_override}")
        prompt = f"""
        [INST]
        You are a JSON extractor.
        
        Task: Extract the "summary" (Event Title) from the text.
        
        Input: "{text}"
        Locked Start Time: "{extracted_time_override}"
        
        Output JSON:
        {{
            "summary": "Short event title",
            "start_time": "{extracted_time_override}",
            "duration_minutes": 30
        }}
        
        Response (JSON ONLY):
        [/INST]
        """
        model_to_use = FAST_MODEL # Use fast model since logic is simple now
    else: 
        # ... Fallback to full LLM extraction (Old Logic) ...
        if client_time_str:
            current_time_context = client_time_str
            logging.info(f"Using Client Time: {current_time_context}")
        else:
            now = datetime.now().astimezone()
            current_time_str = now.strftime("%Y-%m-%d %H:%M:%S %Z%z")
            current_day = now.strftime("%A")
            current_time_context = f"{current_day}, {current_time_str}"
            logging.info(f"Using Server Time: {current_time_context}")
        
        prompt = f"""
        [INST] 
        You are a precise JSON extractor. You do NOT write code. Do not explain.
        
        Task: Extract event details from the user text.
        User's Current Time: {current_time_context}
        
        Rules for Date Selection (Follow Hierarchy):
        1. **Explicit Keyword "Today"**: You MUST use the "Current Date" ({current_time_context.split(',')[1].strip().split(' ')[0] if ',' in current_time_context else 'TODAY'}). DO NOT shift to tomorrow, even if the time is in the past.
        2. **Explicit Keyword "Tomorrow"**: Add 1 day to "Current Date".
        3. **No Date Specified**: Assume "Today".
        4. **Time Logic**: Only shift to tomorrow if the user literally says "tomorrow" or a specific future date.
        
        Task Rules:
        - "summary": Short title.
        - "start_time": Exact ISO 8601 (YYYY-MM-DDTHH:MM:SS+HH:MM). Use User's Year/Month/Day.
        - "duration_minutes": Default 30.
        
        User Request: "{text}"
        
        Response (JSON ONLY):
        [/INST]
        """
        model_to_use = SMART_MODEL

    try:
        logging.info("--- Starting Extraction ---")
        response = call_ollama(prompt, model=model_to_use) 
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

def check_internet():
    """Checks for internet connectivity by attempting to connect to 8.8.8.8."""
    try:
        import socket
        # Connect to Google DNS
        socket.create_connection(("8.8.8.8", 53), timeout=3)
        return True
    except OSError:
        return False

def execute_task_logic(task_id: str, task_text: str, client_time: str = None, requires_internet: bool = True, extracted_time: str = None):
    """
    Executes the actual task logic (Calendar API, etc.).
    Returns True if completed, False if paused due to network/error.
    """
    try:
        # Double check internet before starting heavy lifting
        if requires_internet and not check_internet():
             logging.warning(f"Task {task_id}: Internet lost before execution. Re-queueing.")
             update_task_status(task_id, "waiting_for_internet")
             return False

        update_task_status(task_id, "executing")
        
        # --- REAL ACTION EXECUTION ---
        result_update = ""
        triggers = ["calendar", "calender", "schedule", "meeting", "appointment", "event", "remind", "mark"]
        if any(valid_trigger in task_text.lower() for valid_trigger in triggers):
            logging.info(f"Executing Calendar Action for task {task_id}")
            
            # 1. Extract Details
            # Pass extracted_time to override LLM date logic
            details = extract_event_details(task_text, client_time_str=client_time, extracted_time_override=extracted_time)
            logging.info(f"Extracted details: {details}")
            
            if details:
                # 2. Create Event
                # Calendar creation definitely needs internet
                # We do a Just-In-Time check here even if requires_internet was False (though logically it should be True for calendar)
                
                # If the task originally claimed it didn't need internet but now we know it does (calendar), we check again.
                if not check_internet(): 
                     logging.warning(f"Task {task_id}: Needs internet for Calendar API. Re-queueing.")
                     # Make sure to update the task to require internet for next time
                     tasks = load_tasks()
                     idx = next((i for i, t in enumerate(tasks) if t["id"] == task_id), None)
                     if idx is not None:
                         tasks[idx]["requires_internet"] = True
                         tasks[idx]["status"] = "waiting_for_internet"
                         save_task(tasks[idx])
                     else:
                        update_task_status(task_id, "waiting_for_internet")
                     return False

                cal_result = calendar_service.create_event(
                    summary=details.get("summary", "New Event"),
                    start_time_iso=details.get("start_time"),
                    duration_minutes=details.get("duration_minutes", 30)
                )
                
                # Check for network-related errors in the result
                error_msg = str(cal_result.get("error", "")).lower()
                network_keywords = [
                    "network", "socket", "connection", "timeout", 
                    "unable to find the server", "getaddrinfo", "client_connector_error", 
                    "server disconnected"
                ]
                
                if "error" in cal_result and any(k in error_msg for k in network_keywords):
                        logging.warning(f"Task {task_id}: Network error ({cal_result['error']}). Re-queueing.")
                        update_task_status(task_id, "waiting_for_internet")
                        return False # Exit, do not complete
                
                # Success or non-retriable error
                logging.info(f"Calendar Result: {cal_result}")
                
                if "link" in cal_result:
                        result_update = f"\n\n✅ Event Created: **{details.get('summary')}**\n[View on Google Calendar]({cal_result['link']})"
                else:
                        result_update = f"\n\n❌ Event Creation Failed: {cal_result.get('error')}"
            else:
                result_update = "\n\n❌ Could not understand event details."
                
        # -----------------------------

        # Update the task with the result
        tasks = load_tasks()
        existing_index = next((index for (index, d) in enumerate(tasks) if d["id"] == task_id), None)
        if existing_index is not None:
            tasks[existing_index]["plan"] += result_update
            save_task(tasks[existing_index])

        update_task_status(task_id, "completed")
        return True

    except Exception as e:
        logging.error(f"Critical error executing task {task_id}: {e}")
        # Optionally set to 'error' state, but for now just leave it or set complete with error
        return False

def background_task_simulation(task_id: str, requires_internet: bool, task_text: str, client_time: str = None, extracted_time: str = None):
    """Initial entry point for new tasks."""
    # Simulate thinking/planning time
    time.sleep(2)
    
    if requires_internet and not check_internet():
        logging.info(f"Task {task_id}: Offline. Queueing.")
        update_task_status(task_id, "waiting_for_internet")
        return # EXIT. Monitor will pick it up later.
        
    # If we have internet (or don't need it), run immediately
    execute_task_logic(task_id, task_text, client_time, requires_internet, extracted_time)

def monitor_internet_queue():
    """Global thread that checks for internet and resumes queued tasks."""
    logging.info("Starting Internet Monitor Thread")
    while True:
        try:
            time.sleep(10) # Check every 10 seconds
            
            if check_internet():
                tasks = load_tasks()
                queued_tasks = [t for t in tasks if t.get("status") == "waiting_for_internet"]
                
                if queued_tasks:
                    logging.info(f"Monitor: Found {len(queued_tasks)} queued tasks. Resuming...")
                    for task in queued_tasks:
                        # Spawn a thread so we don't block the monitor
                        # Pass requires_internet=True (or read from task) because if it was queued, it likely needs internet
                        # But safer to read from task if property exists
                        req_net = task.get("requires_internet", True)
                        
                        threading.Thread(
                            target=execute_task_logic, 
                            args=(task["id"], task["original_request"], None, req_net) 
                        ).start()
        except Exception as e:
            logging.error(f"Monitor Thread Error: {e}")

# Start the monitor thread
threading.Thread(target=monitor_internet_queue, daemon=True).start()

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

def analyze_internet_requirement(text: str) -> bool:
    """Uses LLM to decide if a request requires internet."""
    lowered = text.lower()
    
    # 1. STRICT OVERRIDE: Certain keywords ALWAYS mean internet.
    # Don't trust the AI to not overthink it.
    strict_keywords = ["news", "weather", "stock", "price of", "current event", "latest", "bse", "nse", "crypto", "bitcoin"]
    if any(k in lowered for k in strict_keywords):
        logging.info(f"Internet Check: Keyword '{next(k for k in strict_keywords if k in lowered)}' found. strict=True")
        return True

    try:
        # Improved prompt to be more aggressive about needing internet for info retrieval
        prompt = f"""
        [INST]
        You are a classifier that determines if a user request requires external tools/internet to be answered *accurately* and *fully*.
        
        Rules:
        1. If the user asks for "news", "weather", "stocks", "sports scores", or "current events", answer YES.
        2. If the user asks for specific facts that might be outdated in your training data, answer YES.
        3. If the user asks for a creative task (poem, email, code) that relies on internal knowledge, answer NO.
        4. If the user asks "how to" do something general (e.g. "how to tie a tie"), answer NO.
        5. If the user asks "what is the latest...", answer YES.

        Request: "{text}"
        
        Does this request require real-time internet access? Answer ONLY "YES" or "NO".
        [/INST]
        """
        # Use FAST_MODEL for speed
        response = call_ollama(prompt, model=FAST_MODEL)
        
        logging.info(f"Internet Check AI Response: {response}")
        
        # Check for YES
        if "YES" in response.upper():
            return True
        return False
    except Exception as e:
        logging.error(f"AI Internet Check failed: {e}")
        # Fallback to general keywords
        keywords = ["research", "search", "find", "who", "what", "where"]
        return any(k in lowered for k in keywords)

@app.post("/agent")
def agent(input: UserInput, background_tasks: BackgroundTasks):
    logging.info(f"Received Agent Request: {input.text} | Client Time: {input.client_time} | Extracted Time: {input.extracted_time}")
    
    # 0. Choose Model
    selected_model = choose_model(input.text)
    
    # 1. Generate plan with Ollama
    prompt = f"Break this request into steps. Keep it very brief and concise (under 100 words):\n{input.text}"
    plan_text = call_ollama(prompt, model=selected_model)
    
    # 2. Check for errors
    if "Error connecting" in plan_text:
         return {"plan": plan_text, "status": "error"}
    
    # 3. Check if internet is required (AI Classification)
    requires_internet = analyze_internet_requirement(input.text)
    logging.info(f"Task '{input.text}' requires internet: {requires_internet}")

    # 4. Create Task object
    new_task = {
        "id": str(uuid.uuid4()),
        "original_request": input.text,
        "plan": plan_text,
        "status": "planned",
        "requires_internet": requires_internet,
        "model_used": selected_model,
        "extracted_time": input.extracted_time
    }

    # 4. Save to disk
    save_task(new_task)

    # Start background task simulation
    background_tasks.add_task(
        background_task_simulation, 
        new_task["id"], 
        requires_internet, 
        input.text,
        input.client_time,
        input.extracted_time # Pass the extracted time
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
