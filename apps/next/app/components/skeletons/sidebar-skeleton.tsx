import React from "react";
import { Skeleton } from "../ui/skeleton";

export const SidebarSkeleton: React.FC = () => {
  const items = 10;
  const widths = ["90%", "70%", "80%", "60%", "85%", "75%", "65%", "90%", "55%", "80%"];

  return (
    <div className="space-y-1">
      {/* Search bar skeleton */}
      <Skeleton height="2.25rem" className="rounded-md mb-3" />
      {/* Table list items */}
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="px-3 py-2">
          <Skeleton height="0.625rem" width={widths[i]} />
        </div>
      ))}
    </div>
  );
};
