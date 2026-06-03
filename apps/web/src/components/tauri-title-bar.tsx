
import { useEffect, useState } from "react";
import { isTauriRuntime } from "@/lib/api-tauri";

const BAR_HEIGHT = 32;

async function withWindow<T>(fn: (win: import("@tauri-apps/api/window").Window) => Promise<T>): Promise<T | void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return fn(getCurrentWindow());
}

export function TauriTitleBar() {
  const [show, setShow] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    setShow(true);
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      if (cancelled) return;
      setMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });
      document.body.style.paddingTop = `${BAR_HEIGHT}px`;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
      document.body.style.paddingTop = "";
    };
  }, []);

  if (!show) return null;

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between bg-bg-secondary text-primary border-b border-border select-none"
      style={{ height: BAR_HEIGHT }}
    >
      <div data-tauri-drag-region className="flex items-center gap-2 px-3 text-xs font-medium text-secondary pointer-events-none">
        <span>JustDB</span>
      </div>
      <div className="flex h-full">
        <TitleBarButton
          ariaLabel="Minimize"
          onClick={() => withWindow((w) => w.minimize())}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </TitleBarButton>
        <TitleBarButton
          ariaLabel={maximized ? "Restore" : "Maximize"}
          onClick={() => withWindow((w) => w.toggleMaximize())}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
              <path d="M2.5,2.5 L2.5,0.5 L9.5,0.5 L9.5,7.5 L7.5,7.5" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </TitleBarButton>
        <TitleBarButton
          ariaLabel="Close"
          danger
          onClick={() => withWindow((w) => w.close())}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
            <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="1" />
          </svg>
        </TitleBarButton>
      </div>
    </div>
  );
}

function TitleBarButton({
  children,
  onClick,
  ariaLabel,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`h-full w-11 flex items-center justify-center text-secondary transition-colors ${
        danger
          ? "hover:bg-danger hover:text-white"
          : "hover:bg-accent/10 hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}
