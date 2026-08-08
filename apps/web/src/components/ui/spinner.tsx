
import React from "react";
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  className = "",
  label = "Loading...",
}) => {
  const sizeStyles = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div
      className={`flex flex-col items-center gap-2 text-secondary ${className}`}
      role="status"
      aria-label={label}
    >
      <Loader2 className={`animate-spin ${sizeStyles[size]}`} />
      <span className={textSize[size]}>{label}</span>
    </div>
  );
};
