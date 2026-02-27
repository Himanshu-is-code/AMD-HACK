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
import gmail_service
import meet_service
from datetime import datetime  # Added missing import
import logging
from onnx_service import needs_internet

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

import os
# Allows auth to succeed even if Google grants fewer scopes than requested.
# Needed until Meet scopes are added to the GCP OAuth consent screen Data Access section.
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
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama") # or "openai-compatible" for vLLM
FAST_MODEL = os.getenv("FAST_MODEL", "llama3.2")
SMART_MODEL = os.getenv("SMART_MODEL", "llama3.2") 
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

def call_llm(prompt: str, model: str = FAST_MODEL, json_mode: bool = False):
    """
    Hardware-agnostic LLM call. Supports Ollama and vLLM (OpenAI-compatible).
    AMD Instinct GPUs often use vLLM, while local laptops use Ollama.
    """
    try:
        logging.info(f"Calling LLM ({LLM_PROVIDER}) with model: {model}")
        
        if LLM_PROVIDER == "ollama":
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
            }
            if json_mode:
                payload["format"] = "json"
            
            res = requests.post(
                f"{LLM_BASE_URL}/api/generate",
                json=payload,
                timeout=300  
            )
        else:
            # OpenAI / vLLM compatible check
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            
            res = requests.post(
                f"{LLM_BASE_URL}/v1/chat/completions",
                json=payload,
                timeout=300
            )

        if not res.ok:
            logging.error(f"LLM Error: {res.text}")
            return f"Error connecting to LLM: Status {res.status_code}, Response: {res.text}"
        
        data = res.json()
        if LLM_PROVIDER == "ollama":
            response_text = data.get("response", "")
        else:
            response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            
        logging.info("LLM Response received")
        return response_text
            
    except Exception as e:
        logging.error(f"LLM Exception: {str(e)}")
        return f"Error: Unexpected error calling LLM: {str(e)}"

# Alias call_ollama for backward compatibility during refactor
def call_ollama(prompt: str, model: str = FAST_MODEL, json_mode: bool = False):
    return call_llm(prompt, model, json_mode)


# Search service removed




def clean_email_body(body: str) -> str:
    """
    Removes quoted replies and forwarded message headers to extract the latest message.
    """
    lines = body.split('\n')
    cleaned_lines = []
    
    # Common separators for replies/forwards where we should STOP reading
    # 1. "On [Date], [Name] wrote:"
    # 2. "From: [Name] [Email] Sent: [Date]"
    # 3. "-----Original Message-----"
    # 4. "---------- Forwarded message ---------"
    # 5. Lines starting with > (quoted text)
    
    import re
    reply_indicators = [
        r'On\s+.*wrote:',
        r'From:\s+.*Sent:',
        r'-+\s*Original Message\s*-+',
        r'-+\s*Forwarded message\s*-+',
        r'________________________________'
    ]
    
    for line in lines:
        # Check if line indicates start of quoted history
        is_quote_start = False
        for indicator in reply_indicators:
            if re.search(indicator, line, re.IGNORECASE):
                is_quote_start = True
                break
        
        if is_quote_start:
            break # Stop processing at the first sign of history
            
        # Skip lines that are purely quoted (START with >)
        if line.strip().startswith('>'):
            continue
            
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines).strip()

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
        if client_time_str:
            current_time_context = client_time_str
            logging.info(f"Using Client Time: {current_time_context}")
        else:
            now = datetime.now().astimezone()
            current_time_context = now.strftime("%A, %Y-%m-%d %H:%M:%S %Z%z")
            logging.info(f"Using Server Time: {current_time_context}")
        
        prompt = f"""
        [INST] 
        You are a smart JSON extractor.
        
        Task: Extract event details from the user text into JSON format.
        Current Time: {current_time_context}
        
        Rules:
        1. "start_time": Must be ISO 8601 (YYYY-MM-DDTHH:MM:SS format).
        - If user says "tomorrow at 2pm", calculate the date based on Current Time.
        - If user says "today", use Current Date.
        2. "summary": Short event title.
        3. "duration_minutes": Default 30.
        4. OUPUT JSON ONLY. NO MARKDOWN. NO EXPLANATION.
        
        Example:
        User: "Lunch with Bob tomorrow at 1pm"
        (Assuming today is Monday 2023-10-09)
        {{
            "summary": "Lunch with Bob",
            "start_time": "2023-10-10T13:00:00",
            "duration_minutes": 60
        }}
        
        User Request: "{text}"
        
        Response:
        [/INST]
        """
        model_to_use = FAST_MODEL # Use fast model for better instruction following on simple tasks

    try:
        logging.info("--- Starting Extraction ---")
        response = call_ollama(prompt, model=model_to_use, json_mode=True)
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
                logging.warning(f"JSON Parse Error: {e}. Trying ast.literal_eval fallback.")
                try:
                    import ast
                    # Fallback for single quotes or loose JSON
                    data = ast.literal_eval(json_match.group(0))
                    if isinstance(data, dict):
                        logging.info(f"Successfully parsed via ast.literal_eval: {data}")
                        return data
                except Exception as ast_e:
                    logging.error(f"AST Parse failed: {ast_e}")
                
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

from agent_orchestrator import AgentOrchestrator

# Initialize ADK Orchestrator
orchestrator = AgentOrchestrator(llm_caller=call_llm)

def execute_task_logic(task_id: str, task_text: str, client_time: str = None, requires_internet: bool = True, extracted_time: str = None):
    """
    Executes the actual task logic via the AgentOrchestrator.
    Returns True if completed, False if paused due to network/error.
    """
    try:
        # Double check internet before starting heavy lifting
        if requires_internet and not check_internet():
             logging.warning(f"Task {task_id}: Internet lost before execution. Re-queueing.")
             update_task_status(task_id, "waiting_for_internet")
             return False

        update_task_status(task_id, "executing")
        
        # --- EXECUTION VIA ADK ORCHESTRATOR ---
        context = {
            "client_time": client_time,
            "extracted_time": extracted_time
        }
        
        result_update = orchestrator.plan_and_execute(task_id, task_text, context)
        
        # ---------------------------------------

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

@app.get("/gmail/unread")
def get_unread_emails(limit: int = 2):
    emails = gmail_service.fetch_recent_unread_emails(limit=limit)
    if emails is None:
        raise HTTPException(status_code=401, detail="Gmail access required")
    return emails

def analyze_internet_requirement(text: str) -> bool:
    """
    Analyzes if the request needs internet.
    Optimized: Uses ONNX performance path instead of calling LLM for simple classification.
    """
    try:
        res = needs_internet(text)
        logging.info(f"ONNX Internet Check for '{text}': {res}")
        return res
    except Exception as e:
        logging.error(f"ONNX Classification error, falling back: {e}")
        # Fallback to simple keywords
        internet_keywords = ["news", "weather", "latest", "stock", "price", "who is", "email", "gmail"]
        return any(kw in text.lower() for kw in internet_keywords)

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

# ---------------------------------------------------------------------------
# Google Meet endpoints
# ---------------------------------------------------------------------------

@app.post("/meet/spaces")
def create_meet_space():
    """Creates a new instant Google Meet space."""
    result = meet_service.create_meeting_space()
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/meet/conferences")
def list_meet_conferences(space_name: str = None):
    """
    Lists all conference records (completed meetings).
    Optional query param: ?space_name=spaces%2Fabc-xyz to filter by space.
    Use this to get a conferenceRecord name before fetching transcripts.
    """
    result = meet_service.list_conference_records(space_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/meet/spaces/{space_name:path}")
def get_meet_space(space_name: str):
    """
    Gets a meeting space by resource name.
    Example: GET /meet/spaces/spaces%2Fabc-xyz-def
    """
    result = meet_service.get_meeting_space(space_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/meet/conferences/{conference_record_name:path}/participants")
def get_meet_participants(conference_record_name: str):
    """
    Lists all participants in a conference record.
    Example: GET /meet/conferences/conferenceRecords%2Fabc123/participants
    """
    result = meet_service.list_participants(conference_record_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/meet/participants/{participant_name:path}/sessions")
def get_participant_sessions(participant_name: str):
    """
    Lists all sessions for a single participant.
    Example: GET /meet/participants/conferenceRecords%2Fabc123%2Fparticipants%2Fdef456/sessions
    """
    result = meet_service.list_participant_sessions(participant_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/meet/conferences/{conference_record_name:path}/transcripts")
def get_meet_transcripts(conference_record_name: str):
    """
    Gets all transcripts for a conference record.
    Example: GET /meet/conferences/conferenceRecords%2Fabc123/transcripts
    """
    result = meet_service.get_transcripts(conference_record_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/meet/transcripts/{transcript_name:path}/entries")
def get_meet_transcript_entries(transcript_name: str):
    """
    Gets all transcript entries (utterances) for a transcript.
    Example: GET /meet/transcripts/conferenceRecords%2Fabc123%2Ftranscripts%2Fghi789/entries
    """
    result = meet_service.get_transcript_entries(transcript_name)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
