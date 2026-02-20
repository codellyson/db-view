'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DBConfig } from '@/types';

interface ConnectionFormProps {
  onConnect: (config: DBConfig, name?: string) => void;
  isConnecting: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  onConnect,
  isConnecting,
}) => {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useSSL, setUseSSL] = useState(true);
  const [connectionName, setConnectionName] = useState('');
  const [saveConnection, setSaveConnection] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!host.trim()) {
      newErrors.host = 'Host is required';
    }
    if (!port.trim()) {
      newErrors.port = 'Port is required';
    } else if (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
      newErrors.port = 'Port must be a valid number between 1 and 65535';
    }
    if (!database.trim()) {
      newErrors.database = 'Database name is required';
    }
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    }
    if (saveConnection && !connectionName.trim()) {
      newErrors.connectionName = 'Connection name is required when saving';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      const name = saveConnection && connectionName.trim()
        ? connectionName.trim()
        : undefined;
      onConnect({
        host: host.trim(),
        port: Number(port),
        database: database.trim(),
        username: username.trim(),
        password: password,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
      }, name);
    }
  };

  return (
    <div className="border-2 border-black dark:border-white bg-white dark:bg-black">
      <div className="border-b-2 border-black dark:border-white px-4 py-3 bg-black dark:bg-white">
        <h3 className="text-sm font-bold uppercase text-white dark:text-black">NEW CONNECTION</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Input
            label="HOST"
            type="text"
            value={host}
            onChange={setHost}
            placeholder="localhost"
            error={errors.host}
            disabled={isConnecting}
          />
          <Input
            label="PORT"
            type="number"
            value={port}
            onChange={setPort}
            placeholder="5432"
            error={errors.port}
            disabled={isConnecting}
          />
        </div>
        <Input
          label="DATABASE"
          type="text"
          value={database}
          onChange={setDatabase}
          placeholder="mydb"
          error={errors.database}
          disabled={isConnecting}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="USERNAME"
            type="text"
            value={username}
            onChange={setUsername}
            placeholder="postgres"
            error={errors.username}
            disabled={isConnecting}
          />
          <Input
            label="PASSWORD"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            error={errors.password}
            disabled={isConnecting}
          />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSSL}
              onChange={(e) => setUseSSL(e.target.checked)}
              disabled={isConnecting}
              className="h-4 w-4 border-2 border-black dark:border-white rounded-none accent-black dark:accent-white"
            />
            <span className="text-xs font-bold uppercase text-black dark:text-white">SSL</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveConnection}
              onChange={(e) => setSaveConnection(e.target.checked)}
              disabled={isConnecting}
              className="h-4 w-4 border-2 border-black dark:border-white rounded-none accent-black dark:accent-white"
            />
            <span className="text-xs font-bold uppercase text-black dark:text-white">SAVE CONNECTION</span>
          </label>
        </div>
        {saveConnection && (
          <Input
            label="CONNECTION NAME"
            type="text"
            value={connectionName}
            onChange={setConnectionName}
            placeholder="MY DATABASE"
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
          CONNECT
        </Button>
      </form>
    </div>
  );
};
