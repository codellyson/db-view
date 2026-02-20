import React from "react";
import { Button } from "./ui/button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  className = "",
}) => {
  return (
    <div
      className={`border-2 border-red-500 bg-white dark:bg-black p-6 ${className}`}
      role="alert"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 text-red-500 font-bold text-lg">
            !
          </span>
          <p className="text-sm font-bold uppercase font-mono text-black dark:text-white truncate">
            {message}
          </p>
        </div>
        {onRetry && (
          <Button
            variant="danger"
            size="sm"
            onClick={onRetry}
            className="flex-shrink-0"
          >
            RETRY
          </Button>
        )}
      </div>
    </div>
  );
};
