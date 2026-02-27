# AMD Technologies in Flowstate Hub

Flowstate Hub is designed from the ground up to be hardware-agnostic, with a strong emphasis on capitalizing on AMD’s open-source AI ecosystem and enterprise hardware capabilities. Below are the core AMD technologies and design patterns integrated into the project.

## 1. AMD ROCm™ Hardware Acceleration
To ensure the application runs efficiently without reliance on costly cloud APIs, we heavily integrated local AI execution pathways optimized for AMD.

*   **Implementation:** The default local inference engine is **Ollama**, which natively supports the **AMD ROCm™ SDK** on compatible Linux systems and WSL2, as well as native AMD acceleration on Windows (via DirectML/AMD Software). 
*   **Benefits:** This allows developers and users with consumer Radeon GPUs or workstation PRO GPUs to run models like `llama3.2` locally with full hardware acceleration, ensuring privacy and reducing latency for agents without extra configuration.

## 2. vLLM Support for AMD Instinct™ GPUs
For enterprise scaling (e.g., using the AMD Developer Cloud or local MI300X servers), the backend's LLM layer has been abstracted to support high-throughput serving engines.

*   **Implementation:** `main.py` features a hardware-agnostic LLM caller (`call_llm`). By setting `$env:LLM_PROVIDER="openai-compatible"`, the orchestration engine can instantly route requests to **vLLM**—a state-of-the-art serving engine that is deeply optimized for ROCm and AMD Instinct™ GPUs. 
*   **Benefits:** This ensures the exact same agent code that runs on a local consumer laptop can scale to enterprise AMD data centers without rewriting the core logic.

## 3. Google ADK (Agentic Development Kit) Architecture
Inspired by recent Google and AMD technical collaborations regarding AI Agents, we refactored the monolithic backend into a modular architecture.

*   **Implementation:** We built an **Agent Orchestrator** (`agent_orchestrator.py`) utilizing the **"Agent Card"** pattern. Unique capabilities (like processing Calendar events or searching Gmail) are encapsulated into distinct cards.
*   **Benefits:** This design pattern (championed by the Google ADK) allows the orchestration engine to be highly portable. The orchestrator makes routing decisions using the local AMD-powered LLM, then triggers the specific Agent Card, making the system highly scalable and easy to maintain as new tools are added.
