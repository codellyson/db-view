import React, { useState, useEffect, useCallback } from 'react';
import { ai, type AiStatus } from '@/lib/ai';

interface AiSqlBarProps {
  /** "postgresql" | "sqlite" | "mysql" — steers dialect-specific SQL. */
  dialect: string;
  /** Pre-formatted schema text (see formatSchemaForPrompt). */
  schema: string;
  /** Generated SQL is handed back to the editor — never run automatically. */
  onGenerated: (sql: string, explanation: string) => void;
  disabled?: boolean;
}

const openSettings = () => window.dispatchEvent(new CustomEvent('justdb:open-settings'));

export const AiSqlBar: React.FC<AiSqlBarProps> = ({ dialect, schema, onGenerated, disabled }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(() => {
    ai.status().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  // Re-check status on mount and whenever the window regains focus (covers the
  // user configuring/removing a key in the Settings modal).
  useEffect(() => {
    refreshStatus();
    window.addEventListener('focus', refreshStatus);
    return () => window.removeEventListener('focus', refreshStatus);
  }, [refreshStatus]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await ai.generateSql({ prompt: prompt.trim(), dialect, schema });
      if (!res.sql.trim()) {
        setError(res.explanation || 'The model could not produce a query for that request.');
        return;
      }
      onGenerated(res.sql, res.explanation);
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setIsBusy(false);
    }
  }, [prompt, dialect, schema, isBusy, onGenerated]);

  // Still loading the initial status — render nothing to avoid a flash.
  if (status === null) return null;

  // Not configured → point the user at Settings (key management lives there now).
  if (!status.configured) {
    return (
      <div className="flex items-center gap-2 p-2.5 border border-border rounded-md bg-bg-secondary/30 text-sm">
        <span className="text-muted flex-1 min-w-0">Generate SQL from plain English — add an API key to enable it.</span>
        <button
          onClick={openSettings}
          className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-hover transition-colors flex-shrink-0"
        >
          Set up AI
        </button>
      </div>
    );
  }

  // Configured: a single rounded field with the controls living inside it.
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 pl-3 pr-1 py-1 border border-border rounded-md bg-bg focus-within:ring-2 focus-within:ring-accent transition-colors">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          disabled={disabled || isBusy}
          placeholder="Describe the query in plain English…"
          className="flex-1 min-w-0 bg-transparent border-0 text-sm text-primary placeholder:text-muted focus:outline-none disabled:opacity-50"
          aria-label="Describe the query you want in plain English"
        />
        <button
          onClick={openSettings}
          disabled={isBusy}
          title="AI settings"
          aria-label="AI settings"
          className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-bg-secondary disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="2.25" />
            <path strokeLinecap="round" d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
          </svg>
        </button>
        <button
          onClick={generate}
          disabled={disabled || isBusy || !prompt.trim()}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors flex-shrink-0 flex items-center gap-1.5"
        >
          {isBusy ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {isBusy ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {error && <p className="text-xs text-danger px-3" role="alert">{error}</p>}
    </div>
  );
};
