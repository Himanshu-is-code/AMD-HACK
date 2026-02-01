export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  latency?: number;
  sources?: { title: string, url: string }[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export type Theme = 'light' | 'dark';

export interface SidebarProps {
  chats: ChatSession[];
  currentChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  theme: Theme;
  toggleTheme: () => void;
  isOpen: boolean;
}

export interface Task {
  id: string;
  original_request: string;
  plan: string;
  status: 'planned' | 'waiting_for_internet' | 'executing' | 'completed';
  sources?: { title: string, url: string }[];
}
