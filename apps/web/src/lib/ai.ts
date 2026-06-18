/**
 * Typed client for the opt-in AI commands (natural-language → SQL).
 *
 * Mirrors lib/db.ts: every function maps to one `invoke('ai_*', ...)` call.
 * The provider API key lives in the OS keychain on the Rust side and never
 * touches this layer — we only ever send a prompt + schema and get SQL back.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getSessionId, type SchemaOverviewTable } from "./db";

export interface AiStatus {
  configured: boolean;
  provider?: string;
  model?: string;
}

export interface GenerateSqlResult {
  sql: string;
  explanation: string;
}

export type ProviderId = "anthropic" | "openai" | "google";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Default model used when the user leaves the model field blank. */
  defaultModel: string;
  /** Placeholder hinting the key format for this provider. */
  keyPlaceholder: string;
}

/** Providers offered in the key-entry form. Models are user-overridable. */
export const PROVIDERS: ProviderMeta[] = [
  { id: "anthropic", label: "Anthropic (Claude)", defaultModel: "claude-opus-4-8", keyPlaceholder: "sk-ant-..." },
  { id: "openai", label: "OpenAI (GPT)", defaultModel: "gpt-4o", keyPlaceholder: "sk-..." },
  { id: "google", label: "Google (Gemini)", defaultModel: "gemini-2.5-flash", keyPlaceholder: "AIza..." },
];

const status = () => tauriInvoke<AiStatus>("ai_status");

const setKey = (apiKey: string, provider: ProviderId = "anthropic", model?: string) =>
  tauriInvoke<AiStatus>("ai_set_key", { provider, apiKey, model });

const clearKey = () => tauriInvoke<void>("ai_clear_key");

const generateSql = (args: { prompt: string; dialect: string; schema: string }) =>
  tauriInvoke<GenerateSqlResult>("ai_generate_sql", { args });

// ─── AI mode (agentic chat) ───────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStep {
  kind: "run_sql" | "propose_write";
  sql: string;
  ok: boolean;
  summary: string;
}

export interface ChatResponse {
  reply: string;
  steps: ChatStep[];
  proposedWrites: string[];
}

const chat = (args: { messages: ChatMessage[]; dialect: string; schema: string }) =>
  tauriInvoke<ChatResponse>("ai_chat", {
    sessionId: getSessionId(),
    messages: args.messages,
    dialect: args.dialect,
    schema: args.schema,
  });

/**
 * Subscribe to live tool-step events emitted by an in-flight `chat` call.
 * Returns an unlisten function; call it once the chat resolves.
 */
const onChatStep = (cb: (step: ChatStep) => void): Promise<UnlistenFn> =>
  listen<ChatStep>("ai-chat-step", (e) => cb(e.payload));

/** Subscribe to streamed answer-text chunks from an in-flight `chat` call. */
const onChatToken = (cb: (text: string) => void): Promise<UnlistenFn> =>
  listen<string>("ai-chat-token", (e) => cb(e.payload));

/**
 * Flatten the dashboard's `{ table: columns[] }` map into a compact,
 * schema-qualified listing the model can ground on, e.g.
 *   public.users(id, email, created_at)
 * Columns are omitted for tables we haven't introspected yet.
 */
export function formatSchemaForPrompt(
  schemaName: string,
  schemaMap: Record<string, string[]>,
): string {
  const entries = Object.entries(schemaMap);
  if (entries.length === 0) return "(no tables available)";
  return entries
    .map(([table, cols]) =>
      cols.length > 0
        ? `${schemaName}.${table}(${cols.join(", ")})`
        : `${schemaName}.${table}`,
    )
    .join("\n");
}

/**
 * Richer schema text with column types and PK/FK markers, e.g.
 *   public.orders(id bigint PK, customer_id bigint -> public.customers.id, total numeric)
 * Grounds the AI far better than names alone — fewer cast/join mistakes.
 */
export function formatTypedSchema(
  schemaName: string,
  tables: SchemaOverviewTable[],
): string {
  if (tables.length === 0) return "(no tables available)";
  return tables
    .map((t) => {
      const cols = t.columns
        .map((c) => {
          let s = `${c.name} ${c.type}`.trimEnd();
          if (c.pk) s += " PK";
          if (c.fk) s += ` -> ${schemaName}.${c.fk.table}.${c.fk.column}`;
          return s;
        })
        .join(", ");
      return `${schemaName}.${t.name}(${cols})`;
    })
    .join("\n");
}

export const ai = {
  status,
  setKey,
  clearKey,
  generateSql,
  chat,
  onChatStep,
  onChatToken,
};
