/**
 * Small localStorage-backed store for miscellaneous app preferences exposed
 * in the Settings screen. Consumers read these at point-of-use (they're read
 * infrequently), so no context/subscription is needed.
 */

const KEYS = {
  rowCap: 'justdb-result-row-cap',
  idleMin: 'justdb-idle-timeout-min',
} as const;

export const DEFAULT_ROW_CAP = 200;
export const DEFAULT_IDLE_MIN = 30;

function readNumber(key: string, def: number, min: number, max: number): number {
  try {
    const v = parseInt(localStorage.getItem(key) ?? '', 10);
    if (Number.isFinite(v) && v >= min && v <= max) return v;
  } catch {
    // ignore
  }
  return def;
}

function writeNumber(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // ignore
  }
}

/** Max rows the SQL editor renders before truncating (10–5000). */
export const getResultRowCap = () => readNumber(KEYS.rowCap, DEFAULT_ROW_CAP, 10, 5000);
export const setResultRowCap = (n: number) => writeNumber(KEYS.rowCap, n);

/** Minutes of inactivity before auto-disconnect (1–1440). */
export const getIdleTimeoutMin = () => readNumber(KEYS.idleMin, DEFAULT_IDLE_MIN, 1, 1440);
export const setIdleTimeoutMin = (n: number) => writeNumber(KEYS.idleMin, n);
