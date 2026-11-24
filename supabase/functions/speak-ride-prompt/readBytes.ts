export async function readBoundedBytes(
  body: ReadableStream<Uint8Array>,
  limit: number,
  signal: AbortSignal,
): Promise<ArrayBuffer | null> {
  signal.throwIfAborted();
  const reader = body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  const bytes = new Uint8Array(limit);
  let used = 0;
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) return bytes.buffer.slice(0, used);
      if (used + value.byteLength > limit) {
        cancel();
        return null;
      }
      bytes.set(value, used);
      used += value.byteLength;
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
