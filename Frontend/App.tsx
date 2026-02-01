import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ChatSession, Message, Role, Theme } from './types';
import { sendToAgent } from './services/agentService';
import { PanelLeft } from 'lucide-react';

const App: React.FC = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Task State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeTaskStatus, setActiveTaskStatus] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Poll for active task status
  useEffect(() => {
    let intervalId: any;

    if (activeTaskId && activeTaskStatus !== 'completed') {
      intervalId = setInterval(async () => {
        try {
          const service = await import('./services/agentService');
          const fetchedTask = await service.getTask(activeTaskId);

          if (fetchedTask) {
            setActiveTaskStatus(fetchedTask.status);

            // Auto-resume removed. Waiting for user input.

            if (fetchedTask.status === 'completed') {
              setActiveTaskId(null); // Stop polling

              // Update the chat message with the final result
              setChats(prev => prev.map(c => {
                if (c.id === currentChatId) { // Use currentChatId ref or state if available. Note: inside polling, currentChatId state might be stale if not in dep array.
                  // Better approach: Find the chat that contains the message with this task ID? 
                  // Since specific task-message linking isn't rigorous, we assume it's the LAST message of the current conversation if we are polling.
                  // Actually, let's just update the ACTIVE chat.
                  const lastMsg = c.messages[c.messages.length - 1];
                  if (lastMsg && lastMsg.role === 'model') {
                    const updatedMsgs = [...c.messages];
                    updatedMsgs[updatedMsgs.length - 1] = {
                      ...lastMsg,
                      content: fetchedTask.plan, // The plan contains the final result
                      sources: fetchedTask.sources // Attach sources from backend
                    };
                    return { ...c, messages: updatedMsgs };
                  }
                }
                return c;
              }));
            }
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeTaskId, activeTaskStatus, currentChatId]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now()
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    // On mobile, maybe close sidebar? Keeping open for now.
  };

  const handleSendMessage = async (content: string) => {
    let chatId = currentChatId;
    let currentHistory: Message[] = [];

    // If no chat selected or exists, create one
    if (!chatId) {
      const newChat: ChatSession = {
        id: Date.now().toString(),
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        updatedAt: Date.now()
      };
      setChats(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      chatId = newChat.id;
    } else {
      // Find current chat history
      const chat = chats.find(c => c.id === chatId);
      if (chat) currentHistory = chat.messages;
    }

    // Optimistically add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content,
      timestamp: Date.now()
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        // Auto-rename if it's the first message and title is "New Chat"
        const shouldRename = chat.messages.length === 0 && chat.title === 'New Chat';
        return {
          ...chat,
          title: shouldRename ? content.slice(0, 30) + (content.length > 30 ? '...' : '') : chat.title,
          messages: [...chat.messages, userMsg],
          updatedAt: Date.now()
        };
      }
      return chat;
    }));

    setIsLoading(true);
    const startTime = Date.now();

    try {
      // const responseText = await sendMessageToGemini([...currentHistory, userMsg], content);
      const agentResponse = await sendToAgent(content);

      // Handle Task Creation
      if (agentResponse.id) {
        setActiveTaskId(agentResponse.id);
        setActiveTaskStatus(agentResponse.status);
      }

      const responseText = agentResponse.plan || JSON.stringify(agentResponse);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        content: responseText,
        timestamp: Date.now(),
        latency: duration
      };

      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, modelMsg],
            updatedAt: Date.now()
          };
        }
        return chat;
      }));
    } catch (err: any) {
      console.error(err);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        content: `Error: ${err.message || "Something went wrong"}`,
        timestamp: Date.now(),
        latency: duration
      };
      setChats(prev => prev.map(chat => {
        if (chat.id === chatId) {
          return {
            ...chat,
            messages: [...chat.messages, errorMsg],
            updatedAt: Date.now()
          };
        }
        return chat;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      setCurrentChatId(null);
    }
  };

  const renameChat = (id: string, newTitle: string) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const currentChat = chats.find(c => c.id === currentChatId);

  const handleResumeWithGemini = async () => {
    if (!currentChatId || !activeTaskId) return;

    // Get query from chat history (last user message)
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    const lastUserMsg = [...chat.messages].reverse().find(m => m.role === Role.USER);
    const query = lastUserMsg?.content;

    if (!query) return;

    setIsLoading(true);

    try {
      // Import dynamically to avoid SSR issues if any, or just standard import
      const { GoogleGenAI } = await import("@google/genai");

      const apiKey = process.env.API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      const response = result;
      const text = response.text || ""; // SDK might return text directly strictly or via method?
      // In snippet: const response = await ai.models.generateContent(...) -> response.text gives text?
      // Snippet says: const analysisResult = JSON.parse(response.text)
      // So response.text is a STRING property? Or a method?
      // Inspecting snippet: `const aiResponse = response.text;`
      // So it is a property.

      // Extract sources
      // Snippet: const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      // Wait, is 'candidates' on response? The snippet uses:
      // `const response = await chat.sendMessage(...)`
      // `const groundingMetadata = response.candidates?.[0]?.groundingMetadata;`
      // But for `ai.models.generateContent`, the snippet shows:
      // `const response = await ai.models.generateContent(...)`
      // `JSON.parse(response.text)`
      // It doesn't show source extraction for generateContent, only for chat.sendMessage.
      // But typically the response object structure is similar.
      // I'll assume response.candidates exists.

      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
      const sources: { title: string, url: string }[] = [];

      if (groundingMetadata?.groundingChunks) {
        // @ts-ignore - The SDK types might be slightly different or implicit
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web) {
            sources.push({ title: chunk.web.title || "", url: chunk.web.uri || "" });
          }
        }
      }

      // Update Chat
      setChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          const updatedMsgs = [...c.messages];
          const lastMsg = updatedMsgs[updatedMsgs.length - 1];

          if (lastMsg && lastMsg.role === Role.MODEL) {
            // Update the existing "waiting" or "plan" message
            updatedMsgs[updatedMsgs.length - 1] = {
              ...lastMsg,
              content: text || (response.text as string), // handle if text is property
              sources: sources,
              latency: Date.now() - lastMsg.timestamp // simple delta
            };
          }
          return { ...c, messages: updatedMsgs };
        }
        return c;
      }));

      // Notify backend that task is complete
      if (activeTaskId) {
        try {
          const service = await import('./services/agentService');
          await service.completeTask(activeTaskId, text || (response.text as string), sources);
        } catch (e) {
          console.error("Failed to update backend task status", e);
        }
      }

      setActiveTaskId(null); // Stop polling backend
      setActiveTaskStatus('completed');

    } catch (err: any) {
      console.error("Gemini Search Error:", err);
      // Update chat with error
      setChats(prev => prev.map(c => {
        if (c.id === currentChatId) {
          const updatedMsgs = [...c.messages];
          const lastMsg = updatedMsgs[updatedMsgs.length - 1];
          if (lastMsg) {
            updatedMsgs[updatedMsgs.length - 1] = {
              ...lastMsg,
              content: `Error performing search: ${err.message || "Unknown error"}`
            };
          }
          return { ...c, messages: updatedMsgs };
        }
        return c;
      }));
      setActiveTaskId(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onNewChat={createNewChat}
        onSelectChat={setCurrentChatId}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
        theme={theme}
        toggleTheme={toggleTheme}
        isOpen={isSidebarOpen}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile/Collapsed Sidebar Toggle Overlay (Optional but good UX) */}
        {!isSidebarOpen && (
          <div className="absolute top-4 left-4 z-50">
            {/* Toggle button is inside ChatArea header for clean layout, but logic is passed down */}
          </div>
        )}

        <ChatArea
          messages={currentChat?.messages || []}
          onSendMessage={handleSendMessage}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isLoading={isLoading}
          activeTaskStatus={activeTaskStatus}
          activeTaskId={activeTaskId}
          apiKey={import.meta.env.VITE_GEMINI_API_KEY || ""}
          onResumeWithGemini={handleResumeWithGemini}
        />
      </div>
    </div>
  );
};

export default App;
