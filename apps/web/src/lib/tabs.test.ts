import { describe, expect, it } from 'vitest';
import { nextActiveAfterClose, reorderTabs } from './tabs';
import type { Tab } from '../components/tab-bar';

const tab = (id: string): Tab => ({ id, label: id, type: 'table' });
const tabs = [tab('a'), tab('b'), tab('c')];
const ids = (list: Tab[]) => list.map((t) => t.id);

describe('nextActiveAfterClose', () => {
  it('hands focus to the neighbour on the right', () => {
    expect(nextActiveAfterClose(tabs, 'a')?.id).toBe('b');
    expect(nextActiveAfterClose(tabs, 'b')?.id).toBe('c');
  });

  it('falls back to the left when the last tab closes', () => {
    expect(nextActiveAfterClose(tabs, 'c')?.id).toBe('b');
  });

  it('leaves nothing active when the only tab closes', () => {
    expect(nextActiveAfterClose([tab('a')], 'a')).toBeUndefined();
  });

  it('returns nothing for a tab that is not open', () => {
    expect(nextActiveAfterClose(tabs, 'missing')).toBeUndefined();
  });
});

describe('reorderTabs', () => {
  it('moves a tab to the target position', () => {
    expect(ids(reorderTabs(tabs, 'a', 'c'))).toEqual(['b', 'c', 'a']);
    expect(ids(reorderTabs(tabs, 'c', 'a'))).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op for the same tab', () => {
    expect(ids(reorderTabs(tabs, 'b', 'b'))).toEqual(['a', 'b', 'c']);
  });

  it('returns the original list when either id is unknown', () => {
    expect(reorderTabs(tabs, 'a', 'missing')).toBe(tabs);
    expect(reorderTabs(tabs, 'missing', 'a')).toBe(tabs);
  });

  it('does not mutate the input', () => {
    reorderTabs(tabs, 'a', 'c');
    expect(ids(tabs)).toEqual(['a', 'b', 'c']);
  });
});
