# Setup Guide: Free & Cross-Platform AI

This guide will help you set up Flowstate Hub to run on your local hardware (**AMD**, **NVIDIA**, or **Intel**) for free.

## 1. Install Ollama (Recommended)
Ollama is the easiest way to run LLMs locally on any hardware (AMD, NVIDIA, Intel, or even just CPU).

1. **Download**: Visit [ollama.com](https://ollama.com) and download the installer for Windows.
2. **Install**: Run the installer and follow the prompts.
3. **Pull the Model**: Open your terminal (PowerShell) and run:
   ```powershell
   ollama pull llama3.2
   ```

## 2. Hardware Acceleration Setup

### For AMD (ROCm)
- **Windows**: Use the latest AMD Software (Adrenalin Edition). Ollama on Windows supports some AMD GPUs natively.
- **Linux/WSL2**: Install the ROCm drivers for maximum performance.

### For NVIDIA (CUDA)
- Ensure you have the latest NVIDIA drivers installed. Ollama will automatically use your GPU if it detects CUDA.

### For Intel (OpenVINO/CPU)
- Ollama will default to high-performance CPU inference. For Intel GPUs, specialized setups like OpenVINO are available but Ollama's CPU path is often sufficient for `llama3.2`.

### For Ryzen AI (NPU)
- The backend's **Intent Classifier** supports native acceleration on AMD Ryzen NPUs via **ONNX Runtime**.
- If your hardware supports it, the backend will automatically load the `VitisAIExecutionProvider` for high-efficiency, low-power inference of structural tasks.

## 3. Backend Configuration
The backend is now hardware-agnostic. By default, it looks for Ollama on `localhost:11434`.

If you are using a remote server or a different provider (like vLLM on AMD Instinct GPUs), set these environment variables:

```powershell
$env:LLM_PROVIDER="openai-compatible"  # For vLLM
$env:LLM_BASE_URL="http://your-server:8000"
$env:FAST_MODEL="meta-llama/Llama-3.1-8B-Instruct"
```

## 4. Run the Project
1. **Backend**:
   ```powershell
   cd agent-backend
   python main.py
   ```
2. **Frontend**:
   ```powershell
   cd Frontend
   npm install
   npm run dev
   ```

## 5. Google Meet Integration

The agent backend now supports the **Google Meet REST API (v2)**, enabling:
- Creating instant Meet links
- Retrieving meeting spaces by resource name
- Listing participants and participant sessions
- Fetching transcripts and transcript entries

### Required: Re-authenticate After First Run

The Meet integration requires two new OAuth scopes:
- `meetings.space.created` — create and manage your own spaces
- `meetings.space.readonly` — read participants and transcripts

**You must delete your existing `token.json` and log in again:**

```powershell
cd agent-backend
Remove-Item token.json  # Delete old token
python main.py          # Restart backend
```

Then open the frontend, click **Connect Google Account**, and authorize the new permissions (you'll see _"See and manage your Google Meet conferences"_ in the consent screen).

### API Endpoints

| Endpoint | Description |
|---|---|
| `POST /meet/spaces` | Create a new instant Meet space |
| `GET /meet/spaces/{name}` | Get a meeting space by resource name |
| `GET /meet/conferences/{name}/participants` | List participants |
| `GET /meet/participants/{name}/sessions` | List participant sessions |
| `GET /meet/conferences/{name}/transcripts` | List transcripts |
| `GET /meet/transcripts/{name}/entries` | List transcript entries |

> **Note on Transcripts**: Transcriptions are only available after the meeting ends and the host must have **enabled transcription** in Google Meet settings before the call.

### Agent Commands

You can also ask the AI agent directly:
- *"Create a Google Meet for me"*
- *"Show participants for conferenceRecords/abc123"*
- *"Get transcript for conferenceRecords/abc123"*
---

## 6. Google Classroom Integration

The agent now supports **Google Classroom**, allowing you to:
- List your active courses
- Check assignments/coursework for a specific class
- View class announcements

### Required: Re-authenticate After Update

The Classroom integration requires new OAuth scopes:
- `classroom.courses.readonly`
- `classroom.coursework.me.readonly`
- `classroom.announcements.readonly`

**You must re-authenticate to grant these permissions:**
1. Open the frontend.
2. Click **Connect Google Account** (or Sign In).
3. Authorize the new Classroom permissions.

### Agent Commands

Try asking the AI:
- *"What are my Google Classroom courses?"*
- *"Show me assignments for Math class"*
- *"Are there any new announcements in Physics?"*

