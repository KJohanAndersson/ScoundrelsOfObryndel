# Scoundrels of Obryndel

A QR-driven tabletop companion app built with React + Vite.  
Players scan physical QR tiles to trigger game events, progress through acts, and enter a boss phase.

## What the Code Does

- Supports 1-4 players with unique character selection.
- Uses camera scanning (`jsQR`) to detect tiles like `Tile-001` to `Tile-030`.
- Handles act-based events for tiles 1-29:
  - `item` event
  - `trap` event
  - `neutral` event
- Uses weighted outcomes:
  - Act 1: slightly more items than traps
  - Act 2: slightly more traps than items
  - Both acts: neutral events are most common
- Starts boss mode when `Tile-030` is scanned.
- Speaks event text to players.

## Why It Is Written This Way

- `src/App.jsx` is intentionally centralized:
  - The game loop, camera flow, and UI state are tightly coupled and easier to tune in one place while rules are evolving.
- QR scanning is client-side:
  - `requestAnimationFrame` + canvas + `jsQR` gives immediate camera feedback and low-latency detection.
- ElevenLabs is server-side via Vercel route:
  - `api/tts.js` protects secrets (`ELEVENLABS_API_KEY`) and avoids exposing key headers in browser requests.
- TTS has a fallback path:
  - If ElevenLabs fails or playback fails, browser `speechSynthesis` keeps events readable so gameplay continues.

## TTS Architecture

1. Frontend calls `POST /api/tts` with `{ "text": "..." }`.
2. `api/tts.js` sends request to ElevenLabs with server env vars:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID` (optional, with a code fallback)
3. API returns `audio/mpeg` to browser.
4. Browser plays returned audio.
5. If any step fails, browser fallback voice reads the event.

## Known Issues / Errors

1. AI voice is not always the one speaking
- Current behavior: events are read aloud, but sometimes with normal browser TTS instead of ElevenLabs AI voice.
- Reason: the fallback is active when `/api/tts` fails or audio playback fails.
- Result: gameplay is not blocked, but voice quality/identity may differ.

2. Voice ID can be reported as missing/unavailable
- Even if a voice exists in ElevenLabs Voice Library, it may not be available for API usage with the current account/workspace/key.

3. WebSocket console warning (`ws://localhost:8081`)
- Usually unrelated to app functionality (often dev tooling/extension noise).

4. Canvas `willReadFrequently` warning
- Performance warning only, not a functional blocker.

## Debug / Verification

1. Check health endpoint:
```text
GET https://<your-domain>/api/tts
```
Expected JSON fields:
- `ok: true`
- `elevenlabs_configured: true`
- `voice_id: "<expected id>"`

2. Check runtime request:
- Trigger an event in the app.
- In browser Network tab, inspect `POST /api/tts`.
- `200 + audio/mpeg` means ElevenLabs audio returned.
- Non-200 means fallback voice likely handled speech.

## Environment Variables

Set in Vercel and local `.env.local`:

- `ELEVENLABS_API_KEY=...`
- `ELEVENLABS_VOICE_ID=...` (optional but recommended)

Use `.env.example` as the template.

## Local Development

```bash
npm install
npm run dev
```

## Deployment Notes

- Deploy from GitHub via Vercel.
- After changing env vars, redeploy so serverless functions receive new values.
