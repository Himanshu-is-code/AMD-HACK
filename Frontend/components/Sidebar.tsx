import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  Sun, 
  Moon,
  X,
  Check,
  Search,
  PanelLeft
} from 'lucide-react';
import { ChatSession, SidebarProps } from '../types';

export const Sidebar: React.FC<SidebarProps> = ({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  theme,
  toggleTheme,
  isOpen
}) => {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when renaming starts
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [renamingId]);

  const handleStartRename = (chat: ChatSession) => {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
    setMenuOpenId(null);
  };

  const handleFinishRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameChat(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinishRename();
    if (e.key === 'Escape') setRenamingId(null);
  };

  // Filter chats based on search term
  const filteredChats = chats.filter(chat => 
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="w-64 flex-shrink-0 h-full bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-colors duration-200 z-30 relative">
      {/* Header - Minimal, only theme toggle */}
      <div className="p-4 flex items-center justify-end h-14">
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-4 mb-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-700 dark:text-zinc-300 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Thread
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-4">
        <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
            <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-200/50 dark:bg-zinc-800/50 border border-transparent focus:bg-white dark:focus:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700 transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-500"
            />
        </div>
      </div>

      {/* Workspaces Header */}
      <div className="px-4 pt-2 pb-2 flex items-center gap-2 text-zinc-500 dark:text-zinc-500">
          <span className="text-xs font-semibold tracking-wider">WORKSPACES</span>
          <PanelLeft className="w-3.5 h-3.5" />
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {chats.length === 0 ? (
          <div className="text-center text-xs text-zinc-400 mt-4">No chats yet</div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center text-xs text-zinc-400 mt-4">No results found</div>
        ) : null}
        
        {filteredChats.map((chat) => (
          <div 
            key={chat.id}
            className={`group relative flex items-center rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
              currentChatId === chat.id 
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' 
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
            }`}
            onClick={() => onSelectChat(chat.id)}
          >
            {renamingId === chat.id ? (
              <div className="flex items-center w-full gap-1">
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleFinishRename}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded px-1 py-0.5 outline-none text-zinc-900 dark:text-zinc-100"
                />
                <button onClick={handleFinishRename} className="text-green-500 hover:text-green-600 p-0.5">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setRenamingId(null)} className="text-red-500 hover:text-red-600 p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <span className="truncate flex-1">{chat.title}</span>
                
                {/* Options Menu Trigger */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === chat.id ? null : chat.id);
                  }}
                  className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-500 transition-opacity ${menuOpenId === chat.id ? 'opacity-100' : ''}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {/* Dropdown Menu */}
                {menuOpenId === chat.id && (
                  <div 
                    ref={menuRef}
                    className="absolute right-2 top-8 z-20 w-32 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleStartRename(chat)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit2 className="w-3 h-3" />
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        onDeleteChat(chat.id);
                        setMenuOpenId(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      
    </div>
  );
};
