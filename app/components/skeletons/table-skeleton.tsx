import React from "react";
import { Skeleton } from "../ui/skeleton";

export const TableSkeleton: React.FC = () => {
  const cols = 5;
  const rows = 8;

  return (
    <div className="border-2 border-black dark:border-white overflow-hidden">
      {/* Header */}
      <div className="bg-black dark:bg-white flex">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="flex-1 px-6 py-4 border-r-2 border-black dark:border-white last:border-r-0">
            <Skeleton height="0.75rem" width="70%" className="bg-white/20 dark:bg-black/20" />
          </div>
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex border-b-2 border-black dark:border-white last:border-b-0">
          {Array.from({ length: cols }).map((_, colIdx) => {
            const widths = ["80%", "60%", "90%", "45%", "70%"];
            return (
              <div
                key={colIdx}
                className="flex-1 px-6 py-4 border-r-2 border-black dark:border-white last:border-r-0"
              >
                <Skeleton
                  height="0.75rem"
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
