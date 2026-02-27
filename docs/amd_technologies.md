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

## 4. ONNX NPU Integration (Ryzen™ AI)
To maximize battery life and offload background tasks from the CPU/GPU, we've integrated **ONNX Runtime** optimization.

*   **Implementation:** The `onnx_service.py` handles intent classification (e.g., determining if a task needs internet) using a lightweight ONNX model. 
*   **Hardware Routing:** The service is configured to prioritize the **Vitis™ AI Execution Provider**. On laptops with **AMD Ryzen™ AI (XDNA™)** processors, this allows background classification to run entirely on the ultra-low-power NPU.
*   **Benefits:** This keeps the dedicated GPU free for heavy agent reasoning while ensuring the "always-on" background logic doesn't drain the user's battery.
