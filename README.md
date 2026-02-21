# Ludo WebApp (Room ID Multiplayer)

## Run

1. Install deps:
```bash
npm install
```

2. Configure env:
```bash
cp .env.example .env
```

3. Start server:
```bash
npm run dev
```

4. Start Telegram bot (new terminal):
```bash
npm run dev:bot
```

5. Open web app:
```txt
http://localhost:8080
```

## Telegram Commands

- `/start` -> sends start/help message.
- `/start room_<ROOM_ID>` -> sends a button to join that room.
- `/play` -> creates a new room code and sends:
  - room code
  - web app room link
  - shareable deep-link invite

## How to play (Web)

1. Enter your name.
2. Create or join room by ID or room URL.
3. Host starts game.
4. Roll dice on your turn.

## Notes

- Server-authoritative turn, dice, and token validation.
- 2-4 players supported.
- In-memory state (resets on server restart).
- Joining after start is blocked with `Game already started`.
