import React from "react";
import { Button } from "./ui/button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

function getErrorHint(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('network error') || lower.includes('fetch'))
    return 'Check your internet connection or verify the server is running.';
  if (lower.includes('timed out') || lower.includes('timeout'))
    return 'The server took too long to respond. It may be under heavy load.';
  if (lower.includes('connection refused') || lower.includes('econnrefused'))
    return 'The database server may be down or unreachable.';
  if (lower.includes('authentication') || lower.includes('password'))
    return 'Check your database credentials.';
  if (lower.includes('permission') || lower.includes('denied'))
    return 'Your database user may lack the required permissions.';
  return null;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  className = "",
}) => {
  const hint = getErrorHint(message);

  return (
    <div
      className={`border-l-4 border-danger bg-danger/5 rounded-md p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 text-danger text-sm font-medium">!</span>
            <p className="text-sm text-primary">{message}</p>
          </div>
          {hint && (
            <p className="text-xs text-muted ml-6">{hint}</p>
          )}
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
