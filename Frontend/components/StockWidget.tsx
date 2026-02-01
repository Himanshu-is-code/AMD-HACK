import React, { useState } from 'react';
import { Settings, X, RotateCcw, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';

interface StockWidgetProps {
  id?: string;
  onRemove?: () => void;
}

export const StockWidget: React.FC<StockWidgetProps> = ({
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
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customize Stocks</h3>
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
                  value={customStyles.bgColor || (document.documentElement.classList.contains('dark') ? '#15231F' : '#ffffff')}
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
            <div className="absolute inset-0 bg-white dark:bg-[#15231F] border border-zinc-200 dark:border-zinc-700/30" />
          )}
        </div>

        {/* Content Layer */}
        <div
          className={`relative z-10 w-full h-full flex flex-col p-5 ${customStyles.fontFamily} ${!customStyles.textColor ? 'text-zinc-900 dark:text-zinc-100' : ''}`}
          style={{
            color: customStyles.textColor || undefined,
            containerType: 'size'
          }}
        >
          {/* Top Section: S&P 500 */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-4xl font-normal tracking-tight">5,956<span className="text-2xl opacity-60">.06</span></span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium opacity-60 tracking-wide">S&P 500</span>
                <span className="text-xs font-bold text-[#4ADE80]">+0.014%</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#4ADE80] flex items-center justify-center shadow-lg shadow-[#4ADE80]/20">
              <ArrowUp className="w-5 h-5 text-black" />
            </div>
          </div>

          {/* Graph Area */}
          <div className="flex-1 w-full relative my-2 min-h-0">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 50">
              <defs>
                <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4ADE80" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#4ADE80" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,50 L0,35 C10,35 10,25 20,25 C30,25 30,40 40,40 C50,40 50,30 60,30 C70,30 70,45 80,45 C90,45 90,15 100,15 L100,50 Z"
                fill={`url(#grad-${id})`}
                className="transition-all duration-500"
              />
              <path
                d="M0,35 C10,35 10,25 20,25 C30,25 30,40 40,40 C50,40 50,30 60,30 C70,30 70,45 80,45 C90,45 90,15 100,15"
                fill="none"
                stroke="#4ADE80"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* End Dot */}
              <circle cx="100" cy="15" r="2" fill="#4ADE80" />
            </svg>
            {/* Dashed Threshold Line */}
            <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-zinc-400/30 dark:border-white/20"></div>
          </div>

          {/* Bottom Cards Grid */}
          <div className="grid grid-cols-2 gap-3 h-20 shrink-0">
            {/* Card 1: NTFLX */}
            <div className={`
                    rounded-2xl p-3 flex items-center justify-between transition-colors
                    ${customStyles.bgColor
                ? 'bg-black/5 dark:bg-white/10'
                : 'bg-zinc-100 dark:bg-[#1E332E]'
              }
                 `}>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-lg font-normal tracking-tight leading-none mb-1">$990<span className="text-sm opacity-60">.06</span></span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[10px] font-medium opacity-60">NTFLX</span>
                  <span className="text-[10px] font-bold text-[#4ADE80]">+1.31%</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#4ADE80] flex items-center justify-center shrink-0">
                <ArrowUp className="w-4 h-4 text-black" />
              </div>
            </div>

            {/* Card 2: DJI */}
            <div className={`
                    rounded-2xl p-3 flex items-center justify-between transition-colors
                    ${customStyles.bgColor
                ? 'bg-black/5 dark:bg-white/10'
                : 'bg-zinc-100 dark:bg-[#1E332E]'
              }
                 `}>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-lg font-normal tracking-tight leading-none mb-1">$43,433<span className="text-sm opacity-60">.79</span></span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-[10px] font-medium opacity-60">DJI</span>
                  <span className="text-[10px] font-bold text-red-400">-0.43%</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-200 dark:bg-red-400/20 flex items-center justify-center shrink-0">
                <ArrowDown className="w-4 h-4 text-red-500 dark:text-red-400" />
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