export function exportCSV(columns: string[], data: any[], tableName: string): void {
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

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  downloadBlob(csvContent, `${tableName}_${dateStamp()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportJSON(columns: string[], data: any[], tableName: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadBlob(jsonContent, `${tableName}_${dateStamp()}.json`, 'application/json;charset=utf-8;');
}

export function exportSQL(columns: string[], data: any[], tableName: string): void {
  const lines = data.map((row) => {
    const values = columns.map((col) => {
      const value = row[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      const escaped = String(value).replace(/'/g, "''");
      return `'${escaped}'`;
    });
    return `INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${values.join(', ')});`;
  });

  const sqlContent = lines.join('\n');
  downloadBlob(sqlContent, `${tableName}_${dateStamp()}.sql`, 'text/sql;charset=utf-8;');
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function dateStamp(): string {
  return new Date().toISOString().split('T')[0];
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
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
