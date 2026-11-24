# Ride-along readback

The `speak-ride-prompt` Supabase Edge Function provides ElevenLabs text-to-speech for the foreground Foundation Phase 1 scorer. It uses [ElevenLabs Create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) with the Flash v2.5 model (`eleven_flash_v2_5`) and `mp3_44100_64` output.

## Setup

1. Apply [`ride_prompt_readback.sql`](../../ride_prompt_readback.sql) after the facility-aware schema, ride draft and guided voice setup. It adds a dedicated rate-limit table and authorization RPC. On an existing guided-voice installation, apply this additive migration for readback.
2. Set these secrets in the Supabase project running the Edge Function.
   - `ELEVENLABS_API_KEY` with text-to-speech access.
   - `ELEVENLABS_VOICE_ID` for an ElevenLabs voice available to that key. Choose an existing standard voice for English readback.
   - `TQA_VOICE_ALLOWED_ORIGINS` with the app's exact allowed origins, comma-separated. Readback reuses the transcription origin list. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Deploy `speak-ride-prompt` with JWT verification enabled. Deploy the web app after the RPC and function are available. The facility's existing Ride-along voice switch controls access.

Keep the ElevenLabs credentials server-side. `OPENROUTER_API_KEY` still serves the separate speech-to-text and Jev scoring requests.

## Data flow

The client sends the draft ID, expected version, question ID and prompt kind to Supabase. The function verifies the trainer-owned draft, active facility access, voice-enabled Phase 1 and current cursor before requesting speech. It verifies the draft again before returning audio. Initial readback can run before the first recording is bound. The final prompt is only available after the guided sequence is complete. No draft fields or scores change when playing a prompt. The TTS limit is 30 requests per trainer per minute, independent of the transcription limit.

ElevenLabs receives one approved static rubric question, clarification, retry, or completion prompt per request. It receives no microphone audio, names, transcripts, individual scores, draft or question IDs. Custom and historical rubric text stays in TQA. Supabase returns MP3 bytes and marks the response `no-store`. If cloud readback is unavailable, the app can try a local browser voice and continues to display the conversation. ElevenLabs account usage and retention follow the provider's terms.

The automated tests use mocked provider responses. Verify hosted ElevenLabs access and physical device audio playback in staging with configured credentials.
