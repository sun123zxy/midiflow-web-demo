import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ResizableSplitProps {
  top: ReactNode;
  bottom: ReactNode;
  defaultSplit?: number; // 0-100, percentage for top pane
}

export function ResizableSplit({ top, bottom, defaultSplit = 50 }: ResizableSplitProps) {
  const [splitPercentage, setSplitPercentage] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const percentage = ((e.clientY - rect.top) / rect.height) * 100;
      
      // Clamp between 20% and 80%
      const clampedPercentage = Math.max(20, Math.min(80, percentage));
      setSplitPercentage(clampedPercentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full overflow-hidden">
      {/* Top Pane */}
      <div
        style={{ height: `${splitPercentage}%` }}
        className="overflow-hidden"
      >
        {top}
      </div>

      {/* Resizable Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 bg-gray-700 hover:bg-blue-500 cursor-ns-resize transition-colors shrink-0 ${
          isDragging ? 'bg-blue-500' : ''
        }`}
      />

      {/* Bottom Pane */}
      <div
        style={{ height: `${100 - splitPercentage}%` }}
        className="overflow-hidden"
      >
        {bottom}
      </div>
    </div>
  );
}
