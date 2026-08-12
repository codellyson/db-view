import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ai, PROVIDERS, type ChatStep, type AiStatus } from '@/lib/ai';
import { useConnection } from '../contexts/connection-context';
import { useDashboardActions } from '../contexts/dashboard-context';
import { useToast } from '../contexts/toast-context';
import { useAiSchemaText } from '../hooks/use-ai-schema';
import { useChatHistory, type UiMessage } from '../hooks/use-chat-history';
import { AlignLeft, ArrowUp, Check, Loader2, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { Button, Input, Select, Textarea, Tooltip } from '@codellyson/justui/react';
interface AiChatPanelProps {
  onClose: () => void;
}

/** Renders an assistant reply as GitHub-flavoured markdown, styled to fit the
 *  compact chat column (lists, bold, code, tables, links). */
const ChatMarkdown: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      a: ({ children, href }) => (
        <a href={href} target="_blank" rel="noreferrer" className="text-accent underline break-all">{children}</a>
      ),
      h1: ({ children }) => <h1 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-semibold mb-1.5 mt-2 first:mt-0">{children}</h2>,
      h3: ({ children }) => <h3 className="text-[13px] font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
      pre: ({ children }) => <pre className="mb-2 overflow-x-auto">{children}</pre>,
      code: ({ className, children }) =>
        /language-/.test(className || '') ? (
          <code className="block font-mono text-[11px] bg-bg-secondary rounded-sm p-2 overflow-x-auto whitespace-pre">{children}</code>
        ) : (
          <code className="font-mono text-[12px] bg-bg-secondary rounded-sm px-1 py-0.5">{children}</code>
        ),
      table: ({ children }) => (
        <div className="overflow-x-auto mb-2"><table className="text-[11px] border-collapse">{children}</table></div>
      ),
      th: ({ children }) => <th className="text-left px-1.5 py-0.5 border border-border font-medium">{children}</th>,
      td: ({ children }) => <td className="px-1.5 py-0.5 border border-border/60 align-top">{children}</td>,
      blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-2 text-muted mb-2">{children}</blockquote>,
      hr: () => <hr className="my-2 border-border" />,
    }}
  >
    {children}
  </ReactMarkdown>
);

const SparkleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <Sparkles className={className} />
);

const fmtCell = (v: unknown): string =>
  v === null || v === undefined
    ? 'NULL'
    : typeof v === 'object'
      ? JSON.stringify(v)
      : String(v);

const StepRow: React.FC<{ step: ChatStep }> = ({ step }) => (
  <div className="flex items-start gap-1.5 text-[11px]">
    <span className={`mt-0.5 flex-shrink-0 ${step.ok ? 'text-green-500' : 'text-danger'}`}>
      {step.kind === 'propose_write'
        ? '✎'
        : step.kind === 'list_tables' || step.kind === 'describe_table'
          ? '🔍'
          : step.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </span>
    <div className="min-w-0 flex-1">
      <code className="block font-mono text-muted break-all whitespace-pre-wrap">{step.sql}</code>
      <span className="text-muted/70">{step.summary}</span>
      {step.columns && step.rows && step.rows.length > 0 && (
        <div className="mt-1 overflow-x-auto">
          <table className="text-[10px] border-collapse">
            <thead>
              <tr>
                {step.columns.map((c) => (
                  <th key={c} className="text-left px-1 py-0.5 border-b border-border font-medium text-muted whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {step.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td key={ci} className="px-1 py-0.5 border-b border-border/40 text-primary/80 whitespace-nowrap max-w-[160px] truncate" title={fmtCell(cell)}>{fmtCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
);

const AI_DOCK_WIDTH_KEY = 'justdb:ai-dock-width';
const AI_DOCK_MIN = 320;
const AI_DOCK_MAX = 760;
const AI_DOCK_DEFAULT = 420;

export const AiChatPanel: React.FC<AiChatPanelProps> = ({ onClose }) => {
  const { databaseType, databaseName, isConnected } = useConnection();
  const { openEditorTab } = useDashboardActions();
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

  // Resizable dock width — drag the left edge; persisted across sessions.
  const [dockWidth, setDockWidth] = useState(() => {
    try {
      const n = parseInt(localStorage.getItem(AI_DOCK_WIDTH_KEY) || '', 10);
      if (!isNaN(n)) return Math.min(AI_DOCK_MAX, Math.max(AI_DOCK_MIN, n));
    } catch { /* ignore */ }
    return AI_DOCK_DEFAULT;
  });
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);
  useEffect(() => {
    try { localStorage.setItem(AI_DOCK_WIDTH_KEY, String(dockWidth)); } catch { /* ignore */ }
  }, [dockWidth]);
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const s = resizeRef.current;
      if (!s) return;
      // Docked on the right, so dragging left widens the panel.
      const next = s.startW + (s.startX - e.clientX);
      setDockWidth(Math.min(AI_DOCK_MAX, Math.max(AI_DOCK_MIN, next)));
    };
    const onUp = () => setResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);
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
    <div
      className="relative h-screen max-w-[85vw] flex-shrink-0 flex flex-col bg-bg border-l border-border"
      style={{ width: dockWidth }}
    >
      {/* Left-edge resize handle — drag to resize, double-click to reset. */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          resizeRef.current = { startX: e.clientX, startW: dockWidth };
          setResizing(true);
        }}
        onDoubleClick={() => setDockWidth(AI_DOCK_DEFAULT)}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20 transition-colors ${
          resizing ? 'bg-accent' : 'bg-transparent hover:bg-accent/30'
        }`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI panel"
      />
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
            className="w-7 h-7 flex items-center justify-center rounded-sm text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            title="New chat"
            aria-label="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowChats((v) => !v)}
            className={`h-7 px-1.5 flex items-center gap-1 rounded-sm text-xs transition-colors ${showChats ? 'text-accent bg-accent/15' : 'text-muted hover:text-primary hover:bg-bg-secondary'}`}
            title="Conversations"
            aria-label="Conversations"
            aria-expanded={showChats}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            {conversations.length > 0 && <span className="font-mono">{conversations.length}</span>}
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-sm text-muted hover:text-primary hover:bg-bg-secondary transition-colors"
            title="Close AI mode"
            aria-label="Close AI mode"
          >
            <X className="w-4 h-4" />
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
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={setEditValue}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(c.id);
                      else if (e.key === 'Escape') { setEditingId(null); setEditValue(''); }
                    }}
                    onBlur={() => commitRename(c.id)}
                    containerClassName="flex-1 min-w-0"
                    className="text-xs"
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
                <Button
                  onClick={() => { setEditingId(c.id); setEditValue(c.title); }}
                  className="w-6 h-6 flex items-center justify-center rounded-sm text-muted hover:text-primary hover:bg-bg-secondary transition-colors flex-shrink-0"
                  title="Rename"
                  aria-label="Rename conversation"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => deleteChat(c.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                  title="Delete"
                  aria-label="Delete conversation"
                >
                  <X className="w-3 h-3" />
                </Button>
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
              {m.role === 'assistant'
                ? <div className="text-sm break-words">{m.content ? <ChatMarkdown>{m.content}</ChatMarkdown> : null}</div>
                : <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</div>}
              {m.proposedWrites && m.proposedWrites.length > 0 && (
                <div className="mt-2 space-y-2">
                  {m.proposedWrites.map((sql, wi) => (
                    <div key={wi} className="border border-warning/40 bg-warning/5 rounded-md p-2">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-warning">
                          Proposed change — review before running
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            onClick={() => openInEditor(sql)}
                            className="text-[11px] px-1.5 py-0.5 rounded-sm bg-accent text-white hover:bg-accent-hover transition-colors"
                            title="Open in a SQL editor tab (you'll confirm before it runs)"
                          >
                            Open in editor
                          </Button>
                          <Button
                            onClick={() => copySql(sql)}
                            className="text-[11px] px-1.5 py-0.5 rounded-sm text-accent hover:bg-accent/10 transition-colors"
                          >
                            Copy
                          </Button>
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
              <div className="w-full text-sm text-primary break-words">
                <ChatMarkdown>{liveText}</ChatMarkdown>
                <span className="inline-block w-1.5 h-4 -mb-0.5 ml-0.5 bg-accent/70 animate-pulse" aria-hidden="true" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="animate-spin h-4 w-4" />
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
          <Textarea
            ref={inputRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            disabled={disabled}
            rows={1}
            placeholder="Ask about your data…  (↑ recalls previous)"
            containerClassName="contents"
            className="block w-full resize-none overflow-y-auto border-0 bg-transparent min-h-0 rounded-none px-3 pt-2.5 pb-1 text-sm leading-relaxed focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-0.5">
            {status?.configured && modelOptions.length > 0 ? (
              <Tooltip label="Model used for AI mode">
                <Select
                  value={chatModel}
                  onChange={onModelChange}
                  disabled={isBusy}
                  aria-label="AI mode model"
                  options={modelOptions.map((m) => ({ value: m, label: m }))}
                  size="xs"
                  className="max-w-[60%] text-[10px] text-muted bg-transparent border-0 truncate"
                />
              </Tooltip>

            ) : (
              <span className="text-[10px] text-muted px-1 truncate">{status?.model ?? ''}</span>
            )}
            <Button
              onClick={send}
              disabled={disabled || !input.trim()}
              className="w-7 h-7 flex items-center justify-center rounded-full   text-white hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              title="Send (Enter)"
              aria-label="Send"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted px-1">
          Reads run automatically. Changes are proposed for you to run via the SQL editor.
        </p>
      </div>
    </div>
  );
};
