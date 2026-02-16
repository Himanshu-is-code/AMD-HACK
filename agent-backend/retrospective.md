# Project Retrospective: Email & Calendar Debugging

## Session Overview
This session focused on fixing regressions and improving the reliability of the local AI agent's interaction with Google Gmail and Calendar services.

## Problems Encountered & Solutions

### 1. Calendar JSON Parsing Failures
- **Problem**: The local LLM (llama3.2) was occasionally "chatty," adding conversational filler (e.g., "Here is the JSON you requested:") around the JSON payload. This caused the standard `json.loads` to fail.
- **Fix**: 
    - Implemented a more robust parser using regex to isolate the JSON object.
    - Added a fallback to `ast.literal_eval` for slightly malformed JSON (like single quotes).
    - **Ultimate Solution**: Enabled Ollama's `format: json` mode to enforce strict JSON output.

### 2. Invalid Email Search Fallback Queries
- **Problem**: When a specific search (e.g., `from:someone`) failed, the fallback logic sometimes produced invalid queries like `pending certificates from` (ending in an operator).
- **Fix**: Added query cleaning logic to strip trailing operator keywords before executing fallback searches.

### 3. "Noisy" Email Summaries
- **Problem**: Long email threads were being passed to the LLM, causing it to summarize the *quoted history* (the user's own previous messages) instead of the latest reply.
- **Fix**: Developed `clean_email_body`, a utility that strips out quoted replies and forwarded headers, ensuring the agent only "sees" the latest message content.

### 4. Direct Link Accessibility
- **Enhancement**: Added a direct `[Open in Gmail]` link to specific email search results to bridge the gap between AI summary and the actual inbox.

## Key Learnings
- **Strict Constraints**: For data extraction tasks, always use the model's native JSON mode if available to prevent instruction drift.
- **Data Hygiene**: Email data is inherently messy; filtering quoted text is essential for meaningful summaries in long threads.

## Files Modified
- `main.py`: Core logic for task execution, JSON mode, and email cleaning.
- `gmail_service.py`: Added logging and error handling.
- `calendar_service.py`: Added logging and error handling.
- `walkthrough.md`: Updated with new functionality details.
