import google.generativeai as genai
import os
import sys

# Get API Key from arguments or input
api_key = sys.argv[1] if len(sys.argv) > 1 else input("Enter API Key: ")

genai.configure(api_key=api_key)

print("Listing available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error listing models: {e}")
