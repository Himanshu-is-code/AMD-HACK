import React, { useRef, useEffect, useState } from 'react';
import { handleGoogleLogin } from '../utils/auth';
import { getAuthStatus, logoutGoogle, getGoogleUser } from '../services/agentService';
import { Paperclip, PanelLeft, Bot, ListTodo, Settings, UserCircle, Plus, Search, LayoutGrid, Clock, MinusCircle, Calendar, HardDrive, Mail, StickyNote, TrendingUp, Move, Lock, Unlock, Eye, EyeOff, GripVertical, Globe, File, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Role } from '../types';
import { ClockWidget } from './ClockWidget';
import { CalendarWidget } from './CalendarWidget';
import { DriveWidget } from './DriveWidget';
import { EmailWidget } from './EmailWidget';
import { NotesWidget } from './NotesWidget';
import { StockWidget } from './StockWidget';
import { DraggableWidgetWrapper } from './DraggableWidgetWrapper';

interface ChatAreaProps {
    messages: Message[];
    onSendMessage: (content: string, file?: File | null, isWebSearch?: boolean) => void;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    isLoading: boolean;
    activeTaskStatus: string | null;
    activeTaskId: string | null;
    apiKey: string;
    onResumeWithGemini?: () => Promise<void>;
}

interface WidgetInstance {
    id: string;
    type: 'clock' | 'calendar-small' | 'calendar-large' | 'calendar-wide' | 'drive' | 'email' | 'notes' | 'stock';
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    w: number; // Percentage 0-100
    h: number; // Percentage 0-100
    isLeaving?: boolean;
}



const Timer = () => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setSeconds(s => s + 0.1), 100);
        return () => clearInterval(interval);
    }, []);
    return <span className="text-xs text-zinc-400 font-mono ml-2">{seconds.toFixed(1)}s</span>;
};

export const ChatArea: React.FC<ChatAreaProps> = ({
    messages,
    onSendMessage,
    isSidebarOpen,
    toggleSidebar,
    isLoading,
    activeTaskStatus,
    activeTaskId,
    apiKey,
    onResumeWithGemini
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Copilot State
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isWebSearch, setIsWebSearch] = useState(false);

    // Widget State
    const [widgets, setWidgets] = useState<WidgetInstance[]>([]);
    const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [isWidgetsLocked, setIsWidgetsLocked] = useState(false);
    const [areWidgetsVisible, setAreWidgetsVisible] = useState(true);
    const [isWidgetsLeaving, setIsWidgetsLeaving] = useState(false);

    const toggleWidgetsVisible = () => {
        if (areWidgetsVisible) {
            // Trigger exit animation on every widget, then unmount after it plays
            setIsWidgetsLeaving(true);
            setTimeout(() => {
                setAreWidgetsVisible(false);
                setIsWidgetsLeaving(false);
            }, 350);
        } else {
            setAreWidgetsVisible(true);
        }
    };

    // Floating Input State
    const [inputPos, setInputPos] = useState<{ x: number | null, y: number | null }>({ x: null, y: null });
    const [inputWidth, setInputWidth] = useState<number>(360);
    const [isInputDragging, setIsInputDragging] = useState(false);
    const [isInputResizing, setIsInputResizing] = useState(false);
    const [hasUserMovedInput, setHasUserMovedInput] = useState(false);
    const inputDragStartRef = useRef({ x: 0, y: 0 });
    const inputResizeStartRef = useRef({ x: 0, width: 0 });
    const [isResuming, setIsResuming] = useState(false);
    // Initialize from LocalStorage for instant UI
    const [isGoogleConnected, setIsGoogleConnected] = useState(() => {
        return localStorage.getItem('isGoogleConnected') === 'true';
    });
    const [googleUser, setGoogleUser] = useState<{ name: string, picture: string, email: string } | null>(() => {
        const saved = localStorage.getItem('googleUser');
        return saved ? JSON.parse(saved) : null;
    });


    // Initial Auth & Settings Check
    useEffect(() => {
        const checkAuth = async () => {
            // verified status from backend
            const authStatus = await getAuthStatus();
            setIsGoogleConnected(authStatus.connected);
            localStorage.setItem('isGoogleConnected', String(authStatus.connected));

            if (authStatus.connected) {
                const user = await getGoogleUser();
                setGoogleUser(user);
                if (user) localStorage.setItem('googleUser', JSON.stringify(user));
            } else {
                setGoogleUser(null);
                localStorage.removeItem('googleUser');
            }


        };

        checkAuth();

        window.addEventListener('google-auth-changed', checkAuth);
        return () => window.removeEventListener('google-auth-changed', checkAuth);
    }, []);

    const isEmpty = messages.length === 0;
    const isExpanded = isFocused || inputValue.trim().length > 0 || selectedFile !== null;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if ((inputValue.trim() || selectedFile) && !isLoading) {
            onSendMessage(inputValue, selectedFile, isWebSearch);
            setInputValue('');
            setSelectedFile(null);
            // Optionally leave web search toggled based on preference, resetting it for now
            // setIsWebSearch(false);
            setIsFocused(false);
            if (textareaRef.current) {
                textareaRef.current.blur();
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
            setIsFocused(true); // Keep UI expanded
        }
    };

    const handleResumeTask = async () => {
        if (onResumeWithGemini) {
            setIsResuming(true);
            await onResumeWithGemini();
            setIsResuming(false);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            if (isExpanded) {
                textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
            }
        }
    }, [inputValue, isExpanded]);

    // Widget Actions
    const updateWidget = (id: string, pos: { x: number, y: number }, size: { width: number, height: number }) => {
        setWidgets(prev => prev.map(w => {
            if (w.id === id) {
                return { ...w, x: pos.x, y: pos.y, w: size.width, h: size.height };
            }
            return w;
        }));
    };

    const addWidget = (type: WidgetInstance['type'], position?: { x: number, y: number }) => {
        let defaultW = 20;
        let defaultH = 20;

        // Set dimensions based on variant/type
        switch (type) {
            case 'clock': defaultW = 15; defaultH = 15; break;
            case 'calendar-small': defaultW = 15; defaultH = 15; break;
            case 'calendar-large': defaultW = 20; defaultH = 35; break;
            case 'calendar-wide': defaultW = 40; defaultH = 25; break;
            case 'drive': defaultW = 22; defaultH = 28; break;
            case 'email': defaultW = 25; defaultH = 32; break;
            case 'notes': defaultW = 18; defaultH = 22; break;
            case 'stock': defaultW = 22; defaultH = 28; break;
        }

        let defaultX = 10 + Math.random() * 60;
        let defaultY = 10 + Math.random() * 60;

        const newWidget: WidgetInstance = {
            id: Date.now().toString(),
            type,
            x: position?.x ?? defaultX,
            y: position?.y ?? defaultY,
            w: defaultW,
            h: defaultH
        };
        setWidgets(prev => [...prev, newWidget]);
        setIsWidgetMenuOpen(false);
        if (!areWidgetsVisible) setAreWidgetsVisible(true);
    };

    const removeWidget = (id: string) => {
        // Mark it as leaving to trigger exit animation
        setWidgets(prev => prev.map(w => w.id === id ? { ...w, isLeaving: true } : w));
        // After animation completes, actually remove it
        setTimeout(() => {
            setWidgets(prev => prev.filter(w => w.id !== id));
        }, 300);
    };

    const handleDragStart = (e: React.DragEvent, type: WidgetInstance['type']) => {
        e.dataTransfer.setData('widgetType', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('widgetType') as WidgetInstance['type'];
        if (type && chatContainerRef.current) {
            const rect = chatContainerRef.current.getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;

            let xPerc = (rawX / rect.width) * 100 - 10;
            let yPerc = (rawY / rect.height) * 100 - 10;

            xPerc = Math.max(0, Math.min(80, xPerc));
            yPerc = Math.max(0, Math.min(80, yPerc));

            addWidget(type, { x: xPerc, y: yPerc });
        }
    };

    // Floating Input Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isInputDragging && inputPos.x !== null && inputPos.y !== null) {
                const dx = e.clientX - inputDragStartRef.current.x;
                const dy = e.clientY - inputDragStartRef.current.y;
                setInputPos({
                    x: inputPos.x + dx,
                    y: inputPos.y + dy
                });
                inputDragStartRef.current = { x: e.clientX, y: e.clientY };
            }
            if (isInputResizing) {
                const dx = e.clientX - inputResizeStartRef.current.x;
                const newWidth = Math.max(300, Math.min(1200, inputResizeStartRef.current.width + dx));
                setInputWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsInputDragging(false);
            setIsInputResizing(false);
        };

        if (isInputDragging || isInputResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isInputDragging, isInputResizing, inputPos]);

    useEffect(() => {
        if (!isEmpty) setHasUserMovedInput(false);
    }, [isEmpty]);

    useEffect(() => {
        const handleResize = () => {
            const container = document.getElementById('chat-container');
            if (!container) return;
            const { clientWidth, clientHeight } = container;

            if (!hasUserMovedInput && isEmpty) {
                setInputPos({
                    x: (clientWidth - inputWidth) / 2,
                    y: (clientHeight / 2) - 50
                });
            } else if (hasUserMovedInput && isEmpty) {
                setInputPos(prev => {
                    if (prev.x === null || prev.y === null) return prev;
                    const clampedX = Math.min(Math.max(0, prev.x), clientWidth - 50);
                    const clampedY = Math.min(Math.max(0, prev.y), clientHeight - 50);
                    return { x: clampedX, y: clampedY };
                });
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isEmpty, inputWidth, hasUserMovedInput, isSidebarOpen]);

    const [statusColor, setStatusColor] = useState('text-zinc-500');

    // Compute the search-bar centre in canvas-% coords for widget spawn animation.
    const getInputCenterPerc = (): { x: number; y: number } => {
        const container = chatContainerRef.current;
        if (!container || inputPos.x === null || inputPos.y === null) {
            return { x: 50, y: 95 }; // fallback: bottom-centre
        }
        const { clientWidth, clientHeight } = container;
        return {
            x: ((inputPos.x + inputWidth / 2) / clientWidth) * 100,
            y: ((inputPos.y + 24) / clientHeight) * 100, // 24 ≈ half of the 48px collapsed bar height
        };
    };

    useEffect(() => {
        if (!activeTaskStatus) return;
        switch (activeTaskStatus) {
            case 'planned': setStatusColor('text-blue-500'); break;
            case 'waiting_for_internet': setStatusColor('text-yellow-500'); break;
            case 'executing': setStatusColor('text-purple-500 animate-pulse'); break;
            case 'completed': setStatusColor('text-green-500'); break;
            default: setStatusColor('text-zinc-500');
        }
    }, [activeTaskStatus]);

    // Compute style for the floating/docked input bar.
    // Always anchor at bottom:32px and use translateY to push to vertical center when empty.
    // This means the transition is purely on `transform`, which CSS can interpolate smoothly.
    const inputBarStyle: React.CSSProperties = (() => {
        const containerH = chatContainerRef.current?.clientHeight ?? 0;
        const containerW = chatContainerRef.current?.clientWidth ?? 0;
        // From bottom:32px, the pill center is at containerH - 56px from top.
        // To reach vertical center (containerH/2), translateY = -(containerH/2 - (containerH - 56)) = -(56 - containerH/2)
        const upOffset = containerH > 0 ? -(containerH / 2 - 56) : 0;
        const dockedWidth = containerW > 0 ? `${Math.min(containerW - 32, 672)}px` : '100%';
        const isDragged = hasUserMovedInput && inputPos.x !== null && isEmpty;
        const canAnimate = !isInputDragging && !isInputResizing && !isDragged;

        if (isDragged) {
            return { left: `${inputPos.x}px`, top: `${inputPos.y}px`, width: `${inputWidth}px`, maxWidth: '90vw' };
        }
        return {
            left: '50%',
            bottom: '32px',
            width: isEmpty ? `${inputWidth}px` : dockedWidth,
            padding: isEmpty ? undefined : '0 0.5rem',
            transform: isEmpty ? `translateX(-50%) translateY(${upOffset}px)` : 'translateX(-50%)',
            transition: canAnimate
                ? 'transform 520ms cubic-bezier(0.4, 0, 0.2, 1), width 520ms cubic-bezier(0.4, 0, 0.2, 1)'
                : undefined,
        };
    })();

    return (
        <div
            id="chat-container"
            ref={chatContainerRef}
            className="flex-1 flex flex-col h-full relative bg-zinc-50/50 dark:bg-zinc-950 transition-colors duration-200 overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Active Widgets – keep mounted while leaving so the exit animation can play */}
            {(areWidgetsVisible || isWidgetsLeaving) && (
                <div className={`absolute inset-0 z-0 transition-all duration-700 ease-in-out ${!isEmpty ? 'blur-md opacity-40 pointer-events-none' : ''}`}>
                    {widgets.map(widget => (
                        <DraggableWidgetWrapper
                            key={widget.id}
                            id={widget.id}
                            position={{ x: widget.x, y: widget.y }}
                            size={{ width: widget.w, height: widget.h }}
                            onUpdate={updateWidget}
                            onRemove={() => removeWidget(widget.id)}
                            isLocked={isWidgetsLocked}
                            isLeaving={widget.isLeaving || isWidgetsLeaving}
                            originPoint={getInputCenterPerc()}
                            canvasRef={chatContainerRef}
                        >
                            {widget.type === 'clock' && <ClockWidget id={widget.id} isLocked={isWidgetsLocked} />}
                            {widget.type === 'calendar-small' && <CalendarWidget id={widget.id} variant="small" isLocked={isWidgetsLocked} />}
                            {widget.type === 'calendar-large' && <CalendarWidget id={widget.id} variant="large" isLocked={isWidgetsLocked} />}
                            {widget.type === 'calendar-wide' && <CalendarWidget id={widget.id} variant="wide" isLocked={isWidgetsLocked} />}
                            {widget.type === 'drive' && <DriveWidget id={widget.id} isLocked={isWidgetsLocked} />}
                            {widget.type === 'email' && <EmailWidget id={widget.id} isLocked={isWidgetsLocked} />}
                            {widget.type === 'notes' && <NotesWidget id={widget.id} isLocked={isWidgetsLocked} />}
                            {widget.type === 'stock' && <StockWidget id={widget.id} isLocked={isWidgetsLocked} />}
                        </DraggableWidgetWrapper>
                    ))}
                </div>
            )}

            {/* Top Navigation Bar / Taskbar */}
            <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 z-10 relative">
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 -ml-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
                    >
                        <PanelLeft className="w-5 h-5" />
                    </button>
                    <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                    <button className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
                        <ListTodo className="w-4 h-4" />
                        <span>Tasks</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setIsWidgetMenuOpen(!isWidgetMenuOpen)}
                                className={`flex items-center gap-2 text-sm font-medium transition-colors ${isWidgetMenuOpen ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                <span className={isWidgetMenuOpen ? 'text-blue-600 dark:text-blue-400' : ''}>Widgets</span>
                            </button>

                            {isWidgetMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-[80vh] overflow-y-auto">
                                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-500 px-2 py-1 mb-1 uppercase tracking-wider">Available</div>
                                    {[
                                        { type: 'clock', icon: Clock, label: 'Clock', sub: 'Time & Date' },
                                        { type: 'calendar-small', icon: Calendar, label: 'Calendar (Small)', sub: 'Compact Day' },
                                        { type: 'calendar-large', icon: Calendar, label: 'Calendar (Large)', sub: 'Detailed Agenda' },
                                        { type: 'calendar-wide', icon: Calendar, label: 'Calendar (Wide)', sub: 'Month & Tasks' },
                                        { type: 'drive', icon: HardDrive, label: 'Drive', sub: 'Files & Storage' },
                                        { type: 'email', icon: Mail, label: 'Email', sub: 'Inbox' },
                                        { type: 'notes', icon: StickyNote, label: 'Notes', sub: 'Post-it' },
                                        { type: 'stock', icon: TrendingUp, label: 'Stocks', sub: 'Market Graph' },
                                    ].map((item) => (
                                        <div
                                            key={item.type}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, item.type as any)}
                                            onClick={() => addWidget(item.type as any)}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-grab active:cursor-grabbing transition-colors group mb-1"
                                        >
                                            <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                                <item.icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">{item.label}</span>
                                                <span className="text-[10px] text-zinc-500 truncate">{item.sub}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {widgets.length > 0 && (
                                        <>
                                            <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1.5" />
                                            <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-500 px-2 py-1 mb-1 uppercase tracking-wider">Active</div>
                                            <div className="space-y-1">
                                                {widgets.map((widget, index) => (
                                                    <div key={widget.id} className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                                <LayoutGrid className="w-3 h-3 text-zinc-500" />
                                                            </div>
                                                            <span className="text-sm text-zinc-600 dark:text-zinc-400 capitalize truncate">{widget.type.replace('-', ' ')}</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded-md transition-colors"
                                                        >
                                                            <MinusCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Widget Controls */}
                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700">
                            <button
                                onClick={() => setIsWidgetsLocked(!isWidgetsLocked)}
                                className={`p-1.5 rounded-md transition-all ${isWidgetsLocked ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                                title={isWidgetsLocked ? "Unlock Widgets" : "Lock Widgets"}
                            >
                                {isWidgetsLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                            <button
                                onClick={toggleWidgetsVisible}
                                className={`p-1.5 rounded-md transition-all ${!areWidgetsVisible ? 'bg-white dark:bg-zinc-600 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                                title={areWidgetsVisible ? "Hide Widgets" : "Show Widgets"}
                            >
                                {areWidgetsVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">

                    <div className="relative">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`p-2 rounded-md transition-colors ${isSettingsOpen ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400'}`}
                        >
                            <Settings className="w-4 h-4" />
                        </button>

                        {isSettingsOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-zinc-900 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-500 px-2 py-1 mb-1 uppercase tracking-wider">Settings</div>

                                {googleUser && (
                                    <div className="flex items-center justify-between p-2 rounded-md bg-zinc-50 dark:bg-zinc-800/50 mb-2 border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <img src={googleUser.picture} alt="Profile" className="w-6 h-6 rounded-full flex-shrink-0" />
                                            <div className="col flex flex-col min-w-0">
                                                <span className="text-xs font-medium truncate">{googleUser.name}</span>
                                                <span className="text-[10px] text-zinc-500 truncate">{googleUser.email}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                await logoutGoogle();
                                                setIsGoogleConnected(false);
                                                setGoogleUser(null);
                                                setIsSettingsOpen(false);
                                            }}
                                            className="ml-2 text-xs text-red-500 hover:underline flex-shrink-0"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                )}

                                {!googleUser && (
                                    <button
                                        onClick={handleGoogleLogin}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium text-blue-700 dark:text-blue-300 shadow-sm"
                                    >
                                        <Calendar className="w-4 h-4" />
                                        Connect Google
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {googleUser ? (
                        <div className="flex items-center gap-2 pl-1 pr-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
                            <img src={googleUser.picture} alt="Profile" className="w-6 h-6 rounded-full" />
                            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-[100px] truncate">{googleUser.name}</span>
                        </div>
                    ) : (
                        <button
                            onClick={handleGoogleLogin}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                        >
                            <UserCircle className="w-5 h-5" />
                            <span className="text-xs font-medium">Sign In</span>
                        </button>
                    )}
                </div>

                {/* Overlay for menus */}
                {(isWidgetMenuOpen || isSettingsOpen) && (
                    <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => {
                            setIsWidgetMenuOpen(false);
                            setIsSettingsOpen(false);
                        }}
                    />
                )}
            </div>

            <div className="flex-1 flex flex-col relative min-h-0 z-0 pointer-events-none">
                <div className={`flex-1 overflow-y-auto px-4 md:px-6 scroll-smooth z-0 pointer-events-auto ${isEmpty ? 'invisible' : 'visible'}`}>
                    <div className="max-w-3xl mx-auto space-y-6 pb-32 pt-4">
                        {messages.map((msg, index) => (
                            <div key={msg.id} className={`flex gap-4 ${msg.role === Role.USER ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === Role.USER ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'}`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                            a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2" {...props} />,
                                            li: ({ node, ...props }) => <li className="mb-1" {...props} />,
                                            h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0" {...props} />,
                                            h2: ({ node, ...props }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                                            h3: ({ node, ...props }) => <h3 className="text-base font-bold mb-2 mt-2" {...props} />,
                                            code: ({ node, ...props }) => <code className="bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400" {...props} />,
                                            pre: ({ node, ...props }) => <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto mb-3 text-xs font-mono" {...props} />,
                                            blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 py-1 italic text-zinc-600 dark:text-zinc-400 mb-2" {...props} />,
                                            table: ({ node, ...props }) => <div className="overflow-x-auto mb-3"><table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg" {...props} /></div>,
                                            th: ({ node, ...props }) => <th className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider" {...props} />,
                                            td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-nowrap text-sm text-zinc-700 dark:text-zinc-300 border-t border-zinc-200 dark:border-zinc-700" {...props} />,
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                    {msg.latency && <div className="text-[10px] text-zinc-400 mt-2 text-right">{(msg.latency / 1000).toFixed(1)}s</div>}

                                    {/* Resume Button inside Bubble */}
                                    {msg.role === Role.MODEL && index === messages.length - 1 && (
                                        ['news', 'weather', 'stock', 'latest', 'schedule', 'price'].some(k => msg.content.toLowerCase().includes(k))
                                    ) && (
                                            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                                                <button
                                                    onClick={handleResumeTask}
                                                    disabled={isResuming}
                                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                                                >
                                                    {isResuming ? (
                                                        <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Search className="w-3 h-3" />
                                                    )}
                                                    <span>Search Web with Gemini</span>
                                                </button>
                                                <p className="text-[10px] text-zinc-500 mt-2 text-center">This action requires internet access.</p>
                                            </div>
                                        )}

                                    {/* Display Sources */}
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                                <Search className="w-3 h-3" />
                                                <span>SOURCES</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {msg.sources.map((source, idx) => {
                                                    let hostname = "";
                                                    try {
                                                        hostname = new URL(source.url).hostname.replace('www.', '');
                                                    } catch (e) {
                                                        hostname = source.url;
                                                    }
                                                    return (
                                                        <a
                                                            key={idx}
                                                            href={source.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 pl-1 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-xs text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700"
                                                        >
                                                            <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold">
                                                                {idx + 1}
                                                            </div>
                                                            <span className="truncate max-w-[150px] font-medium">{hostname}</span>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-4 justify-start">
                                <div className="flex items-center gap-2 mt-2 p-2">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                        <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                    </div>
                                    <Timer />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Outer input positioner: always bottom:32px, slides via translateY */}
                <div className="absolute z-20 pointer-events-auto group/input" style={inputBarStyle}>
                    {areWidgetsVisible && !isWidgetsLocked && isEmpty && (
                        <>
                            <div className="absolute left-0 top-0 bottom-0 w-6 -ml-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/input:opacity-100 transition-opacity text-zinc-400" onMouseDown={(e) => { e.preventDefault(); setIsInputDragging(true); setHasUserMovedInput(true); inputDragStartRef.current = { x: e.clientX, y: e.clientY }; }}>
                                <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="absolute right-0 top-0 bottom-0 w-4 -mr-6 flex items-center justify-center cursor-ew-resize opacity-0 group-hover/input:opacity-100 transition-opacity text-zinc-400" onMouseDown={(e) => { e.preventDefault(); setIsInputResizing(true); inputResizeStartRef.current = { x: e.clientX, width: inputWidth }; }}>
                                <GripVertical className="w-5 h-5" />
                            </div>
                        </>
                    )}

                    <div className="w-full mx-auto flex flex-col items-center">
                        <div className={`w-full relative transition-all duration-300 overflow-hidden ${isExpanded ? 'bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl border border-zinc-200/60 dark:border-zinc-800 p-4' : 'bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-700/50 rounded-full h-12 cursor-text shadow-xl'}`} onClick={() => { if (!isExpanded) { setIsFocused(true); setTimeout(() => textareaRef.current?.focus(), 10); } }}>
                            <div className={`absolute inset-0 flex items-center justify-center gap-2 text-zinc-500 transition-opacity duration-200 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                <Search className="w-4 h-4" />
                                <span className="text-sm font-medium">Ask Anything</span>
                            </div>
                            <div className={`flex flex-col ${isExpanded ? 'opacity-100' : 'opacity-0 invisible absolute inset-0'}`}>
                                {/* Optional: Show selected file indicator */}
                                {selectedFile && (
                                    <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 w-max max-w-[80%]">
                                        <File className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                        <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-medium">{selectedFile.name}</span>
                                        <button onClick={() => setSelectedFile(null)} className="ml-1 text-zinc-400 hover:text-red-500 transition-colors">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                                <textarea ref={textareaRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} onFocus={() => setIsFocused(true)} onBlur={() => { if (!inputValue.trim() && !selectedFile) setIsFocused(false); }} placeholder="Ask Anything" rows={1} className="w-full bg-transparent border-none focus:ring-0 p-1 text-base text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 resize-none min-h-[48px] max-h-48" style={{ height: 'auto' }} />
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                            accept=".pdf,.doc,.docx,.txt"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`p-2 rounded-full transition-colors ${selectedFile ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                            title="Attach File"
                                        >
                                            <Paperclip className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setIsWebSearch(!isWebSearch)}
                                            className={`p-2 rounded-full transition-colors ${isWebSearch ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                            title="Search Web"
                                        >
                                            <Globe className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button onClick={handleSend} disabled={(!inputValue.trim() && !selectedFile) || isLoading} className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all ${(inputValue.trim() || selectedFile) && !isLoading ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'}`}>
                                        {isLoading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /><span>Send</span></>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Task Status Indicator */}
                        {activeTaskStatus && (
                            <div className="flex flex-col items-center gap-2 mt-3">
                                <div className={`flex items-center gap-2 text-xs font-mono font-medium tracking-wide uppercase px-3 py-1.5 rounded-full bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm animate-in slide-in-from-bottom-2 fade-in duration-500 ${statusColor}`}>
                                    <div className={`w-2 h-2 rounded-full ${activeTaskStatus === 'executing' ? 'animate-pulse bg-current' : 'bg-current'}`} />
                                    <span className="opacity-90">{activeTaskStatus.replace(/_/g, ' ')}</span>
                                </div>

                                {activeTaskStatus === 'waiting_for_internet' && (
                                    <div />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
