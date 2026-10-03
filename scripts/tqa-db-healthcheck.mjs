// Read-only TQA database check. No service-role key, user credentials or data logging.
export async function checkDatabase(env = process.env, request = fetch) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (url !== "https://jdoypblyvhrljqiadzgq.supabase.co" || !key) {
    throw new Error("Configure the existing TQA public URL and anon-key environment values.");
  }
  const response = await request(`${url}/rest/v1/horses?select=id&limit=1`, {
    method: "GET",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`TQA database read failed (HTTP ${response.status}).`);
  let rows;
  try { rows = await response.json(); } catch { throw new Error("TQA database returned invalid JSON."); }
  if (!Array.isArray(rows)) throw new Error("TQA database returned an unexpected response.");
  if (rows.length) throw new Error("Unexpected anonymous row visibility; inspect RLS before continuing.");
  return "TQA database read passed; anonymous RLS returned no records.";
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try { console.log(await checkDatabase()); }
  catch (error) { console.error(error.message.startsWith("TQA") || error.message.startsWith("Configure") || error.message.startsWith("Unexpected") ? error.message : "TQA database request failed (network or timeout)."); process.exitCode = 1; }
}
