
import React, { useState } from 'react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DBConfig } from '@/types';
import { parseConnectionURL, isConnectionURL, sqliteDisplayName } from '@/lib/connection-url';
import { Checkbox, Input as JustInput } from '@codellyson/justui/react';

type InputMode = 'url' | 'fields';
type DbType = 'postgresql' | 'mysql' | 'sqlite';

interface ConnectionFormProps {
  onConnect: (config: DBConfig, name?: string) => void;
  isConnecting: boolean;
  onCancel?: () => void;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnect,
  isConnecting,
  onCancel,
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
  const [isPickingFile, setIsPickingFile] = useState(false);

  const handlePickFile = async () => {
    setIsPickingFile(true);
    setErrors((prev) => { const next = { ...prev }; delete next.filepath; return next; });
    try {
      const selected = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [
          { name: 'SQLite database', extensions: ['db', 'sqlite', 'sqlite3', 's3db'] },
        ],
      });
      if (typeof selected === 'string' && selected) {
        setFilepath(selected);
        setUploadedFileName(selected.split('/').pop() || selected);
      }
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, filepath: err?.message || 'Could not open file picker' }));
    } finally {
      setIsPickingFile(false);
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
      const dbName = sqliteDisplayName(resolvedPath);
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
      // Rust's DbConfig declares `ssl: bool`. URL-derived ssl wins when
      // explicit (sslmode=require|disable); otherwise fall back to the
      // form's "Use SSL" checkbox.
      const sslOn = parsed.ssl ?? useSSL;
      config = {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        ssl: sslOn,
        type: parsed.type,
      };
    } else {
      config = {
        host: host.trim(),
        port: Number(port),
        database: database.trim(),
        username: username.trim(),
        password: password,
        ssl: useSSL,
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
          onClick={() => handleDbTypeChange('sqlite')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md border transition-colors ${
            dbType === 'sqlite'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-secondary hover:text-primary hover:bg-bg-secondary'
          }`}
        >
          SQLite
        </button>
        {/* MySQL chip stays hidden until the Rust backend grows a MySQL
            driver. handleDbTypeChange('mysql') and the config builder for
            it are still wired below — unhide once the dispatch layer ships. */}
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {mode === 'url' ? (
          <div>
            <label className="block text-xs font-medium text-secondary mb-1">
              {dbType === 'sqlite' ? 'Connection URL' : 'Connection URL'}
            </label>
            <JustInput
              value={connectionUrl}
              onChange={parseUrl}
              placeholder={urlPlaceholder}
              disabled={isConnecting}
              containerClassName="w-full"
              className="font-mono"
            />
            {errors.connectionUrl && (
              <p className="mt-1 text-xs text-danger">{errors.connectionUrl}</p>
            )}
            {dbType !== 'sqlite' && connectionUrl && !errors.connectionUrl && isConnectionURL(connectionUrl) && (
              <p className="mt-1 text-xs font-mono text-muted">
                {host}:{port}/{database} as {username}
              </p>
            )}
            {dbType === 'sqlite' && /^libsql:\/\//i.test(connectionUrl.trim()) && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-secondary mb-1">
                  Auth token
                </label>
                <JustInput
                  type="password"
                  withPasswordToggle
                  value={authToken}
                  onChange={setAuthToken}
                  placeholder="eyJhbGciOi… (required for Turso unless embedded in the URL via ?authToken=…)"
                  disabled={isConnecting}
                  containerClassName="w-full"
                  className="font-mono"
                />
              </div>
            )}
          </div>
        ) : dbType === 'sqlite' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                SQLite file or Turso URL
              </label>
              <div className="flex gap-2">
                <JustInput
                  value={uploadedFileName || filepath}
                  onChange={(v) => { setFilepath(v); setUploadedFileName(''); }}
                  placeholder="libsql://dbname.turso.io  or  /path/to/file.db"
                  disabled={isConnecting || isPickingFile}
                  containerClassName="flex-1"
                  className="font-mono"
                />
                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={isConnecting || isPickingFile}
                  className="px-3 py-2 text-xs font-medium rounded-md border border-border text-secondary hover:text-primary hover:bg-bg-secondary transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {isPickingFile ? 'Choosing...' : 'Choose .db'}
                </button>
              </div>
              {errors.filepath && (
                <p className="mt-1 text-xs text-danger">{errors.filepath}</p>
              )}
              {uploadedFileName && !errors.filepath && (
                <p className="mt-1 text-xs text-muted break-all">
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
                inputMode="numeric"
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
            <Checkbox
              checked={useSSL}
              onChange={(checked) => setUseSSL(checked === true)}
              disabled={isConnecting}
              label={<span className="text-xs font-medium text-primary">SSL</span>}
            />
            <Checkbox
              checked={saveConnection}
              onChange={(checked) => setSaveConnection(checked === true)}
              disabled={isConnecting}
              label={<span className="text-xs font-medium text-primary">Save connection</span>}
            />
          </div>
        )}
        {dbType === 'sqlite' && (
          <div className="flex items-center gap-4 flex-wrap">
            <Checkbox
              checked={saveConnection}
              onChange={(checked) => setSaveConnection(checked === true)}
              disabled={isConnecting}
              label={<span className="text-xs font-medium text-primary">Save connection</span>}
            />
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
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            isLoading={isConnecting}
            disabled={isConnecting}
          >
            Connect
          </Button>
          {isConnecting && onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
