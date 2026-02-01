import React, { useState, useEffect } from 'react';
import { Settings, X, RotateCcw } from 'lucide-react';

interface ClockWidgetProps {
  id?: string;
  onRemove?: () => void; // Provided by Wrapper usually, but we can call it if passed
}

export const ClockWidget: React.FC<ClockWidgetProps> = ({
  id,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  // Customization State
  const [customStyles, setCustomStyles] = useState({
    bgColor: '',
    textColor: '',
    fontFamily: 'font-sans', // Tailwind classes: font-sans, font-serif, font-mono
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format date and time
  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const timeStr = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Calculate dynamic font sizes based on container size? 
  // We can use container query units (cqw/cqh) or just relative units like em/rem if we assume base size.
  // Or we can use a ref and ResizeObserver to calculate font size? 
  // For simplicity, let's use flex/viewport units or just assume the card is sized well designated by the wrapper.
  // Using % for font size relative to container height is tricky without container queries.
  // Let's use 'cqh' (container query height) if supported, or fall back to standard responsive utility classes or inline styles based on assumption.
  // Since we are inside a resizable wrapper, the best way to scale text is `container-type: size` in CSS but that's new.
  // We'll stick to a simple flexible layout.

  return (
    <div className="w-full h-full relative group">
      {/* Settings Panel Popover */}
      {showSettings && (
        <div
          className="absolute top-0 left-[105%] z-[60] w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 cursor-default animate-in fade-in slide-in-from-left-2 duration-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customize Widget</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            >
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Font Selection */}
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

            {/* Background Color */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Background Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={customStyles.bgColor || (document.documentElement.classList.contains('dark') ? '#1A3B32' : '#D1EFE5')}
                  onChange={(e) => setCustomStyles(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer overflow-hidden border-0 p-0"
                />
                <div className="flex-1 text-xs text-zinc-400 font-mono pl-2">
                  {customStyles.bgColor || 'Default'}
                </div>
              </div>
            </div>

            {/* Text Color */}
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500 font-medium">Text Color</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={customStyles.textColor || (document.documentElement.classList.contains('dark') ? '#E7F3F0' : '#0D3B31')}
                  onChange={(e) => setCustomStyles(prev => ({ ...prev, textColor: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer overflow-hidden border-0 p-0"
                />
                <div className="flex-1 text-xs text-zinc-400 font-mono pl-2">
                  {customStyles.textColor || 'Default'}
                </div>
              </div>
            </div>

            {/* Actions */}
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
        className={`relative w-full h-full rounded-[32px] shadow-xl overflow-hidden transition-shadow select-none`}
      >
        {/* Background Layer */}
        <div
          className="absolute inset-0 transition-colors duration-300 pointer-events-none"
          style={{
            backgroundColor: customStyles.bgColor || undefined
          }}
        >
          {/* Default Theme Fallback via Classes if no custom color */}
          {!customStyles.bgColor && (
            <div className="absolute inset-0 bg-[#D1EFE5] dark:bg-[#1A3B32]" />
          )}
        </div>

        {/* Content Layer */}
        <div
          className={`relative z-10 w-full h-full flex flex-col items-center justify-center pointer-events-none select-none ${customStyles.fontFamily}`}
          style={{
            color: customStyles.textColor || undefined,
            containerType: 'size' // Enable container queries if supported
          }}
        >
          {/* Default Text Color Fallback */}
          {!customStyles.textColor && (
            <div className="hidden text-[#0D3B31] dark:text-[#E7F3F0]" />
          )}

          <span
            className={!customStyles.textColor ? "text-[#0D3B31] dark:text-[#E7F3F0] transition-colors" : ""}
            style={{
              fontSize: 'clamp(10px, 12cqh, 24px)', // Responsive font size based on container height
              opacity: 0.8,
              marginBottom: '2px',
              fontWeight: 500
            }}
          >
            {dateStr}
          </span>
          <span
            className={!customStyles.textColor ? "text-[#0D3B31] dark:text-[#E7F3F0] transition-colors" : ""}
            style={{
              fontSize: 'clamp(24px, 45cqh, 120px)',
              lineHeight: 0.9,
              fontWeight: 400
            }}
          >
            {timeStr}
          </span>
        </div>

        {/* Hover Controls */}
        <div className={`absolute top-3 right-3 z-20 transition-opacity duration-200 ${showSettings ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag start from wrapper
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full backdrop-blur-sm text-zinc-700 dark:text-zinc-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};