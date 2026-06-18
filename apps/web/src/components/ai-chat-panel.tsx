import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { ai, PROVIDERS, type ChatStep, type AiStatus } from '@/lib/ai';
import { useConnection } from '../contexts/connection-context';
import { useDashboard } from '../contexts/dashboard-context';
import { useToast } from '../contexts/toast-context';
import { useAiSchemaText } from '../hooks/use-ai-schema';
import { useChatHistory, type UiMessage } from '../hooks/use-chat-history';

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

  const {
    conversations, activeId, messages, setMessages,
    newChat, selectChat, renameChat, deleteChat,
  } = useChatHistory(databaseName);

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<ChatStep[]>([]);
  const [liveText, setLiveText] = useState('');
  const [showChats, setShowChats] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Input-history cursor: null = not navigating, else index into sentPrompts.
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [chatModel, setChatModel] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const draftKey = `justdb-ai-draft-${databaseName ?? 'default'}`;
  const modelKey = `justdb-ai-model-${status?.provider ?? 'default'}`;

  // AI mode's model (may differ from the Generate bar's default), persisted
  // per provider. Defaults to the configured model.
  useEffect(() => {
    if (!status?.configured) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(modelKey); } catch { /* ignore */ }
    setChatModel(saved || status.model || '');
  }, [status?.configured, status?.model, modelKey]);

  const onModelChange = useCallback((m: string) => {
    setChatModel(m);
    try { localStorage.setItem(modelKey, m); } catch { /* ignore */ }
  }, [modelKey]);

  const modelOptions = useMemo(() => {
    const meta = PROVIDERS.find((p) => p.id === status?.provider);
    const opts = new Set<string>();
    if (status?.model) opts.add(status.model);
    if (chatModel) opts.add(chatModel);
    (meta?.models ?? []).forEach((m) => opts.add(m));
    return Array.from(opts);
  }, [status?.provider, status?.model, chatModel]);
  const sentPrompts = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.content),
    [messages],
  );

  useEffect(() => {
    ai.status().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  // Restore the unsent draft when the database changes / drawer reopens.
  useEffect(() => {
    try {
      setInput(localStorage.getItem(draftKey) ?? '');
    } catch {
      setInput('');
    }
  }, [draftKey]);

  // Auto-size the composer: one line, grow with content, cap then scroll.
  const MAX_INPUT_PX = 160;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
  }, [input]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isBusy, liveSteps, liveText]);

  // Save the draft on every keystroke (explicit, not a mount effect — avoids
  // wiping the key on the initial empty render).
  const onInputChange = useCallback((val: string) => {
    setInput(val);
    setHistIdx(null);
    try {
      if (val) localStorage.setItem(draftKey, val);
      else localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isBusy) return;
    setError(null);
    setHistIdx(null);
    const history: UiMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setIsBusy(true);
    setLiveSteps([]);
    setLiveText('');
    const unlistenStep = await ai.onChatStep((s) => setLiveSteps((prev) => [...prev, s]));
    const unlistenToken = await ai.onChatToken((t) => setLiveText((prev) => prev + t));
    try {
      const res = await ai.chat({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        dialect: databaseType,
        schema: schemaText,
        model: chatModel || undefined,
      });
      setMessages([
        ...history,
        { role: 'assistant', content: res.reply, steps: res.steps, proposedWrites: res.proposedWrites },
      ]);
    } catch (e: any) {
      setError(e?.message || 'AI request failed');
    } finally {
      unlistenStep();
      unlistenToken();
      setLiveSteps([]);
      setLiveText('');
      setIsBusy(false);
    }
  }, [input, isBusy, messages, databaseType, schemaText, setMessages, draftKey, chatModel]);

  // ↑/↓ recall of previously sent prompts (only when the input is empty or
  // already navigating, so it doesn't hijack multi-line cursor movement).
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    if (e.key === 'ArrowUp' && sentPrompts.length > 0 && (input === '' || histIdx !== null)) {
      e.preventDefault();
      const idx = histIdx === null ? sentPrompts.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(sentPrompts[idx]);
    } else if (e.key === 'ArrowDown' && histIdx !== null) {
      e.preventDefault();
      const idx = histIdx + 1;
      if (idx >= sentPrompts.length) {
        setHistIdx(null);
        setInput('');
      } else {
        setHistIdx(idx);
        setInput(sentPrompts[idx]);
      }
    }
  }, [send, sentPrompts, input, histIdx]);

  const copySql = useCallback((sql: string) => {
    navigator.clipboard?.writeText(sql).then(
      () => addToast('SQL copied — paste into the SQL editor to review and run', 'success'),
      () => addToast('Could not copy SQL', 'error'),
    );
  }, [addToast]);

  const openInEditor = useCallback((sql: string) => {
    openEditorTab(sql);
    onClose();
  }, [openEditorTab, onClose]);

  const commitRename = useCallback((id: string) => {
    renameChat(id, editValue);
    setEditingId(null);
    setEditValue('');
  }, [renameChat, editValue]);

  const disabled = isBusy || !isConnected || !status?.configured;

  return (
    <div className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[60] flex flex-col bg-bg border-l border-border shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-primary min-w-0">
          <span className="text-accent flex-shrink-0"><SparkleIcon /></span>
          AI mode
          {status?.configured && status.model && (
            <span className="text-[10px] text-muted font-normal truncate">{status.model}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { newChat(); setShowChats(false); setError(null); }}
            className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="New chat"
            aria-label="New chat"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          </button>
          <button
            onClick={() => setShowChats((v) => !v)}
            className={`h-7 px-1.5 flex items-center gap-1 rounded text-xs transition-colors ${showChats ? 'text-accent bg-accent/15' : 'text-muted hover:text-primary hover:bg-bg-secondary'}`}
            title="Conversations"
            aria-label="Conversations"
            aria-expanded={showChats}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h8" /></svg>
            {conversations.length > 0 && <span className="font-mono">{conversations.length}</span>}
          </button>
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

      {/* Conversations list */}
      {showChats && (
        <div className="border-b border-border bg-bg-secondary/30 max-h-60 overflow-y-auto flex-shrink-0">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted px-3 py-3">No saved conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-1 px-2 py-1.5 border-b border-border/60 last:border-b-0 ${c.id === activeId ? 'bg-accent/10' : 'hover:bg-bg-secondary'}`}
              >
                {editingId === c.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(c.id);
                      else if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                    }}
                    onBlur={() => commitRename(c.id)}
                    className="flex-1 min-w-0 px-1.5 py-0.5 text-xs border border-border rounded bg-bg text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                ) : (
                  <button
                    onClick={() => { selectChat(c.id); setShowChats(false); }}
                    className={`flex-1 min-w-0 text-left text-xs truncate ${c.id === activeId ? 'text-accent font-medium' : 'text-primary'}`}
                    title={c.title}
                  >
                    {c.title}
                  </button>
                )}
                <button
                  onClick={() => { setEditingId(c.id); setEditValue(c.title); }}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-primary hover:bg-bg-secondary transition-colors flex-shrink-0"
                  title="Rename"
                  aria-label="Rename conversation"
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-8 8H3v-3z" strokeLinejoin="round" /></svg>
                </button>
                <button
                  onClick={() => deleteChat(c.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                  title="Delete"
                  aria-label="Delete conversation"
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" /></svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}

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
                    {m.steps.length} step{m.steps.length === 1 ? '' : 's'}
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

      {/* Composer */}
      <div className="border-t border-border p-2.5 flex-shrink-0">
        <div className="border border-border rounded-xl bg-bg focus-within:ring-2 focus-within:ring-accent transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            placeholder="Ask about your data…  (↑ recalls previous)"
            className="block w-full resize-none overflow-y-auto bg-transparent px-3 pt-2.5 pb-1 text-sm leading-relaxed text-primary placeholder:text-muted focus:outline-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-0.5">
            {status?.configured && modelOptions.length > 0 ? (
              <select
                value={chatModel}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={isBusy}
                title="Model used for AI mode"
                aria-label="AI mode model"
                className="max-w-[60%] text-[10px] text-muted bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer disabled:opacity-50 truncate"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] text-muted px-1 truncate">{status?.model ?? ''}</span>
            )}
            <button
              onClick={send}
              disabled={disabled || !input.trim()}
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
