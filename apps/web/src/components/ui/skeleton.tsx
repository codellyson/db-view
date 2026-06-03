import React from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = "1rem",
  className = "",
}) => {
  return (
    <div
      className={`bg-border/50 animate-pulse rounded-md ${className}`}
      style={{ width, height }}
    />
  );
};

export const SkeletonRow: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return <Skeleton height="1rem" className={className} />;
};

export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
}> = ({ lines = 3, className = "" }) => {
  const widths = ["100%", "85%", "70%", "90%", "60%"];
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height="0.75rem" />
      ))}
    </div>
  );
};
