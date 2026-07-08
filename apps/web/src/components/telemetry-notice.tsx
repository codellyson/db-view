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
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-bg shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path strokeLinecap="round" d="M8 7.5v3.5M8 5h.01" />
        </svg>
        <div className="min-w-0">
          <p className="text-sm text-primary font-medium">Anonymous usage analytics</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            JustDB counts app usage to guide what we build. No queries, no data,
            no connection details — ever.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={dismiss}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              Got it
            </button>
            <button
              onClick={openPrivacy}
              className="px-2.5 py-1 text-xs font-medium rounded-md text-secondary hover:text-primary hover:bg-bg-secondary transition-colors"
            >
              Turn off in Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
