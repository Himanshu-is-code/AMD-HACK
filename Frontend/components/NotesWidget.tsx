import React, { useState } from 'react';
import { Settings, X, RotateCcw, StickyNote, Trash2 } from 'lucide-react';

interface NotesWidgetProps {
  id?: string;
  onRemove?: () => void;
}

export const NotesWidget: React.FC<NotesWidgetProps> = ({
  id,
  onRemove
}) => {
  const [content, setContent] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Customization State
  const [customStyles, setCustomStyles] = useState({
    bgColor: '',
    textColor: '',
    fontFamily: 'font-sans',
  });

  return (
    <div className="w-full h-full relative group">
      {/* Settings Panel */}
      {showSettings && (
        <div
          className="absolute top-0 left-[105%] z-[60] w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 cursor-default animate-in fade-in slide-in-from-left-2 duration-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customize Notes</h3>
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
                  value={customStyles.bgColor || (document.documentElement.classList.contains('dark') ? '#422006' : '#FEF3C7')}
                  onChange={(e) => setCustomStyles(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer overflow-hidden border-0 p-0"
                />
                <div className="flex-1 text-xs text-zinc-400 font-mono pl-2">{customStyles.bgColor || 'Default'}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Text Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={customStyles.textColor || (document.documentElement.classList.contains('dark') ? '#FEF3C7' : '#78350F')}
                  onChange={(e) => setCustomStyles(prev => ({ ...prev, textColor: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer overflow-hidden border-0 p-0"
                />
                <div className="flex-1 text-xs text-zinc-400 font-mono pl-2">{customStyles.textColor || 'Default'}</div>
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
            <div className="absolute inset-0 bg-[#FEF3C7] dark:bg-[#422006] border border-yellow-200 dark:border-yellow-900/50" />
          )}
        </div>

        {/* Content Layer */}
        <div
          className={`relative z-10 w-full h-full flex flex-col p-5 ${customStyles.fontFamily} ${!customStyles.textColor ? 'text-yellow-900 dark:text-yellow-100' : ''}`}
          style={{
            color: customStyles.textColor || undefined,
            containerType: 'size'
          }}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2 opacity-70">
              <StickyNote className="w-4 h-4" />
              <span className="text-sm font-semibold tracking-wide">Notes</span>
            </div>
            <button
              className={`p-1 rounded-md transition-colors pointer-events-auto ${!customStyles.textColor ? 'hover:bg-yellow-500/10' : 'hover:bg-black/5'}`}
              onClick={() => setContent('')}
              title="Clear Note"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Trash2 className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
            </button>
          </div>

          {/* Note Area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your notes here..."
            className={`w-full flex-1 bg-transparent border-none resize-none outline-none text-sm leading-relaxed placeholder-current/40 ${customStyles.fontFamily} pointer-events-auto`}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Controls */}
        <div className={`absolute top-3 right-3 z-20 transition-opacity duration-200 ${showSettings ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 rounded-full backdrop-blur-sm text-current transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};