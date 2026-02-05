# AMD Hack Agent

A local-first, privacy-focused AI agent with offline capabilities.

## Recent Updates (Feb 2026)

### 🚀 Offline Capability
- **Queue System**: Tasks created while offline are queued and automatically executed when internet connectivity is restored.
- **Resiliency**: Networking errors are caught and retried without crashing the application.

### 🔍 "Search with Gemini"
- **Context-Aware**: The search button appears intelligently when you discuss news, weather, or stocks.
- **Date Intelligence**: Search queries automatically include the current date and day for accurate results.
- **Privacy**: Search is only triggered manually. All other tasks (reminders, notes) run on your local device (Ollama).

### 🛡️ Privacy & Security
- **Local-First**: Calendar interactions, planning, and task execution happen locally.
- **No Data Leaks**: Google Gemini is only accessed for explicit web searches.

## Setup

1.  **Backend**:
    ```bash
    cd agent-backend
    python main.py
    ```
2.  **Frontend**:
    ```bash
    cd frontend
    npm run dev
    ```

For a detailed log of recent changes, see [RETROSPECTIVE.md](./RETROSPECTIVE.md).
