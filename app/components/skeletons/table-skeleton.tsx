import React from "react";
import { Skeleton } from "../ui/skeleton";

export const TableSkeleton: React.FC = () => {
  const cols = 5;
  const rows = 8;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-bg-secondary flex">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 px-4 py-2.5 border-r border-border last:border-r-0">
            <Skeleton height="0.625rem" width="70%" />
          </div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className={`flex border-b border-border last:border-b-0 ${rowIdx % 2 === 1 ? 'bg-bg-secondary/50' : ''}`}>
          {Array.from({ length: cols }).map((_, colIdx) => {
            const widths = ["80%", "60%", "90%", "45%", "70%"];
            return (
              <div
                key={colIdx}
                className="flex-1 px-4 py-2 border-r border-border last:border-r-0"
              >
                <Skeleton
                  height="0.625rem"
                  width={widths[(rowIdx + colIdx) % widths.length]}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
