import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './ui/modal';
import { Select } from './ui/select';
import { FormatterSettingsBody } from './formatter-settings';
import { ai, PROVIDERS, type AiStatus, type ProviderId, type LocalAgentInfo } from '@/lib/ai';
import { useTheme } from '../contexts/theme-context';
import {
  getResultRowCap, setResultRowCap, DEFAULT_ROW_CAP,
  getIdleTimeoutMin, setIdleTimeoutMin, DEFAULT_IDLE_MIN,
  getEditorLineNumbers, setEditorLineNumbers, EDITOR_SETTINGS_EVENT,
  getTelemetryEnabled, setTelemetryEnabled,
} from '@/lib/app-settings';

type Tab = 'ai' | 'appearance' | 'formatting' | 'data' | 'privacy';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Tab to focus when the modal opens (e.g. deep-linked from a banner). */
  initialTab?: Tab;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'ai', label: 'AI' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'formatting', label: 'Formatting' },
  { id: 'data', label: 'Data' },
  { id: 'privacy', label: 'Privacy' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab }) => {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'ai');
  useEffect(() => {
    if (isOpen && initialTab) setTab(initialTab);
  }, [isOpen, initialTab]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" className="!max-w-3xl">
      {/* -my-5 cancels the Modal's p-5 so the divider runs full-height. */}
      <div className="flex gap-5 -my-5">
        <nav className="flex flex-col gap-0.5 w-36 flex-shrink-0 border-r border-border pr-5 py-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-left px-2.5 py-1.5 text-sm rounded-md transition-colors ${
                tab === t.id ? 'bg-accent/10 text-accent font-medium' : 'text-secondary hover:text-primary hover:bg-bg-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 min-h-[360px] max-h-[60vh] overflow-y-auto pr-1 py-5">
          {tab === 'ai' && <AiSection />}
          {tab === 'appearance' && <AppearanceSection />}
          {tab === 'formatting' && <FormatterSettingsBody />}
          {tab === 'data' && <DataSection />}
          {tab === 'privacy' && <PrivacySection />}
        </div>
      </div>
    </Modal>
  );
};

// ─── AI ───────────────────────────────────────────────────────────────────

const AiSection: React.FC = () => {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [provider, setProvider] = useState<ProviderId>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [agents, setAgents] = useState<LocalAgentInfo[] | null>(null);

  const meta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const isLocal = meta.local === true;
  const localAgent = agents?.find((a) => a.id === provider);
  const canSave = isLocal ? !!localAgent?.present : !!apiKey.trim();

  const refresh = useCallback(() => {
    ai.status().then((s) => {
      setStatus(s);
      if (s.configured && s.provider && PROVIDERS.some((p) => p.id === s.provider)) {
        setProvider(s.provider as ProviderId);
      }
    }).catch(() => setStatus({ configured: false }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Detect installed local CLI agents once (drives the local-provider panel).
  useEffect(() => {
    ai.localAgents().then(setAgents).catch(() => setAgents([]));
  }, []);

  const save = useCallback(async () => {
    if (!canSave) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      // Local agents carry no key — the backend accepts an empty one.
      await ai.setKey(isLocal ? '' : apiKey.trim(), provider, model.trim() || undefined);
      setApiKey(''); setModel(''); setSaved(true);
      refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  }, [canSave, isLocal, apiKey, provider, model, refresh]);

  const remove = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      await ai.clearKey();
      setSaved(false);
      refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to remove key');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        AI is opt-in. {isLocal
          ? 'The local agent runs on your machine using your own login — no key is stored. Used by AI mode.'
          : "Your key is stored in the OS keychain and only leaves your machine on requests you make. Used by the SQL editor's Generate bar and AI mode."}
      </p>
      {status?.configured && (
        <div className="flex items-center gap-2 text-xs text-primary bg-bg-secondary/40 border border-border rounded-md px-2.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Connected: <span className="font-medium">{status.provider}</span>
          <span className="text-muted">·</span>
          <span className="font-mono text-muted">{status.model}</span>
        </div>
      )}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-secondary">Provider</label>
        <Select value={provider} onChange={(e) => setProvider(e.target.value as ProviderId)}>
          {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-secondary">Model (optional)</label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={`Default: ${meta.defaultModel}`}
          className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
        />
      </div>
      {isLocal ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs rounded-md border border-border px-2.5 py-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                localAgent === undefined ? 'bg-muted' : localAgent.present ? 'bg-green-500' : 'bg-danger'
              }`}
            />
            {localAgent === undefined
              ? 'Checking for a local agent…'
              : localAgent.present
                ? <span className="text-primary">Found <span className="font-medium">{localAgent.name}</span>{localAgent.path && <span className="font-mono text-muted"> · {localAgent.path}</span>}</span>
                : <span className="text-secondary">Claude Code not found — install it and run <span className="font-mono">claude</span> once to sign in.</span>}
          </div>
          <p className="text-xs text-muted">
            Uses your own installed, authenticated Claude Code — no API key, and queries run through
            the agent you already have. Subject to your agreement with Anthropic.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-secondary">
            API key {status?.configured && <span className="text-muted font-normal">(leave blank to keep current)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder={meta.keyPlaceholder}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy || !canSave}
          className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-colors"
        >
          {status?.configured ? 'Update' : 'Save'}
        </button>
        {status?.configured && (
          <button
            onClick={remove}
            disabled={busy}
            className="px-3 py-1.5 text-sm rounded-md text-danger hover:bg-danger/10 disabled:opacity-40 transition-colors"
          >
            {isLocal ? 'Disconnect' : 'Remove key'}
          </button>
        )}
        {saved && <span className="text-xs text-green-500">Saved ✓</span>}
      </div>
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
};

// ─── Appearance ─────────────────────────────────────────────────────────────

const AppearanceSection: React.FC = () => {
  const { mode, toggleMode, themeId, setThemeId, themes } = useTheme();
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-secondary">Mode</label>
        <div className="inline-flex border border-border rounded-md overflow-hidden">
          {(['light', 'dark'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { if (mode !== m) toggleMode(); }}
              className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                mode === m ? 'bg-accent text-white' : 'text-secondary hover:bg-bg-secondary'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-secondary">Theme</label>
        <Select value={themeId} onChange={(e) => setThemeId(e.target.value)}>
          {themes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </Select>
      </div>
    </div>
  );
};

// ─── Data ───────────────────────────────────────────────────────────────────

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const DataSection: React.FC = () => {
  const [rowCap, setRowCap] = useState(String(getResultRowCap()));
  const [idleMin, setIdleMin] = useState(String(getIdleTimeoutMin()));
  const [lineNumbers, setLineNumbers] = useState(getEditorLineNumbers());

  const toggleLineNumbers = () => {
    const next = !lineNumbers;
    setLineNumbers(next);
    setEditorLineNumbers(next);
    window.dispatchEvent(new CustomEvent(EDITOR_SETTINGS_EVENT));
  };

  // Commit on blur/Enter so the field can be edited (incl. temporarily empty)
  // freely, then snaps to a clamped, persisted value that matches what's used.
  const commitRowCap = () => {
    const n = parseInt(rowCap, 10);
    const v = Number.isNaN(n) ? getResultRowCap() : clamp(n, 10, 5000);
    setResultRowCap(v);
    setRowCap(String(v));
  };
  const commitIdle = () => {
    const n = parseInt(idleMin, 10);
    const v = Number.isNaN(n) ? getIdleTimeoutMin() : clamp(n, 1, 1440);
    setIdleTimeoutMin(v);
    setIdleMin(String(v));
  };

  const numberInput =
    'w-32 px-2 py-1.5 text-sm border border-border rounded-md bg-bg text-primary focus:outline-none focus:ring-2 focus:ring-accent';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-secondary">Show line numbers in the SQL editor</label>
        <button
          onClick={toggleLineNumbers}
          role="switch"
          aria-checked={lineNumbers}
          aria-label="Show line numbers"
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${lineNumbers ? 'bg-accent' : 'bg-border'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${lineNumbers ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-secondary">SQL editor result limit</label>
        <input
          type="text" inputMode="numeric" value={rowCap}
          onChange={(e) => setRowCap(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitRowCap}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={numberInput}
        />
        <p className="text-xs text-muted">
          Max rows rendered before truncating (default {DEFAULT_ROW_CAP}, range 10–5000). Add an
          explicit LIMIT for more. Applies to the next query.
        </p>
      </div>
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-secondary">Idle disconnect (minutes)</label>
        <input
          type="text" inputMode="numeric" value={idleMin}
          onChange={(e) => setIdleMin(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitIdle}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className={numberInput}
        />
        <p className="text-xs text-muted">
          Auto-disconnect after this much inactivity (default {DEFAULT_IDLE_MIN}, range 1–1440).
          Applies to the next connection.
        </p>
      </div>
    </div>
  );
};

// ─── Privacy ─────────────────────────────────────────────────────────────────

const PrivacySection: React.FC = () => {
  const [enabled, setEnabled] = useState(getTelemetryEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setTelemetryEnabled(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <label className="text-xs font-medium text-secondary">Send anonymous usage analytics</label>
        <button
          onClick={toggle}
          role="switch"
          aria-checked={enabled}
          aria-label="Send anonymous usage analytics"
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-border'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
      </div>
      <p className="text-xs text-muted leading-relaxed">
        Helps us understand how many people use JustDB and which features matter.
        It's fully anonymous — no account, no tracking across sessions.
      </p>
      <div className="text-xs text-muted leading-relaxed space-y-1.5 border-t border-border pt-3">
        <p className="font-medium text-secondary">We never collect:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Your SQL, query results, or any row data</li>
          <li>Connection details — hosts, ports, database names, credentials</li>
          <li>Table names, column names, or file paths</li>
        </ul>
        <p className="pt-1">
          Only things like: app version, OS, database engine type, and coarse
          feature-usage counts.
        </p>
      </div>
    </div>
  );
};
