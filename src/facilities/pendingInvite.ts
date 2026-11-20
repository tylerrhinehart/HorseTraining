// Invitation links use fragments, not query parameters sent to the web server.
// Strip the fragment before mounting the router; never propagate it into auth URLs.
const KEY = "tqa.pendingInvite";
const TTL = 30 * 60 * 1000;
const FORMAT = /^[0-9a-f]{64}$/;
type Pending = { token: string; expires: number };
let inMemory: Pending | null = null;

export function captureInviteFragment(browser: Pick<Window, "location" | "history" | "sessionStorage"> = window) {
  if (!browser.location.hash.startsWith("#invite=")) return;
  const token = browser.location.hash.slice("#invite=".length);
  browser.history.replaceState(browser.history.state, "", browser.location.pathname + browser.location.search);
  if (!FORMAT.test(token)) return;
  inMemory = { token, expires: Date.now() + TTL };
  try { browser.sessionStorage.setItem(KEY, JSON.stringify(inMemory)); } catch { /* same-page fallback */ }
}

export function pendingInvite(): string {
  let entry: Pending | null = inMemory;
  try {
    entry ??= JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Pending | null;
  } catch { /* no stored invitation */ }
  if (entry && FORMAT.test(entry.token) && entry.expires > Date.now()) return entry.token;
  if (entry) clearPendingInvite();
  return "";
}

export function clearPendingInvite() {
  inMemory = null;
  try { sessionStorage.removeItem(KEY); } catch { /* storage optional */ }
}

export function inviteLink(token: string): string {
  const url = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/facilities`, window.location.origin);
  url.hash = `invite=${token}`;
  return url.toString();
}
