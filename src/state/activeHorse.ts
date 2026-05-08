// Tracks the currently-focused horse so tabbed nav (Today / Progress / Report)
// has a horse to operate on without forcing the user to pick one each tab change.

import { useEffect, useState } from "react";

const KEY = "tqa.activeHorseId";

const listeners = new Set<() => void>();
let cached: string | null = null;
let initialized = false;

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  cached = readStored();
}

export function getActiveHorseId(): string | null {
  ensureInit();
  return cached;
}

export function setActiveHorseId(id: string | null) {
  ensureInit();
  cached = id;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore (e.g. private mode)
  }
  for (const l of listeners) l();
}

export function useActiveHorseId(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(() => getActiveHorseId());
  useEffect(() => {
    const l = () => setId(getActiveHorseId());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [id, setActiveHorseId];
}
