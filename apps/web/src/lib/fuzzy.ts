/**
 * Tiny fuzzy matcher used by table picker, command palette, and sidebar
 * search. Scoring: prefix match (0) > substring match (1+pos) > subsequence
 * (100+gap-count). Lower score is better.
 */
export function fuzzyMatch(query: string, target: string): { matched: boolean; score: number } {
  if (!query) return { matched: true, score: 0 };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.startsWith(q)) return { matched: true, score: 0 };
  const subIdx = t.indexOf(q);
  if (subIdx >= 0) return { matched: true, score: 1 + subIdx };
  let qi = 0;
  let lastIdx = -1;
  let gaps = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      if (lastIdx >= 0) gaps += i - lastIdx - 1;
      lastIdx = i;
      qi++;
    }
  }
  if (qi === q.length) return { matched: true, score: 100 + gaps };
  return { matched: false, score: Infinity };
}
