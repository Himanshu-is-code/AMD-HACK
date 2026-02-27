import onnxruntime as ort
import numpy as np
import logging
import os

# Configuration
MODEL_PATH = "models/intent_classifier.onnx"
# In a real app, we'd download this from a CDN. For now, we'll implement fallback logic.

class ONNXClassifier:
    def __init__(self):
        self.session = None
        self.provider = "CPU"
        self._initialize_session()

    def _initialize_session(self):
        """Initializes ORT session with NPU preference."""
        try:
            # Check for available providers
            available = ort.get_available_providers()
            logging.info(f"Available ORT Providers: {available}")

            # Preference: 
            # 1. VitisAI (AMD NPU)
            # 2. CPU (Intel/NVIDIA/Standard)
            providers = []
            if 'VitisAIExecutionProvider' in available:
                providers.append('VitisAIExecutionProvider')
                self.provider = "AMD NPU (Vitis™ AI)"
            else:
                providers.append('CPUExecutionProvider')
                self.provider = "CPU"

            if os.path.exists(MODEL_PATH):
                self.session = ort.InferenceSession(MODEL_PATH, providers=providers)
                logging.info(f"ONNX Session started on: {self.provider}")
            else:
                logging.warning(f"ONNX Model not found at {MODEL_PATH}. Using keyword-based fallback.")
                self.session = None
        except Exception as e:
            logging.error(f"Failed to load ONNX: {e}")
            self.session = None

    def analyze_internet_requirement(self, text: str) -> bool:
        """
        Determines if a request needs internet.
        High-performance replacement for LLM classification.
        """
        text = text.lower()
        
        # --- IF MODEL EXISTS, USE INFERENCE ---
        if self.session:
            # Note: This is a placeholder for actual tensor processing
            # Input would be pre-tokenized features
            # output = self.session.run(None, {"input": tensor})[0]
            # return bool(output > 0.5)
            pass

        # --- HIGH-PERFORMANCE KEYWORD FALLBACK ---
        # Optimized for speed and low power
        internet_keywords = [
            "news", "weather", "latest", "stock", "score", "current", 
            "today", "price", "who is", "what is the", "search", "google",
            "email", "gmail", "inbox", "unread", "mail"
        ]
        
        # Immediate return on keyword match
        for kw in internet_keywords:
            if kw in text:
                return True
                
        return False

# Singleton instance
classifier = ONNXClassifier()

def needs_internet(text: str) -> bool:
    return classifier.analyze_internet_requirement(text)
