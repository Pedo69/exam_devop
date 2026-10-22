# Service Desk — ระบบแจ้งปัญหาอุปกรณ์ไอที

ระบบรับแจ้งปัญหาขนาดเล็กสำหรับ **อุปกรณ์ไอทีในสำนักงาน** เช่น เครื่องพิมพ์เสีย คอมพิวเตอร์เปิดไม่ติด
Wi‑Fi ใช้งานไม่ได้ ผู้ใช้สร้าง ticket พร้อมระดับความสำคัญ แล้วเจ้าหน้าที่เปลี่ยนสถานะ open → doing → done
(หรือย้อนกลับได้)

## URL

| What | URL |
| --- | --- |
| Web UI | **http://localhost:8080** |
| API base | **http://localhost:8080/api** |

Only the frontend publishes a port (8080). The backend has no published port; nginx forwards `/api/*`
to `backend:8000` on the Compose network.

## Run

```bash
docker compose up -d --build --wait
# open http://localhost:8080
docker compose down        # stop; tickets stay in the named volume
docker compose down -v     # stop AND delete all tickets (fresh, empty system)
```

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
| `compose.yaml` | services `frontend`, `backend`; volume `tickets` |
| `check.sh` | automated checks for every requirement |

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

## Verification

```bash
docker compose down -v && docker compose up -d --build --wait
bash check.sh          # prints PASS/FAIL per requirement; expects an empty volume
```

Results are saved in `proof/`.
