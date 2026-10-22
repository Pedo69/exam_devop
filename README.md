# Service Desk — ระบบแจ้งปัญหาอุปกรณ์ไอที

ระบบรับแจ้งปัญหาขนาดเล็กสำหรับ **อุปกรณ์ไอทีในสำนักงาน** เช่น เครื่องพิมพ์เสีย คอมพิวเตอร์เปิดไม่ติด
Wi‑Fi ใช้งานไม่ได้ ผู้ใช้สร้าง ticket พร้อมระดับความสำคัญ (priority) และเปลี่ยนสถานะ open / doing / done
ได้อิสระ หน้าเว็บเป็นหน้าเดียว (HTML + JavaScript ธรรมดา) ข้อมูลทั้งหมดมาจาก backend จริง

## URL

| What | Value |
| --- | --- |
| Web page (open this) | **http://localhost:8080** |
| `API_BASE` | **http://localhost:8080/api** |

## Ports

| Who | Address | Notes |
| --- | --- | --- |
| Browser → frontend | `localhost:8080` | published `8080:80` (nginx listens on 80 in the container) |
| frontend → backend | `backend:8000` | Compose network only; backend listens on `0.0.0.0:8000`, no host port |

## Tools and versions

| Tool | Version | Where |
| --- | --- | --- |
| Docker Engine / CLI | 29.9.2 | host (Docker Desktop, Windows 10 + WSL 2) |
| Docker Compose | v5.6.0 | host |
| Node.js | 24.22.1 (image `node:24-slim`, Debian 12) | backend container — built-in modules only, no npm packages |
| nginx | 1.28.3 (image `nginx:1.28-alpine`, Alpine 3.23) | frontend container — static files + `/api` reverse proxy |
| HTML / CSS / JavaScript | plain, no framework, no CDN | frontend |
| Storage | JSON file `/data/tickets.json` on a Docker named volume | backend |

No Node.js, Python or other runtime is needed on the host — only Docker. Nothing is downloaded from
the cloud at run time (base images are pulled once during the first build).

## App structure

```
.
├── compose.yml            # services frontend + backend, named volume "tickets"
├── frontend/
│   ├── Dockerfile         # nginx:1.28-alpine
│   ├── nginx.conf         # serves the page, proxies /api/* -> backend:8000
│   ├── index.html         # single page: form, filter, ticket table
│   ├── app.js             # fetch('/api/tickets'), create, change status, filter
│   └── style.css
├── backend/
│   ├── Dockerfile         # node:24-slim, runs as user "node"
│   ├── package.json
│   └── server.js          # REST API + validation, stores /data/tickets.json
├── check.sh               # self-check script (bash + curl)
├── evidence/              # screenshot, compose ps/logs, test-result.md, API before/after down-up
├── README.md
└── AI_USAGE.md
```

```
Browser ──HTTP──> localhost:8080 ──> frontend container (nginx :80, UI + /api proxy)
                                          │ /api/*  ──>  backend:8000   (Compose DNS)
                                          v
                                   backend container (Node.js API + data validation)
                                          │ read / write
                                          v
                              named volume servicedesk_tickets ──> /data
```

- The browser cannot resolve the Compose service name `backend`, so the page only calls the
  **relative** path `/api/...` on the same origin; nginx forwards it to `backend:8000`. Same origin →
  no CORS needed.
- Only the frontend publishes a port (`8080:80`). The backend has **no published port** and listens on
  `0.0.0.0:8000` inside its container.

## Build / run / stop

Run in the project root (the folder that contains `compose.yml`):

```bash
docker compose up -d --build      # build images and start (first command after unzip)
docker compose ps                 # both services should become "healthy"
docker compose logs -f            # follow logs (Ctrl+C to quit)
docker compose stop               # stop containers (keep them)
docker compose start              # start them again
docker compose down               # stop and remove containers — tickets are KEPT in the volume
docker compose down -v            # stop and ALSO delete the volume — next start is an empty system
```

Port 8080 already in use? Change the left side of `"8080:80"` in `compose.yml`; the web page and
`API_BASE` then use that port.

## Named volume (persistent data)

| Item | Value |
| --- | --- |
| Volume name in `compose.yml` | `tickets` |
| Actual Docker volume | `servicedesk_tickets` (project name `servicedesk`) |
| Mounted in backend at | `/data` |
| Data file | `/data/tickets.json` |
| Location inside Docker | `/var/lib/docker/volumes/servicedesk_tickets/_data` (inside the Docker Desktop VM) |

```bash
docker volume inspect servicedesk_tickets
docker compose exec backend ls -l /data
```

Containers can be removed, recreated or rebuilt — the named volume remains. A new volume starts with
an empty ticket list (no seed data).

## Ticket

| Field | Type | Rule |
| --- | --- | --- |
| `id` | positive integer | created by the server, unique, never entered by the user |
| `title` | string | trimmed, then 1–80 characters |
| `priority` | string | `low` \| `medium` \| `high`, required on create |
| `status` | string | `open` \| `doing` \| `done`; new tickets start `open`; any → any |

## API

Requests with a body use `Content-Type: application/json`; every response is JSON.

| Request | Success | Errors |
| --- | --- | --- |
| `GET /api/health` | `200 {"status":"ok"}` | — |
| `GET /api/tickets` | `200 [ ...tickets ]` (empty → `[]`) | — |
| `POST /api/tickets` `{"title":"printer offline ","priority":"high"}` | `201 {"id":1,"title":"printer offline","priority":"high","status":"open"}` | `400 {"error":"..."}` |
| `PATCH /api/tickets/{id}` `{"status":"doing"}` | `200` updated ticket (other fields unchanged) | `400 {"error":"..."}`, `404 {"error":"ticket not found"}` |

`POST /api/ticket` (singular, as written once in the exam paper) is accepted as an alias of
`POST /api/tickets`.

Invalid input returns `400` with `{"error":"<readable message>"}` and **changes no data**:

| Case | Example | Response |
| --- | --- | --- |
| title blank / missing | `{"title":" ","priority":"low"}` / no title | `title must be 1-80 characters after trimming` / `title is required` |
| title too long | 81 × `a` | `title must be 1-80 characters after trimming` |
| title wrong type | `{"title":1234,"priority":"low"}` | `title must be a string` |
| priority invalid / missing | `{"title":"Test","priority":"urgent"}` / no priority | `priority must be one of: low, medium, high` / `priority is required (...)` |
| status invalid / missing | `PATCH {"status":"closed"}` / `{}` | `status must be one of: open, doing, done` / `status is required (...)` |
| broken JSON | `{broken` | `body must be valid JSON` |
| unknown id | `PATCH /api/tickets/999` | `404 ticket not found` |

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/tickets
curl -X POST http://localhost:8080/api/tickets -H "Content-Type: application/json" \
     -d '{"title":"printer offline ","priority":"high"}'
curl -X PATCH http://localhost:8080/api/tickets/1 -H "Content-Type: application/json" \
     -d '{"status":"doing"}'
```

## Evidence and self-check

| File | Content |
| --- | --- |
| `evidence/1-ui-ticket-list.png` | 1 — screenshot of the UI with tickets and statuses |
| `evidence/compose-ps.txt`, `evidence/compose-logs.txt` + `2-compose-ps.png`, `2-compose-logs.png` | 2 — `docker compose ps` and logs as text (and screenshots of them) |
| `evidence/test-result.md` + `3-test-result.png` | 3 — T01–T08 pass/fail with actual results |
| `evidence/persistence-down-up.txt` + `4-persistence-down-up.png` | 4 — API output before / after `docker compose down` → `up` |
| `evidence/api-results.txt`, `evidence/docker-topology.txt` | raw `curl` / `docker` output behind T01–T08 |

Tests were run manually with `curl` (no test framework). To repeat all checks automatically:

```bash
docker compose down -v && docker compose up -d --build --wait   # fresh, empty volume
bash check.sh                                                    # Git Bash / Linux / macOS
```

## Limitations / not done

- **Out of scope by the exam paper:** login, delete, dashboard, CI/CD, cloud deployment, navigation menu.
- **Interpretations not yet confirmed:** the paper writes the priority value as "mediem"; this app uses
  `medium`. The "wrong type" title case is implemented as a number (`1234`); a string `"1234"` is a
  valid 4-character title and is accepted (201).
- **Storage:** one JSON file written by a single backend container (atomic write via temp file +
  rename). Not designed for several backend replicas writing at once; no automatic backup.
- **Tested only on** Windows 10 + Docker Desktop 29.9.2 (WSL 2). `check.sh` needs bash (Git Bash on
  Windows). The screenshot was captured with headless Microsoft Edge.
- **Not done:** no HTTPS, no authentication on the API, images not size-optimised (backend image
  ≈ 330 MB because of `node:24-slim`), no pagination or sorting of tickets (not required).
