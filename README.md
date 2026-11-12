# AETHERIA ONLINE v0.7 (Online Beta)

## Run locally
Install Node.js 18+, run `npm install`, then `npm start`. Open http://localhost:3000.

## Render deployment
1. Push all project files to a GitHub repository.
2. Create a new Render Web Service (Node environment) and connect the repository.
3. Build command: `npm install`; Start command: `npm start`.
4. Open the Render service URL on Android Chrome. Share the same URL with friends.

## Modes
- Online: `/` (Socket.IO server required; internet required).
- Offline: `/offline.html` (v0.6 prototype, works without game server once loaded/saved locally).

## Important limitations
- Online beta includes shared world, 45 monsters, attack and area skill, basic character progression, chat, fashion gacha, upgrading and healing. It does NOT yet synchronize the v0.6 quests, boss arenas, houses, farms, and other offline subsystems.
- Character recovery token is saved in browser localStorage. Clearing browser data can lose access to character. No secure password-based accounts yet.
- JSON character storage under `data/characters.json` is NOT durable on Render ephemeral filesystems. Attach a persistent disk on a supported plan or replace with Postgres before relying on saves. Server should run a single instance.
- Peer-to-peer not used. Server validates rewards and upgrade/gacha transactions, but this is a beta, not a security-audited production MMO.
- No paid purchases. Gacha uses earned in-game currency.
- Not tested end-to-end on Android or deployed to Render.
