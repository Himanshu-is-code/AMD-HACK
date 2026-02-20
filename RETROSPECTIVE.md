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

---

## Phase 3: Email & Calendar Debugging (Feb 16, 2026)

### Session Overview
This session focused on fixing regressions and improving the reliability of the local AI agent's interaction with Google Gmail and Calendar services.

### Problems Encountered & Solutions

#### 1. Calendar JSON Parsing Failures
- **Problem**: The local LLM (llama3.2) was occasionally "chatty," adding conversational filler (e.g., "Here is the JSON you requested:") around the JSON payload. This caused the standard `json.loads` to fail.
- **Fix**: 
    - Implemented a more robust parser using regex to isolate the JSON object.
    - Added a fallback to `ast.literal_eval` for slightly malformed JSON (like single quotes).
    - **Ultimate Solution**: Enabled Ollama's `format: json` mode to enforce strict JSON output.

#### 2. Invalid Email Search Fallback Queries
- **Problem**: When a specific search (e.g., `from:someone`) failed, the fallback logic sometimes produced invalid queries like `pending certificates from` (ending in an operator).
- **Fix**: Added query cleaning logic to strip trailing operator keywords before executing fallback searches.

#### 3. "Noisy" Email Summaries
- **Problem**: Long email threads were being passed to the LLM, causing it to summarize the *quoted history* (the user's own previous messages) instead of the latest reply.
- **Fix**: Developed `clean_email_body`, a utility that strips out quoted replies and forwarded headers, ensuring the agent only "sees" the latest message content.

#### 4. Direct Link Accessibility
- **Enhancement**: Added a direct `[Open in Gmail]` link to specific email search results to bridge the gap between AI summary and the actual inbox.

### Key Learnings
- **Strict Constraints**: For data extraction tasks, always use the model's native JSON mode if available to prevent instruction drift.
- **Data Hygiene**: Email data is inherently messy; filtering quoted text is essential for meaningful summaries in long threads.

### Files Modified
- `main.py`: Core logic for task execution, JSON mode, and email cleaning.
- `gmail_service.py`: Added logging and error handling.
- `calendar_service.py`: Added logging and error handling.
- `walkthrough.md`: Updated with new functionality details.

---

## Phase 4: UI Animation Polish & Interaction Refinement (Feb 20, 2026)

### 🚀 Key Achievements

#### 1. Fluid Widget Entrance & Exit
- **Problem**: Widgets appeared and disappeared instantly, making the UI feel "choppy."
- **Solution**:
    - **Spring Animations**: Implemented entrance and exit animations using `cubic-bezier` for a natural, snappy feel.
    - **Physical Origin**: Widgets now emerge from and return to the search bar (origin point calculation), creating a cohesive physical mental model of where widgets "live."

#### 2. The "Glide" Input Animation
- **Problem**: The chat input would jump or disappear when transitioning from the centered "search" view to the docked "chat" view.
- **Solution**:
    - **Pure Transform Interpolation**: Refactored the positioning logic to avoid switching between `top` and `bottom` CSS properties (which cannot be smoothly transition-interpolated).
    - **Vertical Anchoring**: The input bar is now permanently anchored at `bottom: 32px` and uses `translateY` to push it up to the center when the screen is empty. 
    - **Result**: A perfectly smooth "confirmation glide" when the first message is sent.

#### 3. Frontend Architecture Refinement
- **Optimization**: Cleaned up `ChatArea.tsx` by moving complex style logic into pre-render variables (`inputBarStyle`). 
- **Stability**: Fixed linting errors and structural glitches in the JSX that were introduced during rapid animation prototyping.

### 💡 Lessons Learned
- **CSS Transitions**: Never transition properties that can't be interpolated (like `top` → `bottom`). Always use `transform` (GPU accelerated) for smooth, jank-free motion.
- **Spatial Consistency**: Animating elements from a logical origin (like the search bar) significantly improves the user's spatial awareness of the interface.

### 📁 Files Modified
- `ChatArea.tsx`: Major refactor of input positioning and transition logic.
- `DraggableWidgetWrapper.tsx`: Added state-driven entrance/exit animations.
- `RETROSPECTIVE.md`: Documented Phase 4 progress.
