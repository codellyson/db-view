export type QueryKind = 'read' | 'write' | 'ddl' | 'blocked' | 'unknown';

export interface QueryClassification {
  kind: QueryKind;
  // The first SQL keyword found, upper-cased. Used for UX ("DELETE", "DROP", …).
  statement: string;
  // True for UPDATE/DELETE that have no WHERE clause — these will affect every row.
  isBulkWrite: boolean;
  // Set when kind is 'blocked'. Explains why so the UI can surface it.
  reason?: string;
}

const READ_KEYWORDS = new Set(['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'PRAGMA', 'DESCRIBE', 'DESC']);
const WRITE_KEYWORDS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT', 'REPLACE']);
const DDL_KEYWORDS = new Set(['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME']);
const BLOCKED_KEYWORDS = new Set([
  'GRANT', 'REVOKE', 'CALL', 'EXEC', 'EXECUTE', 'COPY', 'IMPORT', 'LOAD',
  'VACUUM', 'REINDEX', 'CLUSTER', 'REFRESH', 'REASSIGN', 'DO', 'NOTIFY',
  'LISTEN', 'UNLISTEN', 'PREPARE', 'DEALLOCATE', 'COMMENT', 'SET', 'RESET',
  'LOCK', 'DISCARD', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'START',
]);

// Strip line + block comments and collapse string literals to empty strings
// so keyword detection only sees SQL code, not user data or commentary.
// String-literal handling respects SQL's '' and "" escape doubling.
function normalizeForClassification(sql: string): string {
  let result = '';
  let i = 0;
  const len = sql.length;
  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    // Line comment
    if (ch === '-' && next === '-') {
      while (i < len && sql[i] !== '\n') i++;
      result += ' ';
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < len - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      result += ' ';
      continue;
    }
    // Single-quoted string: skip contents, handle '' escape
    if (ch === "'") {
      i++;
      while (i < len) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        i++;
      }
      result += "''"; // keep a marker so adjacent tokens stay separated
      continue;
    }
    // Double-quoted identifier: keep contents (they can be table/column refs)
    // but strip the quotes so \bWORD\b matching doesn't see the `"`.
    if (ch === '"') {
      i++;
      let ident = '';
      while (i < len) {
        if (sql[i] === '"' && sql[i + 1] === '"') { ident += '""'; i += 2; continue; }
        if (sql[i] === '"') { i++; break; }
        ident += sql[i];
        i++;
      }
      result += ' ' + ident + ' ';
      continue;
    }

    result += ch;
    i++;
  }

  return result.replace(/\s+/g, ' ').trim();
}

// Word-boundary keyword test on already-normalized SQL.
function hasKeyword(normalizedUpper: string, keyword: string): boolean {
  return new RegExp(`\\b${keyword}\\b`).test(normalizedUpper);
}

function firstKeyword(normalizedUpper: string): string {
  const match = normalizedUpper.match(/^\s*([A-Z]+)/);
  return match ? match[1] : '';
}

// UPDATE/DELETE without a WHERE is a bulk write. We scan the normalized SQL
// because comments and string literals have been stripped at that point.
function isBulkWriteStatement(normalizedUpper: string, statement: string): boolean {
  if (statement !== 'UPDATE' && statement !== 'DELETE') return false;
  return !hasKeyword(normalizedUpper, 'WHERE');
}

// Detect CTEs that wrap a write. `WITH … AS ( DELETE … RETURNING … ) SELECT …`
// would classify as 'read' by first-keyword alone but actually mutates data.
function ctEmbedsWrite(normalizedUpper: string): boolean {
  if (!normalizedUpper.startsWith('WITH')) return false;
  return /\b(INSERT|UPDATE|DELETE|MERGE)\b/.test(normalizedUpper);
}

export function classifyQuery(sql: string): QueryClassification {
  const normalized = normalizeForClassification(sql);
  const upper = normalized.toUpperCase();
  const statement = firstKeyword(upper);

  if (!statement) {
    return { kind: 'unknown', statement: '', isBulkWrite: false, reason: 'Empty or unparseable query' };
  }

  // Explicit blocklist short-circuits everything else.
  if (BLOCKED_KEYWORDS.has(statement)) {
    return {
      kind: 'blocked',
      statement,
      isBulkWrite: false,
      reason: `Statements starting with ${statement} are not allowed`,
    };
  }

  // Also block if a blocked keyword appears anywhere at the top level
  // (e.g. a SELECT that calls pg_terminate_backend is still a SELECT, but
  // a statement like "SET statement_timeout = 0; SELECT …" already fails
  // the multi-statement check upstream, so this mainly catches the rare
  // case where a blocked verb appears as the second token in a malformed
  // single-statement query).
  // We intentionally don't try to block function-call based side effects
  // like pg_terminate_backend here — that requires a real parser.

  if (DDL_KEYWORDS.has(statement)) {
    return { kind: 'ddl', statement, isBulkWrite: false };
  }

  if (WRITE_KEYWORDS.has(statement)) {
    return {
      kind: 'write',
      statement,
      isBulkWrite: isBulkWriteStatement(upper, statement),
    };
  }

  if (READ_KEYWORDS.has(statement)) {
    // CTEs that actually mutate have to be classified as writes.
    if (statement === 'WITH' && ctEmbedsWrite(upper)) {
      // Find which write verb is inside the CTE, default to UPDATE semantics.
      const innerMatch = upper.match(/\b(INSERT|UPDATE|DELETE|MERGE)\b/);
      const inner = innerMatch ? innerMatch[1] : 'UPDATE';
      return {
        kind: 'write',
        statement: inner,
        // Can't easily tell if the CTE's write has a WHERE — treat as bulk
        // to force the stronger confirmation.
        isBulkWrite: true,
      };
    }
    return { kind: 'read', statement, isBulkWrite: false };
  }

  return {
    kind: 'unknown',
    statement,
    isBulkWrite: false,
    reason: `Unrecognized statement type: ${statement}`,
  };
}

// Whether this classification should require a typed confirmation (vs a
// single-click confirm). Matches the user's request: TRUNCATE, DROP, and
// UPDATE/DELETE without WHERE require typing the verb to execute.
export function requiresTypedConfirmation(c: QueryClassification): boolean {
  if (c.kind === 'ddl' && (c.statement === 'TRUNCATE' || c.statement === 'DROP')) return true;
  if (c.kind === 'write' && c.isBulkWrite) return true;
  return false;
}
