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

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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

  return (
    <div ref={containerRef} className="flex h-screen">
      <div style={{ width: `${width}px` }} className="flex-shrink-0">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`w-2 bg-black cursor-col-resize flex-shrink-0 hover:bg-black relative ${
          isDragging ? 'bg-black' : ''
        }`}
        style={{ cursor: 'col-resize' }}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-0.5 h-12 bg-white"></div>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {right}
      </div>
    </div>
  );
};

