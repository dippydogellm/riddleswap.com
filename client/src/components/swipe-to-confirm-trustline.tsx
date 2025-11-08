import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TokenSearchResult } from '@/lib/token-api';

interface SwipeToConfirmTrustlineProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  token: TokenSearchResult | null;
  isLoading: boolean;
}

export function SwipeToConfirmTrustline({ 
  isOpen, 
  onClose, 
  onConfirm, 
  token, 
  isLoading 
}: SwipeToConfirmTrustlineProps) {
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 0.8; // 80% of the way

  useEffect(() => {
    if (!isOpen) {
      setSwipeProgress(0);
      setIsDragging(false);
      setIsConfirmed(false);
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLoading || isConfirmed) return;
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLoading || isConfirmed) return;
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  };

  const handleMove = (clientX: number) => {
    if (!containerRef.current || !isDragging) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width - 60; // Account for button width
    const relativeX = clientX - containerRect.left - 30; // Account for button radius
    
    const progress = Math.max(0, Math.min(1, relativeX / containerWidth));
    setSwipeProgress(progress);

    if (progress >= SWIPE_THRESHOLD && !isConfirmed) {
      setIsConfirmed(true);
      setIsDragging(false);
      setTimeout(() => {
        onConfirm();
      }, 200);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    }
  };

  const handleEnd = () => {
    if (!isConfirmed) {
      setSwipeProgress(0);
    }
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const handleMouseMoveGlobal = (e: MouseEvent) => handleMove(e.clientX);
      const handleTouchMoveGlobal = (e: TouchEvent) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX);
      };

      document.addEventListener('mousemove', handleMouseMoveGlobal);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
      document.addEventListener('touchend', handleEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMoveGlobal);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleTouchMoveGlobal);
        document.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging]);

  if (!token) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-purple-900/95 via-blue-900/95 to-indigo-900/95 border-purple-500/20">
        <DialogHeader>
          <DialogTitle className="text-center text-white text-xl font-bold">
            Create Trustline
          </DialogTitle>
          <DialogDescription className="text-center text-gray-300">
            Swipe to create a trustline for {token?.symbol} tokens
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 p-4">
          {/* Token Info */}
          <div className="flex items-center justify-center space-x-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <img 
              src={token.icon_url || token.logo_url || '/images/chains/xrp-logo.png'} 
              alt={token.symbol}
              className="w-12 h-12 rounded-full"
            />
            <div className="text-center">
              <h3 className="text-white font-bold text-lg">{token.symbol}</h3>
              <p className="text-gray-300 text-sm">{token.name}</p>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-lg p-3">
            <p className="text-yellow-200 text-sm text-center">
              This will create a trustline allowing you to hold {token.symbol} tokens. 
              Swipe to confirm this action.
            </p>
          </div>

          {/* Swipe Bar */}
          <div className="relative">
            <div 
              ref={containerRef}
              className="relative w-full h-16 bg-gray-700/50 rounded-full border-2 border-purple-500/30 overflow-hidden"
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
            >
              {/* Progress Background */}
              <div 
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-100 ease-out rounded-full"
                style={{ width: `${swipeProgress * 100}%` }}
              />
              
              {/* Swipe Button */}
              <div 
                ref={sliderRef}
                className={`absolute top-1 left-1 w-14 h-14 bg-white rounded-full shadow-lg cursor-pointer transition-all duration-100 ease-out flex items-center justify-center ${
                  isDragging ? 'scale-105' : 'scale-100'
                } ${isConfirmed ? 'bg-green-500' : 'bg-white'}`}
                style={{ 
                  transform: `translateX(${swipeProgress * ((containerRef.current?.offsetWidth || 240) - 60)}px)` 
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                {isConfirmed ? (
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isLoading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                ) : (
                  <img 
                    src={token.icon_url || token.logo_url || '/images/chains/xrp-logo.png'} 
                    alt={token.symbol}
                    className="w-10 h-10 rounded-full"
                  />
                )}
              </div>

              {/* Swipe Text */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className={`text-white font-medium transition-opacity duration-200 ${
                  swipeProgress > 0.3 ? 'opacity-0' : 'opacity-100'
                }`}>
                  {isLoading ? 'Creating...' : `Swipe to create ${token.symbol} trustline`}
                </span>
              </div>
            </div>
          </div>

          {/* Cancel Button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gray-600/50 hover:bg-gray-600/70 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
