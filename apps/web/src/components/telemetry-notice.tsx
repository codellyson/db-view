import React, { useEffect, useState } from 'react';
import { track } from '@/lib/telemetry';
import { getTelemetryNoticeSeen, setTelemetryNoticeSeen } from '@/lib/app-settings';

// Module-level guard so `app_opened` fires exactly once per launch, even
// under React StrictMode's double-invoked effects in dev.
let appOpenedSent = false;

/**
 * Fires the once-per-launch `app_opened` event (the signal behind active-user
 * counts) and shows a one-time, dismissible notice that anonymous analytics is
 * on — the transparency half of the opt-out model.
 */
export const TelemetryNotice: React.FC = () => {
  const [show, setShow] = useState(() => !getTelemetryNoticeSeen());

  useEffect(() => {
    if (appOpenedSent) return;
    appOpenedSent = true;
    void track({ name: 'app_opened' });
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setTelemetryNoticeSeen();
    setShow(false);
  };

  const openPrivacy = () => {
    window.dispatchEvent(
      new CustomEvent('justdb:open-settings', { detail: { tab: 'privacy' } }),
    );
    dismiss();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-md border border-border bg-bg/95 backdrop-blur px-3 py-1.5 text-xs text-muted shadow-md">
      <span>Anonymous usage stats help improve JustDB.</span>
      <button
        onClick={openPrivacy}
        className="text-secondary hover:text-primary transition-colors"
      >
        Settings
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-0.5 text-muted hover:text-primary transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
          <path strokeLinecap="round" d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
};
