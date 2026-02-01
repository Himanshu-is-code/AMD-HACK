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
                      content: fetchedTask.plan // The plan contains the final result
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
        />
      </div>
    </div>
  );
};

export default App;
