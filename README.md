# CampusPass

College event discovery and seat booking: React front end + Node/Express API + PostgreSQL + Redis.

## Folder map
- `client/`  React app (Vite, React Router, TanStack Query)
- `server/`  Express API (routes -> controllers -> services -> repositories)
- `docs/`    design documents (architecture PDF, RBAC matrix, booking flow, sketches, performance notes)

## Run it
```bash
docker compose up -d                 # PostgreSQL + Redis
cd server && cp .env.example .env && npm install
npm run migrate && npm run seed      # create tables, load sample events
npm run dev                          # API on http://localhost:3000/api/v1

cd ../client && cp .env.example .env && npm install
npm run dev                          # app on http://localhost:5173
```

## Team
- Names: _add here_
