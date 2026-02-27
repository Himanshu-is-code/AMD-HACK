import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ChatSession, Message, Role, Theme } from './types';
import { sendToAgent, exchangeAuthCode } from './services/agentService';
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
    // Check for auth code param
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      // Clear params to look clean
      window.history.replaceState({}, document.title, window.location.pathname);

      // Exchange code
      exchangeAuthCode(code)
        .then(() => {
          localStorage.setItem('isGoogleConnected', 'true');
          window.dispatchEvent(new Event('google-auth-changed'));
          // alert("Connected to Google successfully!"); // Removing alert for smoother UX, or keeping it but the event is key
        })
        .catch(err => {
          console.error("Auth failed", err);
          alert("Failed to connect to Google: " + err.message);
        });
    }

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
  };

  // Helper function to read file as Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the Data URL prefix (e.g., "data:application/pdf;base64,")
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        } else {
          reject(new Error("Failed to read file as string"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSendMessage = async (content: string, file?: File | null, isWebSearch?: boolean, dismissedIntents?: string[]) => {
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
      timestamp: Date.now(),
      fileName: file?.name
    };

    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        const shouldRename = chat.messages.length === 0 && chat.title === 'New Chat';
        return {
          ...chat,
          title: shouldRename ? (content || (file ? `File: ${file.name}` : 'New Chat')).slice(0, 30) + '...' : chat.title,
          messages: [...chat.messages, userMsg],
          updatedAt: Date.now()
        };
      }
      return chat;
    }));

    setIsLoading(true);
    const startTime = Date.now();

    try {
      // Direct Gemini integration for Search and File Upload tasks
      if (file || isWebSearch) {
        const { GoogleGenAI } = await import("@google/genai");
        const apiKey = process.env.API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey });

        let promptText = content || "Please review the attached file.";
        if (isWebSearch && file) {
          promptText += "\n\n[SYSTEM INSTRUCTION]: The user has enabled Web Search. You MUST use the Google Search tool to find external sources, verify information, and add citations relevant to the attached document.";
        } else if (isWebSearch) {
          promptText += "\n\n[SYSTEM INSTRUCTION]: You MUST use the Google Search tool to answer this query and cite your sources.";
        }

        let requestContents: any[] = [promptText];

        let inlineDataObj: { data: string, mimeType: string } | undefined = undefined;

        if (file) {
          const base64Data = await readFileAsBase64(file);
          inlineDataObj = {
            data: base64Data,
            mimeType: file.type || 'application/octet-stream' // fallback
          };
          requestContents.unshift({
            inlineData: inlineDataObj
          });
        }

        const config: any = {};
        if (isWebSearch) {
          config.tools = [{ googleSearch: {} }];
        }

        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: requestContents,
          config
        });

        const responseText = result.text || "";
        const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
        const sources: { title: string, url: string }[] = [];

        if (groundingMetadata?.groundingChunks) {
          for (const chunk of groundingMetadata.groundingChunks as any[]) {
            if (chunk.web) {
              sources.push({ title: chunk.web?.title || "", url: chunk.web?.uri || "" });
            }
          }
        }

        const duration = Date.now() - startTime;
        const modelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.MODEL,
          content: responseText,
          timestamp: Date.now(),
          latency: duration,
          sources: sources.length > 0 ? sources : undefined
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
      } else {
        // Normal Agent Backend Router flow
        const agentResponse = await sendToAgent(content, dismissedIntents);

        if (agentResponse.id) {
          setActiveTaskId(agentResponse.id);
          setActiveTaskStatus(agentResponse.status);
        }

        const responseText = agentResponse.plan || JSON.stringify(agentResponse);
        const duration = Date.now() - startTime;

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
      }
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
    if (!currentChatId) return;

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

      // Inject Date Context
      const today = new Date();
      const dateString = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      let queryWithContext = `Current Date: ${dateString}. ${query}`;

      // User requested "just the date and time" for confirmation on calendar tasks
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('schedule') || lowerQuery.includes('calendar') || lowerQuery.includes('remind') || lowerQuery.includes('event')) {
        queryWithContext += "\n\nIMPORTANT: Use Google Search to verify the exact date and time if needed. Return ONLY the confirmed Date and Time (and timezone). Do not provide a long explanation.";
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: queryWithContext,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      const response = result;
      const text = response.text || "";

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
              content: text || (response.text as string),
              sources: sources,
              latency: Date.now() - lastMsg.timestamp
            };
          }
          return { ...c, messages: updatedMsgs };
        }
        return c;
      }));

      // Notify backend that task is complete (ONLY if we have a task ID)
      if (activeTaskId) {
        try {
          const service = await import('./services/agentService');
          await service.completeTask(activeTaskId, text || (response.text as string), sources);
        } catch (e) {
          console.error("Failed to update backend task status", e);
        }
        setActiveTaskId(null); // Stop polling backend
        setActiveTaskStatus('completed');
      }

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
      if (activeTaskId) {
        setActiveTaskId(null);
      }
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
