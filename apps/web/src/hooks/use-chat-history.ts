import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChatStep } from '@/lib/ai';

export interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  steps?: ChatStep[];
  proposedWrites?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: UiMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatHistory {
  conversations: Conversation[];
  activeId: string;
  messages: UiMessage[];
  /** Replace the active conversation's messages (persists; drops if empty). */
  setMessages: (next: UiMessage[]) => void;
  newChat: () => void;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  deleteChat: (id: string) => void;
}

const newId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function deriveTitle(messages: UiMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content?.trim();
  if (!first) return 'New chat';
  return first.length > 40 ? `${first.slice(0, 40)}…` : first;
}

/**
 * Per-database, multi-conversation chat history persisted to localStorage.
 * One key per database holds an array of conversations (most-recent first).
 * A "fresh" chat is just an activeId not yet present in the list — it isn't
 * persisted until its first message, so empty chats never clutter the list.
 */
export function useChatHistory(databaseName: string | undefined): ChatHistory {
  const storageKey = `justdb-ai-chats-${databaseName ?? 'default'}`;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>(() => newId());

  useEffect(() => {
    let loaded: Conversation[] = [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) loaded = JSON.parse(raw);
    } catch {
      loaded = [];
    }
    loaded.sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(loaded);
    setActiveId(loaded[0]?.id ?? newId());
  }, [storageKey]);

  const persist = useCallback(
    (all: Conversation[]) => {
      try {
        if (all.length > 0) localStorage.setItem(storageKey, JSON.stringify(all));
        else localStorage.removeItem(storageKey);
      } catch {
        // ignore quota / serialization errors
      }
    },
    [storageKey],
  );

  const messages = useMemo(
    () => conversations.find((c) => c.id === activeId)?.messages ?? [],
    [conversations, activeId],
  );

  const setMessages = useCallback(
    (next: UiMessage[]) => {
      setConversations((prev) => {
        const now = Date.now();
        const existing = prev.find((c) => c.id === activeId);
        const others = prev.filter((c) => c.id !== activeId);
        let all: Conversation[];
        if (next.length === 0) {
          all = others; // drop an emptied conversation
        } else {
          const title =
            existing && existing.title !== 'New chat' ? existing.title : deriveTitle(next);
          const conv: Conversation = {
            id: activeId,
            title,
            messages: next,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          all = [conv, ...others];
        }
        all.sort((a, b) => b.updatedAt - a.updatedAt);
        persist(all);
        return all;
      });
    },
    [activeId, persist],
  );

  const newChat = useCallback(() => setActiveId(newId()), []);
  const selectChat = useCallback((id: string) => setActiveId(id), []);

  const renameChat = useCallback(
    (id: string, title: string) => {
      setConversations((prev) => {
        const all = prev.map((c) =>
          c.id === id ? { ...c, title: title.trim() || c.title } : c,
        );
        persist(all);
        return all;
      });
    },
    [persist],
  );

  const deleteChat = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const all = prev.filter((c) => c.id !== id);
        persist(all);
        return all;
      });
      // Deleting the active chat drops you into a fresh one.
      setActiveId((cur) => (cur === id ? newId() : cur));
    },
    [persist],
  );

  return {
    conversations,
    activeId,
    messages,
    setMessages,
    newChat,
    selectChat,
    renameChat,
    deleteChat,
  };
}
