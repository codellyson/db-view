/**
 * Runtime detection. The app is desktop-only, but this guard is useful
 * during dev/HMR before Tauri injects `__TAURI_INTERNALS__` into the
 * webview, and to short-circuit any code that calls into Tauri APIs.
 */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
