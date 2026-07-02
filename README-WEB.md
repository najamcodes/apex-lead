# LeadHunter Web Edition

LeadHunter now supports running as a web application on your local network, allowing you to access your CRM and outreach system from any device.

## Architecture
- **Desktop (Electron)**: Unchanged. Continues to run as a native Windows/Mac app with an embedded DB.
- **Web (Next.js)**: A thin frontend that reuses 100% of the UI code from the desktop app (`src/`).
- **Backend (Bun + Hono)**: A lightweight API server that replaces the Electron IPC layer when running in web mode. It connects to the same `better-sqlite3` database logic.

## How to run locally (Development)
1. Start the backend: `cd server && bun run index.ts`
2. Start the frontend: `cd web && npm run dev`
3. Access at `http://localhost:3000`

## How to deploy (Docker)
We provide a `docker-compose.yml` to run the web edition easily on your home server (e.g., a Raspberry Pi, Synology NAS, or any Linux machine).

```bash
docker-compose up -d --build
```
This will start both the Next.js frontend (port 3000) and the Bun backend (port 4000).

### Environment Variables
- `LEADHUNTER_DB_PATH`: Inside the container, this defaults to `/data/leadhunter.db`. The `docker-compose.yml` uses a Docker volume to persist this file.
- `JWT_SECRET`: Change this in your `docker-compose.yml` to a secure random string!

## Updating the Chrome Extension
If you use the LeadHunter Chrome Extension to scrape leads from the web:
1. Open the Chrome Extension options.
2. Change the API URL from `http://localhost:4000` (Electron default local server) to the IP address of your deployed web server (e.g., `http://192.168.1.100:4000`).
