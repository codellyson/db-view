"use client";

import React, { useState, useEffect } from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

const FRAMES = ["|", "/", "-", "\\"];

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  className = "",
  label = "LOADING...",
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const sizeStyles = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const spinnerSize = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <div
      className={`font-mono font-bold uppercase text-black dark:text-white flex flex-col items-center gap-2 ${sizeStyles[size]} ${className}`}
      role="status"
      aria-label={label}
    >
      <span className={`${spinnerSize[size]} leading-none`}>
        {FRAMES[frame]}
      </span>
      <span>{label}</span>
    </div>
  );
};
