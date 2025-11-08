import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ArrowRight } from 'lucide-react';

interface SwipeConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
  text?: string;
  successText?: string;
  className?: string;
}

export default function SwipeConfirm({
  onConfirm,
  disabled = false,
  text = "Swipe to confirm swap",
  successText = "Confirming...",
  className = ""
}: SwipeConfirmProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  const handleStart = (clientX: number) => {
    if (disabled || isConfirmed) return;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !containerRef.current || !thumbRef.current || disabled) return;

    const container = containerRef.current;
    const thumb = thumbRef.current;
    const containerRect = container.getBoundingClientRect();
    const thumbWidth = thumb.offsetWidth;
    const maxPosition = containerRect.width - thumbWidth;

    let newPosition = clientX - containerRect.left - thumbWidth / 2;
    newPosition = Math.max(0, Math.min(newPosition, maxPosition));

    setDragPosition(newPosition);

    // Check if we've reached the end (85% of the way)
    if (newPosition >= maxPosition * 0.85) {
      setIsConfirmed(true);
      setIsDragging(false);
      onConfirm();
    }
  };

  const handleEnd = () => {
    if (!isConfirmed) {
      setDragPosition(0);
    }
    setIsDragging(false);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    handleEnd();
  };

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  // Reset when disabled changes
  useEffect(() => {
    if (disabled) {
      setIsConfirmed(false);
      setDragPosition(0);
      setIsDragging(false);
    }
  }, [disabled]);

  const progressPercentage = containerRef.current 
    ? (dragPosition / (containerRef.current.offsetWidth - (thumbRef.current?.offsetWidth || 48))) * 100
    : 0;

  return (
    <div 
      ref={containerRef}
      className={`
        relative h-12 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-950 dark:to-blue-900
        rounded-full border-2 border-blue-200 dark:border-blue-800 
        overflow-hidden cursor-pointer select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isConfirmed ? 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800' : ''}
        ${className}
      `}
    >
      {/* Progress background */}
      <div 
        className={`
          absolute inset-0 rounded-full transition-all duration-200
          ${isConfirmed 
            ? 'bg-gradient-to-r from-green-400 to-green-300 dark:from-green-600 dark:to-green-500' 
            : 'bg-gradient-to-r from-blue-400 to-blue-300 dark:from-blue-600 dark:to-blue-500'
          }
        `}
        style={{ 
          width: `${Math.max(progressPercentage, 0)}%`,
          opacity: Math.max(progressPercentage / 100, 0.1)
        }}
      />

      {/* Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`
          text-sm font-medium transition-all duration-200
          ${isConfirmed 
            ? 'text-green-700 dark:text-green-300' 
            : progressPercentage > 50 
              ? 'text-white dark:text-white' 
              : 'text-blue-700 dark:text-blue-300'
          }
        `}>
          {isConfirmed ? successText : text}
        </span>
      </div>

      {/* Draggable thumb */}
      <div
        ref={thumbRef}
        className={`
          absolute top-1 left-1 h-10 w-10 rounded-full 
          bg-white dark:bg-gray-800 shadow-lg border-2
          flex items-center justify-center cursor-grab
          transition-all duration-200 transform
          ${isDragging ? 'scale-110 cursor-grabbing' : 'scale-100'}
          ${isConfirmed 
            ? 'border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900' 
            : 'border-blue-300 dark:border-blue-600'
          }
          ${disabled ? 'cursor-not-allowed' : ''}
        `}
        style={{
          transform: `translateX(${dragPosition}px) ${isDragging ? 'scale(1.1)' : 'scale(1)'}`
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {isConfirmed ? (
          <div className="animate-spin">
            <div className="h-4 w-4 border-2 border-green-600 dark:border-green-400 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <ChevronRight className={`
              h-4 w-4 transition-all duration-200
              ${progressPercentage > 50 ? 'text-white' : 'text-blue-600 dark:text-blue-400'}
            `} />
            {progressPercentage > 20 && (
              <ArrowRight className={`
                h-3 w-3 ml-1 transition-all duration-200
                ${progressPercentage > 50 ? 'text-white' : 'text-blue-500 dark:text-blue-300'}
              `} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
