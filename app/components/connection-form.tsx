'use client';

import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DBConfig } from '@/types';
import { parseConnectionURL, isConnectionURL, detectDatabaseType } from '@/lib/connection-url';

type InputMode = 'url' | 'fields';
type DbType = 'postgresql' | 'mysql' | 'sqlite';

interface ConnectionFormProps {
  onConnect: (config: DBConfig, name?: string) => void;
  isConnecting: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnect,
  isConnecting,
}) => {
  const [dbType, setDbType] = useState<DbType>('postgresql');
  const [mode, setMode] = useState<InputMode>('url');
  const [connectionUrl, setConnectionUrl] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useSSL, setUseSSL] = useState(true);
  const [connectionName, setConnectionName] = useState('');
  const [saveConnection, setSaveConnection] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filepath, setFilepath] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrors((prev) => { const next = { ...prev }; delete next.filepath; return next; });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-sqlite', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setFilepath(data.filepath);
      setUploadedFileName(data.filename);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, filepath: err.message }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDbTypeChange = (type: DbType) => {
    setDbType(type);
    if (type === 'sqlite') {
      setPort('0');
    } else {
      setPort(type === 'mysql' ? '3306' : '5432');
    }
  };

  const parseUrl = (url: string) => {
    setConnectionUrl(url);
    if (!url.trim()) return;

    try {
      if (isConnectionURL(url)) {
        const parsed = parseConnectionURL(url);
        setDbType(parsed.type);
        if (parsed.type === 'sqlite') {
          setFilepath(parsed.filepath || '');
          if (parsed.authToken) setAuthToken(parsed.authToken);
        } else {
          setHost(parsed.host);
          setPort(String(parsed.port));
          setDatabase(parsed.database);
          setUsername(parsed.username);
          setPassword(parsed.password);
          if (parsed.ssl !== undefined) {
            setUseSSL(parsed.ssl !== false);
          }
        }
        setErrors((prev) => {
          const next = { ...prev };
          delete next.connectionUrl;
          return next;
        });
      }
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, connectionUrl: err.message }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (dbType === 'sqlite') {
      if (mode === 'url') {
        if (!connectionUrl.trim()) {
          newErrors.connectionUrl = 'Connection URL is required';
        } else if (!isConnectionURL(connectionUrl)) {
          newErrors.connectionUrl = 'Invalid URL format. Use libsql://dbname.turso.io or sqlite:///path/to/db';
        }
      } else {
        if (!filepath.trim()) {
          newErrors.filepath = 'URL or file path is required';
        }
      }
    } else if (mode === 'url') {
      if (!connectionUrl.trim()) {
        newErrors.connectionUrl = 'Connection URL is required';
      } else if (!isConnectionURL(connectionUrl)) {
        newErrors.connectionUrl = 'Invalid URL format. Use postgresql:// or mysql://user:pass@host:port/db';
      } else {
        try {
          parseConnectionURL(connectionUrl);
        } catch (err: any) {
          newErrors.connectionUrl = err.message;
        }
      }
    } else {
      if (!host.trim()) newErrors.host = 'Host is required';
      if (!port.trim()) {
        newErrors.port = 'Port is required';
      } else if (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
        newErrors.port = 'Port must be between 1 and 65535';
      }
      if (!database.trim()) newErrors.database = 'Database name is required';
      if (!username.trim()) newErrors.username = 'Username is required';
    }

    if (saveConnection && !connectionName.trim()) {
      newErrors.connectionName = 'Connection name is required when saving';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let config: DBConfig;

    if (dbType === 'sqlite') {
      let resolvedPath = filepath.trim();
      let token = authToken.trim();
      if (mode === 'url') {
        const parsed = parseConnectionURL(connectionUrl);
        resolvedPath = parsed.filepath || '';
        token = parsed.authToken || token;
      }
      const dbName = resolvedPath.split('/').pop()?.replace(/\.[^.]+$/, '')
        || resolvedPath.split('.')[0] || 'sqlite';
      config = {
        host: 'localhost',
        port: 0,
        database: dbName,
        username: '',
        password: '',
        type: 'sqlite',
        filepath: resolvedPath,
        authToken: token || undefined,
      };
    } else if (mode === 'url') {
      const parsed = parseConnectionURL(connectionUrl);
      config = {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        ssl: parsed.ssl ?? (useSSL ? { rejectUnauthorized: false } : false),
        type: parsed.type,
      };
    } else {
      config = {
        host: host.trim(),
        port: Number(port),
        database: database.trim(),
        username: username.trim(),
        password: password,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        type: dbType,
      };
    }

    const name = saveConnection && connectionName.trim()
      ? connectionName.trim()
      : undefined;
    onConnect(config, name);
  };

  const urlPlaceholder = dbType === 'sqlite'
    ? 'libsql://dbname.turso.io  or  sqlite:///path/to/file.db'
    : dbType === 'mysql'
      ? 'mysql://user:password@localhost:3306/mydb'
      : 'postgresql://user:password@localhost:5432/mydb';

  return (
    <div className="border border-border rounded-lg bg-bg shadow-sm">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">New connection</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'url'
                ? 'bg-accent/10 text-accent'
                : 'text-secondary hover:text-primary hover:bg-bg-secondary'
            }`}
          >
            URL
          </button>
          <button
            type="button"
            onClick={() => setMode('fields')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              mode === 'fields'
                ? 'bg-accent/10 text-accent'
                : 'text-secondary hover:text-primary hover:bg-bg-secondary'
            }`}
          >
            Fields
          </button>
        </div>
      </div>
      <div className="px-4 pt-3 flex gap-2">
        <button
          type="button"
          onClick={() => handleDbTypeChange('postgresql')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
            dbType === 'postgresql'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-secondary hover:text-primary hover:bg-bg-secondary'
          }`}
        >
          PostgreSQL
        </button>
        <button
          type="button"
          onClick={() => handleDbTypeChange('mysql')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
            dbType === 'mysql'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-secondary hover:text-primary hover:bg-bg-secondary'
          }`}
        >
          MySQL
        </button>
        <button
          type="button"
          onClick={() => handleDbTypeChange('sqlite')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
            dbType === 'sqlite'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-secondary hover:text-primary hover:bg-bg-secondary'
          }`}
        >
          SQLite
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {mode === 'url' ? (
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              {dbType === 'sqlite' ? 'Connection URL' : 'Connection URL'}
            </label>
            <input
              type="text"
              value={connectionUrl}
              onChange={(e) => parseUrl(e.target.value)}
              placeholder={urlPlaceholder}
              disabled={isConnecting}
              className="w-full px-3 py-2 text-sm border border-border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-accent bg-bg text-primary placeholder:text-muted"
            />
            {errors.connectionUrl && (
              <p className="mt-1 text-xs text-danger">{errors.connectionUrl}</p>
            )}
            {dbType !== 'sqlite' && connectionUrl && !errors.connectionUrl && isConnectionURL(connectionUrl) && (
              <p className="mt-1 text-xs font-mono text-muted">
                {host}:{port}/{database} as {username}
              </p>
            )}
          </div>
        ) : dbType === 'sqlite' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                SQLite file or Turso URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={uploadedFileName || filepath}
                  onChange={(e) => { setFilepath(e.target.value); setUploadedFileName(''); }}
                  placeholder="libsql://dbname.turso.io  or  /path/to/file.db"
                  disabled={isConnecting || isUploading}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-accent bg-bg text-primary placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isConnecting || isUploading}
                  className="px-3 py-2 text-xs font-medium rounded-md border border-border text-secondary hover:text-primary hover:bg-bg-secondary transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Upload .db'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".db,.sqlite,.sqlite3,.s3db"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              {errors.filepath && (
                <p className="mt-1 text-xs text-danger">{errors.filepath}</p>
              )}
              {uploadedFileName && !errors.filepath && (
                <p className="mt-1 text-xs text-muted">
                  Uploaded: {uploadedFileName}
                </p>
              )}
            </div>
            <Input
              label="Auth token"
              type="password"
              value={authToken}
              onChange={setAuthToken}
              placeholder="eyJhbGciOi... (required for Turso, leave empty for local files)"
              disabled={isConnecting}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Input
                label="Host"
                type="text"
                value={host}
                onChange={setHost}
                placeholder="localhost"
                error={errors.host}
                disabled={isConnecting}
              />
              <Input
                label="Port"
                type="number"
                value={port}
                onChange={setPort}
                placeholder="5432"
                error={errors.port}
                disabled={isConnecting}
              />
            </div>
            <Input
              label="Database"
              type="text"
              value={database}
              onChange={setDatabase}
              placeholder="mydb"
              error={errors.database}
              disabled={isConnecting}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Username"
                type="text"
                value={username}
                onChange={setUsername}
                placeholder="postgres"
                error={errors.username}
                disabled={isConnecting}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                error={errors.password}
                disabled={isConnecting}
              />
            </div>
          </>
        )}
        {dbType !== 'sqlite' && (
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useSSL}
                onChange={(e) => setUseSSL(e.target.checked)}
                disabled={isConnecting}
                className="h-4 w-4 border border-border rounded-md accent-accent"
              />
              <span className="text-xs font-medium text-primary">SSL</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveConnection}
                onChange={(e) => setSaveConnection(e.target.checked)}
                disabled={isConnecting}
                className="h-4 w-4 border border-border rounded-md accent-accent"
              />
              <span className="text-xs font-medium text-primary">Save connection</span>
            </label>
          </div>
        )}
        {dbType === 'sqlite' && (
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveConnection}
                onChange={(e) => setSaveConnection(e.target.checked)}
                disabled={isConnecting}
                className="h-4 w-4 border border-border rounded-md accent-accent"
              />
              <span className="text-xs font-medium text-primary">Save connection</span>
            </label>
          </div>
        )}
        {saveConnection && (
          <Input
            label="Connection name"
            type="text"
            value={connectionName}
            onChange={setConnectionName}
            placeholder="My database"
            error={errors.connectionName}
            disabled={isConnecting}
          />
        )}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isConnecting}
          disabled={isConnecting}
        >
          Connect
        </Button>
      </form>
    </div>
  );
};
