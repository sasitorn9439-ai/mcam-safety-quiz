# MCAM Safety Quiz · ควิซความปลอดภัย MCAM

เกมควิซความปลอดภัยแบบ Kahoot สำหรับ EHS Day / การอบรม — Host เปิดบนโปรเจกเตอร์ ผู้เล่นตอบบนมือถือ (ไม่ต้องลงแอป)
A Kahoot-style safety quiz for EHS Day and training — host on the projector, players on their phones (no app).

- Host: `/host.html` · Players: `/` (scan the QR or enter the 6-digit PIN)
- Live: https://mcam-safety-quiz.vercel.app

## Features
- 20 question sets × 15 questions, Thai/English, mixing standard knowledge questions with lighter scenario-based ones (`questions.js`)
- One picture question per set, illustrated with small original SVG icons (`quizart.js`), shown on both the host screen and the player's phone
- Shuffle answers / questions, time per question, per-set editor with JSON import/export
- Speed + streak scoring, leaderboard, podium, CSV results (Excel-ready Thai)
- Host & player reconnect/resume; tested with 100 simulated players
- Background music `music/ppe-ready.mp3` ("PPE พร้อม") in the lobby and scoreboard; the host can swap in another file
- Generated countdown music during questions (`gamemusic.js`, WebAudio): drum-roll riser on "get ready", tempo 124 → 136 → 152 BPM at 10 s and 5 s left

## How it works
Static site (no server). Real-time messages go through two free public MQTT brokers
(EMQX `broker.emqx.io:8084`, HiveMQ `broker.hivemq.com:8884`) over WSS; host and players use both and de-duplicate.
If a corporate network blocks these ports, players can use 4G/5G.
Local test: `?broker=ws://localhost:8888/mqtt` on both pages.

## Files
| File | Purpose |
|---|---|
| `index.html`, `player.js`, `player.css` | Player (phone) |
| `host.html`, `host.js`, `host.css` | Host (projector) |
| `music.js`, `music/` | Host background music controller |
| `gamemusic.js` | Procedural suspense music for the answer countdown |
| `questions.js` | 20 question sets |
| `quizart.js` | Small library of original SVG illustrations for picture questions |
| `bus.js` | Multi-broker MQTT transport |
| `common.js`, `style.css` | Shared helpers, sounds, styles |
| `vendor/` | Local fallbacks for mqtt.js and qrcode-generator |

## Editing questions
Row format in `questions.js`: `[question TH, question EN, [opt1 TH, opt1 EN, …], correctIndex, explanation TH, explanation EN]`.
Push to `main` → Vercel redeploys automatically.
