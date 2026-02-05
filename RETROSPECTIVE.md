# Project Retrospective

## Phase 1: Calendar Integration & Core Agent

### 🚀 Key Features
- **Secure Authentication**: Implemented Google OAuth2 flow with granular permissions (Read/Write Calendar).
- **Natural Language Scheduling**: Users can type "Schedule a meeting tomorrow at 2pm" and the system understands it.
- **End-to-End Automation**: The Agent autonomously plans, creates the event on Google Calendar, and returns a direct link.
- **Client-Side Time Sync**: Uses the browser's exact time to ensure scheduled events match the user's local timezone.

### 🔧 Challenges & Solutions

#### 1. The "Silent Failure" (Execution Hangs)
- **Problem**: The Agent would get stuck on "Planned" or "Executing" forever without error messages.
- **Root Cause**: Missing imports and type mismatches in the background thread caused silent crashes.
- **Solution**: Added `debug.log` tracing and fixed `background_task_simulation` signature to properly accept `client_time`.

#### 2. The "Coder" AI (LLM Hallucinations)
- **Problem**: Llama 3.2 tried to write Python code to calculate dates instead of returning JSON.
- **Solution**: Updated System Prompt with strict `[INST]` instructions: *"You are a precise JSON extractor. You do NOT write code."*

#### 3. The "Time Travel" Bug (Timezone Offsets)
- **Problem**: A request for 2pm resulted in an event at 7:30pm (or 4pm).
- **Root Cause**: Backend calculated UTC while Google Calendar expected Local Time.
- **Solution**: Refactored Frontend to send `new Date().toString()` (Browser Client Time) to the backend, making the User's Browser the source of truth.

#### 4. The "Tomorrow is Today" Bug
- **Problem**: The AI scheduled "Tomorrow's" meeting for "Today".
- **Root Cause**: The LLM lacked an internal clock and context for "Today".
- **Solution**: Injected explicit context: *"Current Date: Wednesday, 2026-02-04"*.

#### 5. The "Strict Librarian" Bug (Keyword Rigidity)
- **Problem**: Typos like "calender" were ignored.
- **Solution**: Expanded keyword detection to be fuzzy and inclusive: `["calendar", "calender", "schedule", "mark", "remind"]`.

### 🤖 AI Model Strategy
We consolidated to a **Single Model Architecture (Llama 3.2 3B)**.
- **Why?**: It acts as both the "Fast" planner and "Smart" extractor, reducing RAM usage (<2GB) while maintaining <3s latency.

### 🧠 Technical Stack
- **Frontend**: React + `agentService.ts` (Fetch API)
- **Backend**: FastAPI + `google-auth-oauthlib`
- **AI Engine**: Local Ollama (Llama 3.2)
- **Data**: Local `tasks.json` and `debug.log`

---

## Phase 2: Offline Handling, Search Flexibility, & Privacy (Feb 05, 2026)

### 🚀 Key Achievements

#### 1. Queue-Based Offline Architecture
- **Problem**: Tasks failed or blocked when internet was lost.
- **Solution**: Implemented a "Queue & Resume" system.
    - `check_internet()` prevents crashes.
    - Offline tasks enter `waiting_for_internet`.
    - **Monitor Thread** polls connectivity and auto-resumes tasks.
    - **Fix**: Added `threading.Lock` to `tasks.json` to prevent race conditions.

#### 2. "Search with Gemini" Flexibility
- **Problem**: The search button was hidden for "completed" tasks (e.g., getting news).
- **Solution**: Decoupled button from task status.
    - Now appears if AI mentions keywords ("news", "weather", "stock").
    - Works even if the task is marked `completed`.

#### 3. Date & Scheduling Intelligence
- **Problem**: "Schedule dinner" defaulted to tomorrow; users needed to verify dates.
- **Solution**:
    - Prompt Rule: *"Assume TODAY unless explicitly told otherwise."*
    - Context: Injected `Current Date` into every Gemini search.
    - **Concise Output**: Search button now returns *only* the confirmed Date/Time for scheduling queries.

#### 4. Privacy Audit
- **Audit Result**: **Confirmed Private**.
    - **Local**: `main.py` uses local `Ollama` for planning and extraction.
    - **Direct**: `calendar_service` talks directly to Google Calendar.
    - **Public**: `GoogleGenAI` (Gemini) is *only* touched when the "Search with Gemini" button is manually clicked.

### 💡 Lessons Learned
- **AI Laziness**: Local models need strict overrides (e.g., keyword checks) to force them to admit they need external tools.
- **Concurrency**: Background threads + API polling = Data Corruption. File locking is non-negotiable.
- **Trust**: Explaining the data flow (Local vs. Public) is critical for user confidence.
