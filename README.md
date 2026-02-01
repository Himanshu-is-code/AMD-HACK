# offline-agent-hackathon

A hybrid local AI agent that dynamically routes tasks between a fast model (`llama3.2:1b`) and a smart model (`qwen3:4b`) for optimal performance on AMD hardware.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Ollama**: Installed and running locally.

## Setup

### 1. Configure Models
Ensure you have the required models pulled in Ollama:

```bash
ollama pull llama3.2:1b
ollama pull qwen3:4b
```

## Useful Ollama Commands

Use these commands to manage and verify your local models:

*   **List installed models**:
    ```bash
    ollama list
    ```
    *Check if `llama3.2:1b` and `qwen3:4b` are present.*

*   **Test a model interactively**:
    ```bash
    ollama run llama3.2:1b
    ```
    *Starts a chat session with the model. Type `/bye` to exit.*

*   **Check Ollama server status**:
    *   Open `http://localhost:11434` in your browser. You should see "Ollama is running".

### 2. Backend Setup
Navigate to the backend directory and install the required Python libraries:

```bash
cd agent-backend
pip install fastapi uvicorn requests pydantic google-generativeai
```

### 3. Frontend Setup
Navigate to the frontend directory and install dependencies:

```bash
cd Frontend
npm install
```

## Running the Project

### 1. Start Ollama
Make sure Ollama is running in the background.

### 2. Start Backend
In a terminal, run the FastAPI backend:

```bash
cd agent-backend
python main.py
```
*   Backend will run on: `http://localhost:8000`
*   Swagger UI: `http://localhost:8000/docs`

### 3. Start Frontend
In a separate terminal, start the Vite development server:

```bash
cd Frontend
npm run dev
```
*   Frontend will typically run on: `http://localhost:5173`

## Architecture

This agent uses **Pattern-Matching Model Routing**:
*   **Fast Model (`llama3.2:1b`)**: Handles simple queries, greetings, and short interactions (< 120 chars).
*   **Smart Model (`qwen3:4b`)**: Handles complex tasks like planning, workflows, analysis, or long requests.

The routing logic is handled securely in `agent-backend/main.py`.
