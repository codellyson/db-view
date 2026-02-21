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
      className={`border-l-4 border-danger bg-danger/5 rounded-md p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 text-danger text-sm">
            !
          </span>
          <p className="text-sm text-primary truncate">
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
            Retry
          </Button>
        )}
      </div>
    </div>
  );
};
