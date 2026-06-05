/**
 * Runtime detection. The app is desktop-only, but this guard is useful
 * during dev/HMR before Tauri injects `__TAURI_INTERNALS__` into the
 * webview, and to short-circuit any code that calls into Tauri APIs.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// True only when we're inside the Tauri webview AND running on macOS. Used
// to lift the app header into the native overlay title-bar area (28px of
// reserved traffic-light space) and apply left padding so the logo doesn't
// collide with the lights.
export function isMacOSTauri(): boolean {
  if (!isTauriRuntime()) return false;
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);
}
