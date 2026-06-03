import { format } from 'sql-formatter';

export function formatSQL(
  query: string,
  dialect: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
): string {
  try {
    return format(query, {
      language: dialect === 'mysql' ? 'mysql' : dialect === 'sqlite' ? 'sqlite' : 'postgresql',
      keywordCase: 'upper',
      indentStyle: 'standard',
      tabWidth: 2,
    });
  } catch {
    return query;
  }
}
