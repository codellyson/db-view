import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ai, PROVIDERS, type AiStatus, type ProviderId } from '@/lib/ai';

interface AiSqlBarProps {
  /** "postgresql" | "sqlite" | "mysql" — steers dialect-specific SQL. */
  dialect: string;
  /** Pre-formatted schema text (see formatSchemaForPrompt). */
  schema: string;
  /** Generated SQL is handed back to the editor — never run automatically. */
  onGenerated: (sql: string, explanation: string) => void;
  disabled?: boolean;
}

const SparkleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0l1.6 4.4L14 6l-4.4 1.6L8 12l-1.6-4.4L2 6l4.4-1.6L8 0zM13 10l.7 1.9L15.6 12.6l-1.9.7L13 15l-.7-1.9L10.4 12.6l1.9-.7L13 10z" />
  </svg>
);

export const AiSqlBar: React.FC<AiSqlBarProps> = ({ dialect, schema, onGenerated, disabled }) => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [prompt, setPrompt] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [provider, setProvider] = useState<ProviderId>('anthropic');
  const [modelInput, setModelInput] = useState('');
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const providerMeta = useMemo(
    () => PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0],
    [provider],
  );

  useEffect(() => {
    ai.status()
      .then(setStatus)
      .catch(() => setStatus({ configured: false }));
  }, []);

  const saveKey = useCallback(async () => {
    if (!keyInput.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      const s = await ai.setKey(keyInput.trim(), provider, modelInput.trim() || undefined);
      setStatus(s);
      setShowKeyForm(false);
      setKeyInput('');
      setModelInput('');
    } catch (e: any) {
      setError(e?.message || 'Failed to save key');
    } finally {
      setIsBusy(false);
    }
  }, [keyInput, provider, modelInput]);

  const clearKey = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await ai.clearKey();
      setStatus({ configured: false });
      setShowKeyForm(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to remove key');
    } finally {
      setIsBusy(false);
    }
  }, []);

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

  // Key-entry form: shown when no key is configured, or the gear is clicked.
  if (!status.configured || showKeyForm) {
    return (
      <div className="flex flex-col gap-2 p-3 border border-border rounded-md bg-bg-secondary/30">
        <div className="flex items-center gap-2 text-sm text-primary">
          <span className="text-accent"><SparkleIcon /></span>
          <span className="font-medium">Generate SQL with AI</span>
        </div>
        <p className="text-xs text-muted">
          Pick a provider and paste an API key to enable natural-language → SQL. The key is stored
          in your OS keychain and only leaves your machine on requests you make.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
            className="px-2 py-1.5 text-sm border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent flex-shrink-0"
            aria-label="AI provider"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
            placeholder={`Model (default: ${providerMeta.defaultModel})`}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted font-mono"
            aria-label="Model (optional)"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
            placeholder={providerMeta.keyPlaceholder}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted font-mono"
            aria-label="API key"
          />
          <button
            onClick={saveKey}
            disabled={isBusy || !keyInput.trim()}
            className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          {status.configured && (
            <>
              <button
                onClick={clearKey}
                disabled={isBusy}
                className="px-3 py-1.5 text-sm rounded text-danger hover:bg-danger/10 disabled:opacity-40 transition-colors"
              >
                Remove
              </button>
              <button
                onClick={() => { setShowKeyForm(false); setKeyInput(''); setError(null); }}
                className="px-3 py-1.5 text-sm rounded text-muted hover:text-primary hover:bg-bg-secondary transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
        {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      </div>
    );
  }

  // Configured: prompt bar.
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-accent flex-shrink-0" title={`Powered by ${status.model ?? 'Claude'}`}>
          <SparkleIcon />
        </span>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
          disabled={disabled || isBusy}
          placeholder="Describe the query in plain English…"
          className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted disabled:opacity-50"
          aria-label="Describe the query you want in plain English"
        />
        <button
          onClick={generate}
          disabled={disabled || isBusy || !prompt.trim()}
          className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors flex-shrink-0 flex items-center gap-1.5"
        >
          {isBusy ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {isBusy ? 'Generating…' : 'Generate'}
        </button>
        <button
          onClick={() => {
            if (status.provider && PROVIDERS.some((p) => p.id === status.provider)) {
              setProvider(status.provider as ProviderId);
            }
            setShowKeyForm(true);
            setError(null);
          }}
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
      </div>
      {error && <p className="text-xs text-danger px-6" role="alert">{error}</p>}
    </div>
  );
};
