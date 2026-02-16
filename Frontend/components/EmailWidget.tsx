import React, { useState, useEffect } from 'react';
import { Settings, X, RotateCcw, Pencil, Archive, Pin, Loader2 } from 'lucide-react';

interface Email {
  subject: string;
  sender: string;
  snippet: string;
}

interface EmailWidgetProps {
  id?: string;
  onRemove?: () => void;
  isLocked?: boolean;
}

export const EmailWidget: React.FC<EmailWidgetProps> = ({
  id,
  onRemove,
  isLocked
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customization State
  const [customStyles, setCustomStyles] = useState({
    bgColor: '',
    textColor: '',
    fontFamily: 'font-sans',
  });

  const fetchEmails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/gmail/unread?limit=2');
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Gmail access required. Please log in.');
        }
        throw new Error('Failed to fetch emails');
      }
      const data = await response.json();
      setEmails(data);
    } catch (err: any) {
      setError(err.message);
      console.error('EmailWidget Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  return (
    <div className="w-full h-full relative group">
      {/* Settings Panel */}
      {showSettings && !isLocked && (
        <div
          className="absolute top-0 left-[105%] z-[60] w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 cursor-default animate-in fade-in slide-in-from-left-2 duration-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customize Email</h3>
            <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Font Style</label>
              <div className="flex gap-2">
                {['font-sans', 'font-serif', 'font-mono'].map((font) => (
                  <button
                    key={font}
                    onClick={() => setCustomStyles(prev => ({ ...prev, fontFamily: font }))}
                    className={`flex-1 py-1.5 text-sm border rounded-md transition-all ${customStyles.fontFamily === font
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                      } ${font}`}
                  >
                    Aa
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Background Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={customStyles.bgColor || (document.documentElement.classList.contains('dark') ? '#1E293B' : '#ffffff')}
                  onChange={(e) => setCustomStyles(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer overflow-hidden border-0 p-0"
                />
                <div className="flex-1 text-xs text-zinc-400 font-mono pl-2">{customStyles.bgColor || 'Default'}</div>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => setCustomStyles({ bgColor: '', textColor: '', fontFamily: 'font-sans' })}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Widget Card */}
      <div
        className={`relative w-full h-full rounded-[24px] shadow-xl overflow-hidden transition-shadow select-none`}
      >
        {/* Background Layer */}
        <div
          className="absolute inset-0 transition-colors duration-300 pointer-events-none"
          style={{ backgroundColor: customStyles.bgColor || undefined }}
        >
          {!customStyles.bgColor && (
            <div className="absolute inset-0 bg-white dark:bg-[#1F2937] border border-zinc-200 dark:border-zinc-700/50" />
          )}
        </div>

        {/* Content Layer */}
        <div
          className={`relative z-10 w-full h-full flex flex-col p-5 pointer-events-none select-none ${customStyles.fontFamily} ${!customStyles.textColor ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
          style={{
            color: customStyles.textColor || undefined,
            containerType: 'size'
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4 px-1">
            <span className="text-xl font-normal tracking-tight">
              {error ? 'Inbox Error' : emails.length > 0 ? 'Primary' : 'Inbox'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchEmails();
              }}
              disabled={isLoading}
              className="w-11 h-11 rounded-2xl bg-[#C2E7FF] hover:bg-[#b3dffc] disabled:opacity-50 text-[#001D35] flex items-center justify-center transition-colors shadow-sm pointer-events-auto"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Pencil className="w-5 h-5 fill-current" />
              )}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 flex flex-col gap-2 overflow-hidden pointer-events-auto">
            {error ? (
              <div className="flex-1 flex items-center justify-center text-center p-4">
                <p className="text-sm text-red-500 opacity-80">{error}</p>
              </div>
            ) : emails.length === 0 && !isLoading ? (
              <div className="flex-1 flex items-center justify-center text-center p-4">
                <p className="text-sm opacity-50 italic">No unread emails</p>
              </div>
            ) : (
              emails.map((email, idx) => (
                <div
                  key={idx}
                  className={`
                    rounded-[18px] p-3.5 flex gap-3 transition-colors cursor-pointer group/item
                    ${customStyles.bgColor
                      ? 'bg-black/5 dark:bg-white/10'
                      : 'bg-zinc-100 dark:bg-[#334155]/40 hover:bg-zinc-200 dark:hover:bg-[#334155]/60'
                    }
                  `}
                >
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-tight truncate">{email.sender.split('<')[0].trim()}</span>
                    <span className="text-[14px] font-medium leading-tight truncate">{email.subject}</span>
                    <span className="text-[13px] opacity-70 truncate leading-tight">{email.snippet}</span>
                  </div>
                  <div className="flex flex-col items-end justify-center">
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${customStyles.textColor
                      ? 'border-current/20'
                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400'
                      }`}>
                      <Archive className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Controls */}
        {!isLocked && (
          <div className={`absolute top-3 right-3 z-20 transition-opacity duration-200 ${showSettings ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full backdrop-blur-sm text-zinc-600 dark:text-white/70 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};