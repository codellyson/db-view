export function generateCSVContent(columns: string[], data: any[]): string {
  const csvHeaders = columns.join(',');
  const csvRows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',')
  );

  return [csvHeaders, ...csvRows].join('\n');
}

export function generateJSONContent(data: any[]): string {
  return JSON.stringify(data, null, 2);
}

export function generateSQLContent(
  columns: string[],
  data: any[],
  tableName: string,
  dialect: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
): string {
  const quoteId = (name: string) =>
    dialect === 'mysql'
      ? `\`${name.replace(/`/g, '``')}\``
      : `"${name.replace(/"/g, '""')}"`;

  const lines = data.map((row) => {
    const values = columns.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      const escaped = String(value).replace(/'/g, "''");
      return `'${escaped}'`;
    });
    return `INSERT INTO ${quoteId(tableName)} (${columns.map(quoteId).join(', ')}) VALUES (${values.join(', ')});`;
  });

  return lines.join('\n');
}

export function downloadBlob(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function dateStamp(): string {
  return new Date().toISOString().split('T')[0];
}

export function exportCSV(columns: string[], data: any[], tableName: string): void {
  const csvContent = generateCSVContent(columns, data);
  downloadBlob(csvContent, `${tableName}_${dateStamp()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportJSON(columns: string[], data: any[], tableName: string): void {
  const jsonContent = generateJSONContent(data);
  downloadBlob(jsonContent, `${tableName}_${dateStamp()}.json`, 'application/json;charset=utf-8;');
}

export function exportSQL(
  columns: string[],
  data: any[],
  tableName: string,
  dialect: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
): void {
  const sqlContent = generateSQLContent(columns, data, tableName, dialect);
  downloadBlob(sqlContent, `${tableName}_${dateStamp()}.sql`, 'text/sql;charset=utf-8;');
}
