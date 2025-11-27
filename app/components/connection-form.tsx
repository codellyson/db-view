'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
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
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.svg"
              alt="DBView"
              width={80}
              height={80}
              priority
            />
          </div>
          <h1 className="text-4xl font-bold uppercase tracking-tight text-black mb-4">DBVIEW</h1>
          <p className="text-sm uppercase font-bold text-black">POSTGRESQL CONNECTION</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Input
            label="DATABASE"
            type="text"
            value={database}
            onChange={setDatabase}
            placeholder="mydb"
            error={errors.database}
            disabled={isConnecting}
          />
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ssl"
              checked={useSSL}
              onChange={(e) => setUseSSL(e.target.checked)}
              disabled={isConnecting}
              className="h-5 w-5 border-2 border-black rounded-none accent-black"
            />
            <label htmlFor="ssl" className="text-sm font-bold uppercase text-black">
              USE SSL (REQUIRED FOR MOST CLOUD DATABASES)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="save"
              checked={saveConnection}
              onChange={(e) => setSaveConnection(e.target.checked)}
              disabled={isConnecting}
              className="h-5 w-5 border-2 border-black rounded-none accent-black"
            />
            <label htmlFor="save" className="text-sm font-bold uppercase text-black">
              SAVE CONNECTION
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
            CONNECT DATABASE
          </Button>
        </form>
      </Card>
    </div>
  );
};

