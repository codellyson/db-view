'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ResizableSplitterProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  left,
  right,
  defaultWidth = 240,
  minWidth = 160,
  maxWidth = 600,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(defaultWidth);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + deltaX)
      );
      setWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      e.preventDefault();
      const deltaX = e.touches[0].clientX - startXRef.current;
      const newWidth = Math.max(
        minWidth,
        Math.min(maxWidth, startWidthRef.current + deltaX)
      );
      setWidth(newWidth);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minWidth, maxWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startXRef.current = e.touches[0].clientX;
    startWidthRef.current = width;
  };

  return (
    <div ref={containerRef} className="flex h-screen">
      {/* Left panel: hidden on mobile */}
      <div
        style={{ width: `${width}px` }}
        className="flex-shrink-0 hidden md:block"
      >
        {left}
      </div>
      {/* Splitter bar: hidden on mobile */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`w-2 bg-black dark:bg-white cursor-col-resize flex-shrink-0 hover:bg-black dark:hover:bg-white relative hidden md:flex ${
          isDragging ? 'bg-black dark:bg-white' : ''
        }`}
        style={{ cursor: 'col-resize' }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            setWidth((w) => Math.max(minWidth, w - 20));
          } else if (e.key === 'ArrowRight') {
            setWidth((w) => Math.min(maxWidth, w + 20));
          }
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-0.5 h-12 bg-white dark:bg-black"></div>
        </div>
      </div>
      {/* Right panel: full width on mobile */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {right}
      </div>
    </div>
  );
};
