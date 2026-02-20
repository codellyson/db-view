import React from "react";
import { Skeleton } from "../ui/skeleton";

export const SidebarSkeleton: React.FC = () => {
  const items = 10;
  const widths = ["90%", "70%", "80%", "60%", "85%", "75%", "65%", "90%", "55%", "80%"];

  return (
    <div className="space-y-2">
      {/* Search bar skeleton */}
      <Skeleton height="2.5rem" className="border-2 border-black/10 dark:border-white/15 mb-4" />
      {/* Table list items */}
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-2 border-black/10 dark:border-white/15">
          <Skeleton height="0.75rem" width={widths[i]} />
        </div>
      ))}
    </div>
  );
};
