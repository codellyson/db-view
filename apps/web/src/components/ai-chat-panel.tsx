import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { ai, type ChatStep, type AiStatus } from '@/lib/ai';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { useToast } from '../contexts/toast-context';
import { useAiSchemaText } from '../hooks/use-ai-schema';

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: ChatStep[];
  proposedWrites?: string[];
}

interface AiChatPanelProps {
  onClose: () => void;
}

const SparkleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0l1.6 4.4L14 6l-4.4 1.6L8 12l-1.6-4.4L2 6l4.4-1.6L8 0zM13 10l.7 1.9L15.6 12.6l-1.9.7L13 15l-.7-1.9L10.4 12.6l1.9-.7L13 10z" />
  </svg>
);

const StepRow: React.FC<{ step: ChatStep }> = ({ step }) => (
  <div className="flex items-start gap-1.5 text-[11px]">
    <span className={`mt-0.5 flex-shrink-0 ${step.ok ? 'text-green-500' : 'text-danger'}`}>
      {step.kind === 'propose_write'
        ? '✎'
        : step.kind === 'list_tables' || step.kind === 'describe_table'
          ? '🔍'
          : step.ok ? '✓' : '✕'}
    </span>
    <div className="min-w-0">
      <code className="block font-mono text-muted break-all whitespace-pre-wrap">{step.sql}</code>
      <span className="text-muted/70">{step.summary}</span>
    </div>
  </div>
);

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ onClose }) => {
  const { databaseType, databaseName, isConnected } = useConnection();
  const { openEditorTab } = useDashboard();
  const { addToast } = useToast();
  const schemaText = useAiSchemaText({ allowCompact: true });

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<ChatStep[]>([]);
  const [liveText, setLiveText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-size the composer to its content: collapse to one line, grow with
  // wrapped/multi-line text, cap at MAX_INPUT_PX and then scroll.
  const MAX_INPUT_PX = 160;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
  }, [input]);

  // Persist the conversation per database so it survives reloads and toggling
  // the panel. Switching databases swaps in that database's history.
  const storageKey = `justdb-ai-chat-${databaseName ?? 'default'}`;

  useEffect(() => {
    ai.status().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setMessages(raw ? JSON.parse(raw) : []);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  // Persist explicitly on user actions (send / clear), NOT via an effect on
  // `messages`. A blanket effect runs on mount while `messages` is still the
  // initial empty array and wipes the saved key — and StrictMode's double
  // effect-invoke can delete it before the load effect rehydrates, so the
  // conversation vanishes every time the drawer is reopened.
  const persist = useCallback((next: UiMessage[]) => {
    try {
      if (next.length > 0) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {
      // ignore quota / serialization errors
    }
  }, [storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isBusy, liveSteps, liveText]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isBusy) return;
    setError(null);
    const history: UiMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    persist(history);
    setInput('');
    setIsBusy(true);
    setLiveSteps([]);
    setLiveText('');
    // Subscribe before the call (stream-first) so no early event is missed.
    const unlistenStep = await ai.onChatStep((s) => setLiveSteps((prev) => [...prev, s]));
    const unlistenToken = await ai.onChatToken((t) => setLiveText((prev) => prev + t));
    try {
      const res = await ai.chat({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        dialect: databaseType,
        schema: schemaText,
      });
      const next: UiMessage[] = [
        ...history,
        {
          role: 'assistant',
          content: res.reply,
          steps: res.steps,
          proposedWrites: res.proposedWrites,
        },
      ];
      setMessages(next);
      persist(next);
    } catch (e: any) {
      setError(e?.message || 'AI request failed');
    } finally {
      unlistenStep();
      unlistenToken();
      setLiveSteps([]);
      setLiveText('');
      setIsBusy(false);
    }
  }, [input, isBusy, messages, databaseType, schemaText, persist]);

  const copySql = useCallback((sql: string) => {
    navigator.clipboard?.writeText(sql).then(
      () => addToast('SQL copied — paste into the SQL editor to review and run', 'success'),
      () => addToast('Could not copy SQL', 'error'),
    );
  }, [addToast]);

  // Open the proposed change in a fresh SQL editor tab (pre-filled) and reveal
  // it by closing the drawer. Running it there goes through the normal
  // write/DDL confirmation gate — nothing is executed automatically.
  const openInEditor = useCallback((sql: string) => {
    openEditorTab(sql);
    onClose();
  }, [openEditorTab, onClose]);

  return (
    <div className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[60] flex flex-col bg-bg border-l border-border shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <span className="text-accent"><SparkleIcon /></span>
          AI mode
          {status?.configured && status.model && (
            <span className="text-[10px] text-muted font-normal">{status.model}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); persist([]); setError(null); }}
              className="px-2 py-1 text-xs text-muted hover:text-primary hover:bg-bg-secondary rounded transition-colors"
              title="Clear conversation"
            >
              Clear
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-bg-secondary transition-colors"
            title="Close AI mode"
            aria-label="Close AI mode"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {!isConnected && (
          <p className="text-sm text-muted">Connect to a database to use AI mode.</p>
        )}
        {status && !status.configured && (
          <p className="text-sm text-muted">
            Add an API key first — open a SQL editor tab and use the AI bar above the editor to
            connect a provider, then come back here.
          </p>
        )}
        {messages.length === 0 && isConnected && status?.configured && (
          <div className="text-sm text-muted space-y-2">
            <p>Ask anything about your data. The assistant runs read-only queries itself to answer.</p>
            <ul className="text-xs space-y-1 list-disc list-inside text-muted/80">
              <li>"Which 10 customers spent the most last month?"</li>
              <li>"How many orders have no shipping address?"</li>
              <li>"What's the schema relationship between users and teams?"</li>
            </ul>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div
              className={
                m.role === 'user'
                  ? 'max-w-[85%] px-3 py-2 rounded-lg bg-accent text-white text-sm whitespace-pre-wrap break-words'
                  : 'w-full text-sm text-primary'
              }
            >
              {m.role === 'assistant' && m.steps && m.steps.length > 0 && (
                <details className="mb-2 group">
                  <summary className="cursor-pointer text-[11px] text-muted hover:text-primary select-none">
                    {m.steps.filter((s) => s.kind === 'run_sql').length} quer
                    {m.steps.filter((s) => s.kind === 'run_sql').length === 1 ? 'y' : 'ies'} run
                  </summary>
                  <div className="mt-1.5 space-y-1.5 pl-1 border-l border-border ml-1">
                    {m.steps.map((s, si) => <StepRow key={si} step={s} />)}
                  </div>
                </details>
              )}
              <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>
              {m.proposedWrites && m.proposedWrites.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.proposedWrites.map((sql, wi) => (
                    <div key={wi} className="border border-warning/40 bg-warning/5 rounded-md p-2">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-warning">
                          Proposed change — review before running
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => openInEditor(sql)}
                            className="text-[11px] px-1.5 py-0.5 rounded bg-accent text-white hover:bg-accent-hover transition-colors"
                            title="Open in a SQL editor tab (you'll confirm before it runs)"
                          >
                            Open in editor
                          </button>
                          <button
                            onClick={() => copySql(sql)}
                            className="text-[11px] px-1.5 py-0.5 rounded text-accent hover:bg-accent/10 transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <code className="block font-mono text-[11px] text-primary whitespace-pre-wrap break-all">{sql}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isBusy && (
          <div className="space-y-2">
            {liveSteps.length > 0 && (
              <div className="space-y-1.5 pl-1 border-l border-border ml-1">
                {liveSteps.map((s, si) => <StepRow key={si} step={s} />)}
              </div>
            )}
            {liveText ? (
              <div className="w-full text-sm text-primary whitespace-pre-wrap break-words leading-relaxed">
                {liveText}
                <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-accent/70 animate-pulse" aria-hidden="true" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {liveSteps.length > 0 ? 'Thinking…' : 'Working…'}
              </div>
            )}
          </div>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>

      {/* Composer — single rounded card: input on top, controls on a bottom row */}
      <div className="border-t border-border p-2.5 flex-shrink-0">
        <div className="border border-border rounded-xl bg-bg focus-within:ring-2 focus-within:ring-accent transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            disabled={isBusy || !isConnected || !status?.configured}
            rows={1}
            placeholder="Ask about your data…"
            className="block w-full resize-none overflow-y-auto bg-transparent px-3 pt-2.5 pb-1 text-sm leading-relaxed text-primary placeholder:text-muted focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-0.5">
            <span className="text-[10px] text-muted px-1 truncate" title={status?.model ?? undefined}>
              {status?.configured ? status.model : ''}
            </span>
            <button
              onClick={send}
              disabled={isBusy || !input.trim() || !isConnected || !status?.configured}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              title="Send (Enter)"
              aria-label="Send"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 13V3" /><path d="M3.5 7.5L8 3l4.5 4.5" />
              </svg>
            </button>
          </div>
        </div>
        <p className="mt-1 text-[10px] text-muted px-1">
          Reads run automatically. Changes are proposed for you to run via the SQL editor.
        </p>
      </div>
    </div>
  );
};
