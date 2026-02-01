import React, { useState } from 'react';
import { Settings, X, RotateCcw, Upload, FileText, Table, Triangle } from 'lucide-react';

interface DriveWidgetProps {
  id?: string;
  onRemove?: () => void;
}

export const DriveWidget: React.FC<DriveWidgetProps> = ({
  id,
  onRemove
}) => {
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
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customize Drive</h3>
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
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md border-2 border-current flex items-center justify-center opacity-80">
                <Triangle className="w-3 h-3 fill-current" />
              </div>
              <span className="text-xl font-normal tracking-wide">Drive</span>
            </div>
            <button className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-[#BAE6FD] hover:bg-sky-200 dark:hover:bg-[#a0dcfb] text-sky-900 dark:text-[#0F172A] flex items-center justify-center transition-colors shadow-sm pointer-events-auto">
              <Upload className="w-5 h-5" />
            </button>
          </div>

          {/* Files List */}
          <div className="flex flex-col gap-2.5 overflow-hidden">
            {/* File 1 */}
            <div className={`
                    rounded-2xl p-3 flex items-center gap-4 transition-colors
                    ${customStyles.bgColor
                ? 'bg-black/5 dark:bg-white/10'
                : 'bg-zinc-100 dark:bg-[#334155]/60 hover:bg-zinc-200 dark:hover:bg-[#334155]/80'
              }
                `}>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[#4A90E2]/20 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-500 dark:text-[#4A90E2]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-normal truncate">Concert plan</span>
                <span className="text-xs opacity-60 truncate">You edited today</span>
              </div>
            </div>

            {/* File 2 */}
            <div className={`
                    rounded-2xl p-3 flex items-center gap-4 transition-colors
                    ${customStyles.bgColor
                ? 'bg-black/5 dark:bg-white/10'
                : 'bg-zinc-100 dark:bg-[#334155]/60 hover:bg-zinc-200 dark:hover:bg-[#334155]/80'
              }
                `}>
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-[#4ADE80]/20 flex items-center justify-center shrink-0">
                <Table className="w-5 h-5 text-green-500 dark:text-[#4ADE80]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[15px] font-normal truncate">Expenses for concert</span>
                <span className="text-xs opacity-60 truncate">You edited yesterday</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className={`absolute top-3 right-3 z-20 transition-opacity duration-200 ${showSettings ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full backdrop-blur-sm text-zinc-600 dark:text-white/70 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};