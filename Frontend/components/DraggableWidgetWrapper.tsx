import React, { useState, useEffect, useRef } from 'react';
import { GripHorizontal, X } from 'lucide-react';

interface DraggableWidgetWrapperProps {
    id: string;
    position: { x: number; y: number }; // Percentages (0-100)
    size: { width: number; height: number }; // Percentages (0-100)
    onUpdate: (id: string, newPos: { x: number; y: number }, newSize: { width: number; height: number }) => void;
    onRemove?: () => void;
    isLocked: boolean;
    minWidth?: number; // Pixels (converted to % internally for limits)
    minHeight?: number; // Pixels
    canvasRef: React.RefObject<HTMLDivElement>;
    children: React.ReactNode;
    zIndex?: number;
}

export const DraggableWidgetWrapper: React.FC<DraggableWidgetWrapperProps> = ({
    id,
    position,
    size,
    onUpdate,
    onRemove,
    isLocked,
    minWidth = 150,
    minHeight = 100,
    canvasRef,
    children,
    zIndex = 10
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });
    const resizeStartRef = useRef({ x: 0, y: 0, initialW: 0, initialH: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!canvasRef.current) return;

            const containerRect = canvasRef.current.getBoundingClientRect();
            const containerW = containerRect.width;
            const containerH = containerRect.height;

            if (isDragging) {
                const dx = e.clientX - dragStartRef.current.x;
                const dy = e.clientY - dragStartRef.current.y;

                // Convert delta to percentage
                const dxPercent = (dx / containerW) * 100;
                const dyPercent = (dy / containerH) * 100;

                const newX = Math.min(Math.max(0, dragStartRef.current.initialX + dxPercent), 100 - size.width);
                const newY = Math.min(Math.max(0, dragStartRef.current.initialY + dyPercent), 100 - size.height);

                onUpdate(id, { x: newX, y: newY }, size);
            }

            if (isResizing) {
                const dx = e.clientX - resizeStartRef.current.x;
                const dy = e.clientY - resizeStartRef.current.y;

                const dxPercent = (dx / containerW) * 100;
                const dyPercent = (dy / containerH) * 100;

                // Min size constraint (approximate pixel conversion)
                const minWPercent = (minWidth / containerW) * 100;
                const minHPercent = (minHeight / containerH) * 100;

                const newW = Math.max(minWPercent, resizeStartRef.current.initialW + dxPercent);
                const newH = Math.max(minHPercent, resizeStartRef.current.initialH + dyPercent);

                // Ensure doesn't go out of bounds
                const clampedW = Math.min(newW, 100 - position.x);
                const clampedH = Math.min(newH, 100 - position.y);

                onUpdate(id, position, { width: clampedW, height: clampedH });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, canvasRef, position, size, onUpdate, id, minWidth, minHeight]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isLocked) return;
        if (e.button !== 0) return;
        // Don't drag if clicking buttons/inputs
        if ((e.target as HTMLElement).closest('button, input, textarea, .no-drag')) return;

        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            initialX: position.x,
            initialY: position.y
        };
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            initialW: size.width,
            initialH: size.height
        };
    };

    return (
        <div
            className={`absolute group ${isLocked ? '' : 'cursor-move'}`}
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                width: `${size.width}%`,
                height: `${size.height}%`,
                zIndex: isDragging || isResizing ? 50 : zIndex
            }}
            onMouseDown={handleMouseDown}
        >
            {/* Render children - they should fill the container */}
            <div className="w-full h-full relative">
                {children}
            </div>

            {/* Controls Layer */}
            {!isLocked && (
                <>
                    {/* Remove Handle - Top Left */}
                    {onRemove && (
                        <div
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="absolute -top-2 -left-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 active:scale-95"
                            title="Remove Widget"
                        >
                            <X className="w-3 h-3" />
                        </div>
                    )}

                    {/* Resize Handle - Bottom Right */}
                    <div
                        onMouseDown={handleResizeStart}
                        className="absolute bottom-1 right-1 z-30 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity p-2 text-zinc-500/50 hover:text-zinc-800/80"
                    >
                        <GripHorizontal className="w-5 h-5 pointer-events-none" />
                    </div>
                </>
            )}
        </div>
    );
};
