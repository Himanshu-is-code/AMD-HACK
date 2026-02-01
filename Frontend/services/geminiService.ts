import { GoogleGenAI } from "@google/genai";
import { Message, Role } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize the client
const ai = new GoogleGenAI({ apiKey });

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string
): Promise<string> => {
  if (!apiKey) {
    return "Error: API Key is missing. Please check your configuration.";
  }

  try {
    // Convert internal message format to Gemini format
    // Note: We use gemini-3-flash-preview as recommended for basic text tasks
    const model = 'gemini-3-flash-preview';

    // Construct the prompt. For simple stateless calls we can just send the new message, 
    // but for context, we might want to include history. 
    // Here we'll just send the current message for simplicity in this stateless wrapper,
    // or construct a chat session if using the chat API.

    // Using the chat API for context retention
    const chat = ai.chats.create({
      model: model,
      history: history.map(msg => ({
        role: msg.role === Role.USER ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage({
      message: newMessage
    });

    return result.text || "No response text generated.";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error processing your request.";
  }
};
