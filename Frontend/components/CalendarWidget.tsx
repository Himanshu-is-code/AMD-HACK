import React, { useState, useEffect, useRef } from 'react';
import { Settings, X, RotateCcw, Plus, AlertCircle } from 'lucide-react';

interface CalendarWidgetProps {
  id?: string;
  onRemove?: () => void;
  variant?: 'small' | 'large' | 'wide';
}

// Helper: Get ISO Week Number
const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

// Helper: Get Days for Month Grid
const getCalendarDays = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  // Empty slots for days before start of month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
};

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  id,
  variant = 'large'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Customization State
  const [customStyles, setCustomStyles] = useState({
    bgColor: '',
    textColor: '',
    fontFamily: 'font-sans', // Tailwind classes: font-sans, font-serif, font-mono
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Date Formatting Helpers
  const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNameShort = currentTime.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNumber = currentTime.getDate();
  const monthName = currentTime.toLocaleDateString('en-US', { month: 'long' });
  const year = currentTime.getFullYear();
  const month = currentTime.getMonth();

  // Generate Week Days for Large View
  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(currentTime);
      date.setDate(currentTime.getDate() + i);
      days.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        date: date.getDate(),
        isToday: i === 0
      });
    }
    return days;
  };

  // View Mode Logic
  const isWide = variant === 'wide';
  const isLarge = variant === 'large';
  const isSmall = variant === 'small';

  return (
    <div className="w-full h-full relative group">
      {/* Settings Panel */}
      {showSettings && (
        <div
          className="absolute top-0 left-[105%] z-[60] w-64 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 cursor-default animate-in fade-in slide-in-from-left-2 duration-200"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Customize Calendar</h3>
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
                  value={customStyles.bgColor || (document.documentElement.classList.contains('dark') ? '#18181b' : '#ffffff')}
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
                  value={customStyles.textColor || (document.documentElement.classList.contains('dark') ? '#f4f4f5' : '#18181b')}
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
        ref={containerRef}
        className={`relative w-full h-full rounded-[24px] shadow-xl overflow-hidden transition-shadow select-none`}
      >
        {/* Background Layer */}
        <div
          className="absolute inset-0 transition-colors duration-300 pointer-events-none"
          style={{ backgroundColor: customStyles.bgColor || undefined }}
        >
          {!customStyles.bgColor && (
            <div className="absolute inset-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800" />
          )}
        </div>

        {/* Content Layer */}
        <div
          className={`relative z-10 w-full h-full flex flex-col p-5 pointer-events-none select-none ${customStyles.fontFamily}`}
          style={{
            color: customStyles.textColor || undefined,
            containerType: 'size'
          }}
        >
          {isWide ? (
            // WIDE VIEW (Split Layout)
            <div className="flex w-full h-full -m-5">
              {/* Left Panel: Agenda */}
              <div className={`w-1/2 p-5 flex flex-col border-r ${customStyles.textColor ? 'border-current/10' : 'border-zinc-100 dark:border-zinc-800'}`}>
                {/* Date Header */}
                <div className="flex items-start gap-2 mb-4">
                  <span className={`text-5xl font-light tracking-tight leading-none ${customStyles.textColor ? '' : 'text-zinc-900 dark:text-zinc-100'}`}>
                    {dayNumber}
                  </span>
                  <div className="flex flex-col pt-1">
                    <span className={`font-bold text-sm ${customStyles.textColor ? '' : 'text-zinc-900 dark:text-zinc-100'}`}>
                      {dayNameShort}
                    </span>
                    <span className={`text-xs font-medium ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400'}`}>
                      W{getWeekNumber(currentTime)}
                    </span>
                  </div>
                </div>

                {/* Events List */}
                <div className="flex flex-col gap-3 overflow-hidden">
                  {/* Gym Event */}
                  <div className="bg-[#86D749] text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm inline-block self-start">
                    Gym
                  </div>

                  {/* Design Meeting */}
                  <div className="flex gap-2.5 items-start mt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-sm font-bold truncate leading-tight ${customStyles.textColor ? '' : 'text-zinc-800 dark:text-zinc-100'}`}>
                        Design Meeting
                      </span>
                      <span className={`text-[11px] mt-0.5 ${customStyles.textColor ? 'opacity-60' : 'text-zinc-500'}`}>
                        10:00 - 12:00 PM
                      </span>
                      <span className={`text-[11px] ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400'}`}>
                        Room 12
                      </span>
                    </div>
                  </div>

                  {/* Sales Meeting */}
                  <div className="flex gap-2.5 items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className={`text-sm font-bold truncate flex-1 ${customStyles.textColor ? '' : 'text-zinc-800 dark:text-zinc-100'}`}>
                      Sales Meeting
                    </span>
                    <div className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[10px] font-bold">
                      +1
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Calendar Grid */}
              <div className="w-1/2 p-5 flex flex-col">
                <h3 className={`text-center text-sm font-bold mb-3 ${customStyles.textColor ? '' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {monthName} {year}
                </h3>

                <div className="grid grid-cols-7 gap-y-1.5 text-center text-[11px]">
                  {/* Week Header */}
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <span key={i} className={`font-bold ${i === 0 ? 'text-rose-500' :
                        i === 6 ? 'text-blue-500' :
                          (customStyles.textColor ? 'opacity-50' : 'text-zinc-400')
                      }`}>
                      {d}
                    </span>
                  ))}

                  {/* Days Grid */}
                  {getCalendarDays(year, month).map((d, i) => {
                    if (d === null) return <span key={i} />;
                    const isToday = d === dayNumber;
                    const isSunday = (i % 7) === 0;
                    const isSaturday = (i % 7) === 6;

                    return (
                      <div key={i} className="flex items-center justify-center aspect-square">
                        <span className={`
                                            w-6 h-6 flex items-center justify-center rounded-full text-[11px] transition-colors
                                            ${isToday
                            ? 'bg-[#3B5998] text-white font-bold shadow-sm'
                            : (isSunday
                              ? 'text-rose-500 font-medium'
                              : isSaturday
                                ? 'text-blue-500 font-medium'
                                : (customStyles.textColor ? 'opacity-80' : 'text-zinc-600 dark:text-zinc-400')
                            )
                          }
                                        `}>
                          {d}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : isLarge ? (
            // LARGE VIEW (Detailed Vertical)
            <div className="flex flex-col h-full w-full">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4 items-center">
                  <span className={`text-4xl font-bold tracking-tighter ${customStyles.textColor ? '' : 'text-zinc-800 dark:text-zinc-100'}`}>
                    {dayNumber}
                  </span>
                  <div className="flex flex-col justify-center">
                    <span className={`font-semibold text-base leading-tight ${customStyles.textColor ? '' : 'text-zinc-700 dark:text-zinc-200'}`}>
                      {monthName}
                    </span>
                    <span className={`text-xs ${customStyles.textColor ? 'opacity-80' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      Today, {dayName}
                    </span>
                  </div>
                </div>
                <button className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${customStyles.textColor
                    ? 'border-current opacity-60 hover:opacity-100'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Week Strip */}
              <div className="flex justify-between items-center mb-4">
                {getWeekDays().map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className={`text-[9px] font-bold tracking-wider ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400 dark:text-zinc-500'
                      }`}>
                      {d.day}
                    </span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${d.isToday
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                        : (customStyles.textColor ? '' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50')
                      }`}>
                      {d.date}
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className={`h-px w-full mb-3 ${customStyles.textColor ? 'bg-current opacity-10' : 'bg-zinc-100 dark:bg-zinc-800'}`} />

              {/* Detailed Timeline Events */}
              <div className="flex-1 flex flex-col gap-3 overflow-hidden">

                {/* Event 1 */}
                <div className="flex gap-3 relative">
                  {/* Line Marker */}
                  <div className="w-1 rounded-full bg-rose-300 dark:bg-rose-400/80 shrink-0 self-stretch my-0.5"></div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-[10px] mb-0.5 ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400'}`}>
                      10:30 - 12:45 PM
                    </span>
                    <span className={`text-sm font-semibold truncate line-through opacity-50 ${customStyles.textColor ? '' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      DropMode Meetup
                    </span>
                  </div>
                </div>

                {/* Event 2 */}
                <div className="flex gap-3 relative">
                  <div className="w-1 rounded-full bg-rose-500 shrink-0 self-stretch my-0.5"></div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-[10px] mb-0.5 ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400'}`}>
                      1:30 - 2:30 PM
                    </span>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 fill-rose-500/10" />
                      <span className={`text-sm font-bold truncate ${customStyles.textColor ? '' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        1-1 with Olesya
                      </span>
                    </div>
                  </div>
                </div>

                {/* Event 3 */}
                <div className="flex gap-3 relative">
                  <div className="w-1 rounded-full bg-blue-500 shrink-0 self-stretch my-0.5"></div>
                  <div className="flex flex-col overflow-hidden">
                    <span className={`text-[10px] mb-0.5 ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400'}`}>
                      8:20 - 9:37 PM
                    </span>
                    <span className={`text-sm font-semibold truncate ${customStyles.textColor ? '' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      Flight PDX-SFO
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <div className="flex -space-x-1.5">
                    <div className="w-4 h-4 rounded-full bg-orange-400 border border-white dark:border-zinc-900"></div>
                    <div className="w-4 h-4 rounded-full bg-green-400 border border-white dark:border-zinc-900"></div>
                    <div className="w-4 h-4 rounded-full bg-blue-400 border border-white dark:border-zinc-900"></div>
                  </div>
                  <span className={`text-[10px] font-medium ${customStyles.textColor ? 'opacity-60' : 'text-zinc-400'}`}>
                    4 more events
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // SMALL VIEW (Compact)
            <>
              {/* Header */}
              <div className="flex flex-col mb-4">
                <span className={`text-xs font-medium uppercase tracking-wide ${customStyles.textColor ? '' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {dayName.toUpperCase()}
                </span>
                <span className={`text-5xl font-normal leading-none mt-1 ${customStyles.textColor ? '' : 'text-zinc-900 dark:text-zinc-100'}`}>
                  {dayNumber}
                </span>
              </div>

              {/* Events List */}
              <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                {/* Event 1 - Gray Style */}
                <div className={`p-2 rounded-xl flex flex-col justify-center ${customStyles.bgColor ? 'bg-black/5 dark:bg-white/10' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className={`text-xs font-semibold truncate ${customStyles.textColor ? '' : 'text-zinc-800 dark:text-zinc-200'}`}>
                      Kam Birthday
                    </span>
                  </div>
                  <span className={`text-[10px] pl-4 opacity-70 truncate ${customStyles.textColor ? '' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    All Day
                  </span>
                </div>

                {/* Event 2 - Blue Style */}
                <div className="p-2.5 rounded-xl flex flex-col justify-center bg-blue-500 text-white">
                  <span className="text-xs font-semibold truncate">
                    Virtual Team Meeting
                  </span>
                  <span className="text-[10px] opacity-90 truncate">
                    4–5 PM, ACD-US
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
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