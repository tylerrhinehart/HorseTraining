import { useSyncExternalStore } from "react";

type InstallPrompt = Event & { prompt: () => Promise<unknown> };
type InstallState = { kind: "manual" | "installed" } | { kind: "available"; request: InstallPrompt };

let state: InstallState = { kind: "manual" };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function publish(next: InstallState) {
  state = next;
  listeners.forEach(listener => listener());
}

export function initPwaInstall() {
  const ios = navigator as Navigator & { standalone?: boolean };
  const standalone = ios.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  publish({ kind: standalone ? "installed" : "manual" });

  const capture = (event: Event) => {
    event.preventDefault();
    if (state.kind !== "installed") publish({ kind: "available", request: event as InstallPrompt });
  };
  const installed = () => publish({ kind: "installed" });
  window.addEventListener("beforeinstallprompt", capture);
  window.addEventListener("appinstalled", installed);
  return () => {
    window.removeEventListener("beforeinstallprompt", capture);
    window.removeEventListener("appinstalled", installed);
  };
}

export function usePwaInstall() {
  return useSyncExternalStore(subscribe, () => state);
}

export async function promptPwaInstall() {
  if (state.kind !== "available") return;
  const { request } = state;
  publish({ kind: "manual" });
  try {
    await request.prompt();
  } catch {
    // Install prompts are single-use. The browser menu remains available.
  }
}
