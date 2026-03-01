# Project Architecture: Flowstate Hub

Flowstate is a hybrid, sovereign productivity hub that bridges Google Workspace (online) and local AI (offline) to automate research and triage tasks.

## System Overview

The project follows a decoupled architecture with a React-based frontend and a Python-based FastAPI backend. It integrates local LLMs (via Ollama) and Google Workspace APIs for a unified productivity experience.

```mermaid
graph TD
    User([User]) <--> Frontend[React Frontend]
    Frontend <--> Backend[FastAPI Backend]
    Frontend <--> GoogleGenAI[Google GenAI SDK]
    Backend <--> Ollama[Local Ollama]
    Backend <--> GoogleAPI[Google Workspace APIs]
    Backend <--> FileSystem[(Local Persistence)]
```

---

## Architecture Breakdown

### 1. Frontend (React + Vite + TypeScript)
The frontend is a modern, responsive web application built with React. It features a widget-based UI and a persistent chat interface.

- **Framework**: React 19 with Vite for build tooling.
- **State Management**: React Hooks (useState, useEffect) are used for local component state.
- **Key Components**:
    - `App.tsx`: Main application shell and layout.
    - `ChatArea.tsx`: Core interaction hub for chat and widget orchestration.
    - `Sidebar.tsx`: Navigation and global controls.
    - `DraggableWidgetWrapper.tsx`: Enables free-form layout of widgets.
- **Widgets**:
    - `CalendarWidget`: Displays and manages Google Calendar events.
    - `EmailWidget`: Provides a triage view for Gmail.
    - `NotesWidget`: Local note-taking functionality.
    - `DriveWidget`: Integration with Google Drive.
    - `ClockWidget`, `StockWidget`: Utility widgets.
- **Services**:
    - `agentService.ts`: Orchestrates communication between frontend, backend, and Google GenAI.
    - **Search Grounding**: Utilizes `@google/genai` (Gemini) directly in the frontend for client-side search grounding.

### 2. Backend (FastAPI + Python)
The backend acts as a secure intermediary for local AI operations and Google Workspace interactions.

- **Framework**: FastAPI.
- **Core Services**:
    - `main.py`: Entry point and API routing.
    - `agent_orchestrator.py`: **[NEW]** Modular orchestrator that manages "Agent Cards" for specialized tasks (following Google ADK patterns).
    - `auth_service.py`: Manages Google OAuth2 flow.
    - `classroom_service.py`: **[NEW]** Interaction layer for Google Classroom API.
- **Local AI Integration**:
    - Integrates with **Ollama** or **vLLM** via a hardware-agnostic LLM abstraction.
    - Supports **AMD Ryzen™ AI (NPU)**, **AMD Instinct GPUs (ROCm)**, **NVIDIA CUDA**, and **Intel (OpenVINO)**.
    - Default model: `llama3.2` (optimized for local performance).
- **Task Management**:
    - Implements an asynchronous task queue with persistence in `tasks.json`.
    - Features a background monitor thread that resumes queued tasks once internet connectivity is restored.
- **Sovereign Intelligence (ONNX)**:
    - **[NEW]** Uses **ONNX Runtime** for high-performance, low-power intent classification.
    - Specifically optimized for **AMD Ryzen™ AI** NPUs via the `Vitis™ AI` execution provider.
    - Handles critical logic (like internet requirement analysis) at the edge, reducing LLM calls.

### 3. AI & Integration Flow
Flowstate uses a "Hybrid, Cross-Platform AI" approach:
- **Local AI (Ollama/vLLM)**: Handles "sovereign" tasks like planning and data extraction. Optimized for AMD (ROCm), NVIDIA (CUDA), and Intel.
- **Cloud AI (Gemini)**: Handles search grounding and high-context web research client-side.
- **Orchestration**: The `AgentOrchestrator` decomposes user requests into tasks executed by specialized agent cards (Calendar, Gmail, Meet, Classroom).

### 4. Data Flow & Persistence
- **State**: The application state is synchronized between the frontend (React) and the backend (FastAPI).
- **Local Storage**:
    - `tasks.json`: Persistent queue of user requests and their execution status.
    - `settings.json`: Persistent user preferences.
    - `token.json`: Secure storage for Google OAuth2 tokens.
- **External Data**: Google Workspace data is fetched on-demand and cached minimally in-memory or summarized by the AI.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, Lucide React,Three.js, Tailwind CSS |
| **Backend** | Python 3.12+, FastAPI, Agent Orchestrator (Google ADK) |
| **AI (Hardware)** | **AMD Ryzen™ AI (NPU)**, **AMD ROCm**, **NVIDIA CUDA**, **Intel (OpenVINO)** |
| **AI (Serving)** | **Ollama**, **vLLM**, **ONNX Runtime** (Vitis™ AI) |
| **AI (Models)** | Llama 3.2 (Local), Gemini 2.0 Flash (Cloud Research), ONNX Intent Classifier |
| **APIs** | Gmail, Calendar, Drive, Meet, Classroom |
| **Tools** | chrono-node, react-markdown, remark-gfm |
