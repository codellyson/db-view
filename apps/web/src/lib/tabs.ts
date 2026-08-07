import type { Tab } from '../components/tab-bar';

/**
 * Which tab takes over when the active `tabId` is closed, given the tab list
 * as it stands *before* the close. The neighbour to the right inherits focus,
 * falling back to the one on the left when the last tab goes.
 */
export function nextActiveAfterClose(tabs: Tab[], tabId: string): Tab | undefined {
  const closedIndex = tabs.findIndex((t) => t.id === tabId);
  if (closedIndex === -1) return undefined;
  const remaining = tabs.filter((t) => t.id !== tabId);
  return remaining[Math.min(closedIndex, remaining.length - 1)];
}

export function reorderTabs(tabs: Tab[], fromId: string, toId: string): Tab[] {
  const fromIdx = tabs.findIndex((t) => t.id === fromId);
  const toIdx = tabs.findIndex((t) => t.id === toId);
  if (fromIdx === -1 || toIdx === -1) return tabs;
  const next = [...tabs];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}
