import { format } from 'sql-formatter';

export function formatSQL(query: string): string {
  try {
    return format(query, {
      language: 'postgresql',
      keywordCase: 'upper',
      indentStyle: 'standard',
      tabWidth: 2,
    });
  } catch {
    return query;
  }
}
