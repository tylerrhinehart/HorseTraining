# Transcribe ride turn (foreground Phase 1 pilot)

Requires the facility + ride-draft migrations, an active trainer-owned draft in a voice-enabled facility, and these Edge Function environment values:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY`, usually supplied by Supabase
- `OPENAI_API_KEY`, server-side only
- `TQA_VOICE_ALLOWED_ORIGINS`, an explicit comma-separated allowlist of origins (no wildcard)

The handler verifies the current bearer token with Supabase Auth and calls the scoped, rate-limited `authorize_ride_transcription` RPC as that user. It receives a multipart upload of one browser-recorded WebM, MP4 or Ogg clip capped at 512 KiB. It sends audio, not draft/horse/user identifiers, to the [OpenAI transcription API](https://developers.openai.com/api/docs/guides/speech-to-text). It never logs or stores the audio or transcript. This does not change the API provider's data-handling terms. Do not enable the facility flag before deployment and privacy/device verification.

If the Supabase gateway's JWT verifier is incompatible with the project's token signing algorithm, use the supported per-function gateway configuration for that project only after testing. The function verifies the caller itself and does not rely on the gateway for identity. Do not send service-role credentials to the browser.

Clips, transcripts and model output cannot update a database record from this endpoint. Confirmed draft scores are written by the authenticated app through a separate, versioned draft RPC.
