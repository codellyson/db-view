/**
 * Anonymous usage analytics (Aptabase).
 *
 * The ONLY events that can be sent are the ones enumerated in the
 * `TelemetryEvent` union below, and every property is an enum, a number, or a
 * bucket — never free-form text. This is deliberate: it makes it impossible to
 * accidentally ship SQL, connection strings, table/column names, file paths, or
 * row data. If a value can't be expressed as an enum/number, it doesn't belong
 * here.
 *
 * Sends are gated on the user's opt-out setting and fail silently (the Aptabase
 * plugin is only registered in builds carrying an app key, so `trackEvent`
 * rejects harmlessly in dev / browser).
 */
import { trackEvent } from '@aptabase/tauri';
import { getTelemetryEnabled } from './app-settings';

export type DbKind = 'postgres' | 'mysql' | 'sqlite' | 'unknown';

/** Normalize the backend's engine label to a stable telemetry enum. */
export function toDbKind(raw?: string): DbKind {
  switch (raw) {
    case 'postgresql':
    case 'postgres':
      return 'postgres';
    case 'mysql':
      return 'mysql';
    case 'sqlite':
      return 'sqlite';
    default:
      return 'unknown';
  }
}

export type FeatureName =
  | 'export'
  | 'csv_import'
  | 'ai_generate'
  | 'ai_fix'
  | 'ai_interpret'
  | 'explain'
  | 'fk_peek'
  | 'save_query';

export type DurationBucket = '<100ms' | '<1s' | '<5s' | '>=5s';

/** Coarse latency buckets so we never ship a precise timing that could
 *  fingerprint a specific query/dataset. */
export function bucketDuration(ms: number): DurationBucket {
  if (ms < 100) return '<100ms';
  if (ms < 1000) return '<1s';
  if (ms < 5000) return '<5s';
  return '>=5s';
}

type TelemetryEvent =
  | { name: 'app_opened' }
  | { name: 'connection_opened'; db_type: DbKind; success: boolean }
  | { name: 'query_executed'; duration_bucket: DurationBucket; has_rows: boolean }
  // No props: the error text can contain table/column names, so we only
  // record that a failure happened, never why.
  | { name: 'query_failed' }
  | { name: 'feature_used'; feature: FeatureName };

export async function track(event: TelemetryEvent): Promise<void> {
  if (!getTelemetryEnabled()) return;

  const { name, ...rest } = event;
  const props: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(rest)) {
    props[key] = typeof value === 'boolean' ? String(value) : value;
  }

  try {
    await trackEvent(name, Object.keys(props).length ? props : undefined);
  } catch {
    // Best-effort: plugin absent (dev / no app key) or offline. Telemetry
    // must never surface an error to the user.
  }
}
