# Service Desk — ระบบแจ้งปัญหาอุปกรณ์ไอที

ระบบรับแจ้งปัญหาขนาดเล็กสำหรับ **อุปกรณ์ไอทีในสำนักงาน** เช่น เครื่องพิมพ์เสีย คอมพิวเตอร์เปิดไม่ติด
Wi‑Fi ใช้งานไม่ได้ ผู้ใช้สร้าง ticket พร้อมระดับความสำคัญ แล้วเจ้าหน้าที่เปลี่ยนสถานะ open → doing → done
(หรือย้อนกลับได้)

## Quick start

Requirement: Docker (Docker Desktop / Docker Engine with Compose v2). No Node.js, Python or other
runtime is needed on the host, and nothing is fetched from the cloud at run time.

```bash
# after unzipping, in the project root (the folder that contains compose.yml):
docker compose up -d --build
```

Then open **http://localhost:8080** in a browser.

| What | Value |
| --- | --- |
| Web page (open this) | **http://localhost:8080** |
| `API_BASE` | **http://localhost:8080/api** |

```bash
docker compose ps          # both services should be "healthy"
docker compose logs -f     # follow logs
docker compose down        # stop; tickets stay in the named volume
docker compose down -v     # stop AND delete all tickets (fresh, empty system)
```

### How the browser reaches the API

The browser cannot resolve Compose service names such as `backend`, so it never calls the backend
directly. The page calls the **relative** path `/api/...` on the same origin (`localhost:8080`); nginx
in the frontend container reverse-proxies `/api/*` to `backend:8000` on the Compose network. Same
origin → no CORS needed. Only the frontend publishes a port (`8080:80`); the backend has no published
port and listens on `0.0.0.0:8000` inside its container.

Port 8080 already in use? Change the left side of `"8080:80"` in `compose.yml`; the web page and
`API_BASE` then move to that port.

## Persistence

Tickets are stored by the backend in `/data/tickets.json` on the Docker **named volume**
`servicedesk_tickets`. Containers can be removed, recreated or rebuilt; the volume remains:

```bash
docker compose down && docker compose up -d                    # data kept
docker compose up -d --force-recreate --build                  # data kept
docker volume inspect servicedesk_tickets                      # where it lives
```

A new volume starts with an empty list.

## Architecture

```
Browser ──HTTP──> localhost:8080 ──> frontend (nginx :80, HTML + JS, /api proxy)
                                          │ /api/*  ──>  backend:8000
                                          v
                                   backend (Node.js API + validation)
                                          │ read / write
                                          v
                              named volume `tickets` ──> /data/tickets.json
```

| Path | Content |
| --- | --- |
| `frontend/` | `index.html`, `app.js`, `style.css` (plain HTML/JS), `nginx.conf`, `Dockerfile` |
| `backend/` | `server.js` (Node.js built-ins only, no dependencies), `Dockerfile` |
| `compose.yml` | services `frontend`, `backend`; named volume `tickets` → `/data` |
| `check.sh` | self-check script for every requirement (bash + curl only) |

## Ticket

| Field | Type | Rule |
| --- | --- | --- |
| `id` | positive integer | created by the server, unique |
| `title` | string | trimmed, 1–80 characters |
| `priority` | string | `low` \| `medium` \| `high`, required on create |
| `status` | string | `open` \| `doing` \| `done`, new tickets start `open`; any → any |

A new system on a new volume starts with an empty list (no seed data).

## API

All requests with a body use `Content-Type: application/json`; every response is JSON.

| Request | Success | Errors |
| --- | --- | --- |
| `GET /api/health` | `200 {"status":"ok"}` | — |
| `GET /api/tickets` | `200 [ ...tickets ]` (empty → `[]`) | — |
| `POST /api/tickets` `{"title":"printer offline ","priority":"high"}` | `201 {"id":1,"title":"printer offline","priority":"high","status":"open"}` | `400 {"error":"..."}` |
| `PATCH /api/tickets/{id}` `{"status":"doing"}` | `200` updated ticket (other fields unchanged) | `400 {"error":"..."}`, `404 {"error":"ticket not found"}` |

`POST /api/ticket` (singular) is accepted as an alias of `POST /api/tickets`.

Invalid input returns `400` with a JSON object `{"error":"<readable message>"}` and **changes no data**:

| Case | Example | Response |
| --- | --- | --- |
| title blank / missing | `{"title":" ","priority":"low"}` / no title | `400 {"error":"title must be 1-80 characters after trimming"}` / `{"error":"title is required"}` |
| title too long | 81 × `a` | `400 {"error":"title must be 1-80 characters after trimming"}` |
| title wrong type | `{"title":1234,"priority":"low"}` | `400 {"error":"title must be a string"}` |
| priority invalid / missing | `{"title":"Test","priority":"urgent"}` / no priority | `400 {"error":"priority must be one of: low, medium, high"}` / `{"error":"priority is required (one of: low, medium, high)"}` |
| status invalid / missing | `PATCH {"status":"closed"}` or `{}` | `400 {"error":"status must be one of: open, doing, done"}` / `{"error":"status is required (one of: open, doing, done)"}` |
| broken JSON | `{broken` | `400 {"error":"body must be valid JSON"}` |
| unknown id | `PATCH /api/tickets/999` | `404 {"error":"ticket not found"}` |

### Examples

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/tickets
curl -X POST http://localhost:8080/api/tickets -H "Content-Type: application/json" \
     -d '{"title":"printer offline ","priority":"high"}'
curl -X PATCH http://localhost:8080/api/tickets/1 -H "Content-Type: application/json" \
     -d '{"status":"doing"}'
```

## Self-check

```bash
docker compose down -v && docker compose up -d --build --wait   # fresh, empty volume
bash check.sh          # Git Bash / Linux / macOS; prints PASS/FAIL per requirement
```

It covers the UI page, every API case above, that invalid requests change no data, that the backend
publishes no port, persistence across `down`/`up` and container recreate, the named volume, and that
the backend runs as a non-root user. Saved results are in `proof/`.
