import React from "react";
import { Button } from "./ui/button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
  /** Extra action(s) rendered alongside Retry (e.g. "Fix with AI"). */
  action?: React.ReactNode;
  /** When provided, shows a dismiss (✕) button that clears the error. */
  onDismiss?: () => void;
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
  action,
  onDismiss,
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
            <span className="flex-shrink-0 text-danger text-sm font-medium self-start mt-0.5">!</span>
            {/* Preserve newlines so multi-line SQL errors (ERROR / Detail /
                Hint / Position / SQLSTATE) stay readable instead of being
                collapsed onto one line. */}
            <p className="text-sm text-primary whitespace-pre-wrap break-words">{message}</p>
          </div>
          {hint && (
            <p className="text-xs text-muted ml-6">{hint}</p>
          )}
        </div>
        {(onRetry || action || onDismiss) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {action}
            {onRetry && (
              <Button variant="danger" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                aria-label="Dismiss"
                title="Dismiss"
                className="p-1.5 rounded-md text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                  <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
