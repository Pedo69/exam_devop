# Test result — Service Desk

- Date: 2026-10-22, Windows 10 Pro 19045 + Docker Desktop (engine 29.9.2, Compose 5.6.0, WSL 2)
- Method: manual `curl` requests (no test framework) against `http://localhost:8080` after
  `docker compose down -v && docker compose up -d --build --wait` (fresh, empty named volume)
- Raw output of every request: [api-results.txt](api-results.txt), [persistence-down-up.txt](persistence-down-up.txt),
  [docker-topology.txt](docker-topology.txt)

| ID | Test | Expected | Actual result | Status |
| --- | --- | --- | --- | --- |
| T01 | `GET /api/health` | 200 `{"status":"ok"}` | `200` `{"status":"ok"}` (application/json) | ✅ PASS |
| T02 | `GET /api/tickets` on a new volume | 200 `[]` | `200` `[]` | ✅ PASS |
| T03 | `POST /api/tickets` `{"title":"printer offline ","priority":"high"}` | 201, title trimmed, id from server, status open | `201` `{"id":1,"title":"printer offline","priority":"high","status":"open"}` | ✅ PASS |
| T04 | `PATCH /api/tickets/1` `{"status":"doing"}` | 200, only status changes | `200` `{"id":1,"title":"printer offline","priority":"high","status":"doing"}`; following GET shows the same | ✅ PASS |
| T05 | `PATCH /api/tickets/999` `{"status":"doing"}` | 404 + JSON error object | `404` `{"error":"ticket not found"}` | ✅ PASS |
| T06 | Invalid input (9 cases below) | 400/422 + JSON error with message; data unchanged | all `400` with readable `{"error":...}`; ticket list identical before and after | ✅ PASS |
| T07 | Persistence: API before/after `docker compose down` → `up` | same tickets after restart | 4 tickets with statuses doing/open/done/open identical before and after; volume `servicedesk_tickets` still listed after `down` | ✅ PASS |
| T08 | Docker topology: 2 containers, reverse proxy, only 8080 published, bind 0.0.0.0, named volume | frontend + backend healthy; `localhost:8000` unreachable; proxy reaches `backend:8000` | both `healthy`; `curl localhost:8000` → exit 7 (refused); backend PortBindings `{}`; `wget backend:8000/api/health` in frontend → `{"status":"ok"}`; log `listening on 0.0.0.0:8000`; runs as uid 1000 (node); `/data/tickets.json` on `servicedesk_tickets` | ✅ PASS |

**Total: 8 / 8 PASS**

## T06 cases (actual responses)

| Case | Request | Actual |
| --- | --- | --- |
| title blank | `POST {"title":" ","priority":"low"}` | `400 {"error":"title must be 1-80 characters after trimming"}` |
| title missing | `POST {"priority":"low"}` | `400 {"error":"title is required"}` |
| title too long | `POST` title = 81 × `a`, priority low | `400 {"error":"title must be 1-80 characters after trimming"}` |
| title wrong type | `POST {"title":1234,"priority":"low"}` | `400 {"error":"title must be a string"}` |
| priority invalid | `POST {"title":"Test","priority":"urgent"}` | `400 {"error":"priority must be one of: low, medium, high"}` |
| priority missing | `POST {"title":"Test"}` | `400 {"error":"priority is required (one of: low, medium, high)"}` |
| status invalid | `PATCH /api/tickets/1 {"status":"closed"}` | `400 {"error":"status must be one of: open, doing, done"}` |
| status missing | `PATCH /api/tickets/1 {}` | `400 {"error":"status is required (one of: open, doing, done)"}` |
| broken JSON | `POST {broken` (Content-Type: application/json) | `400 {"error":"body must be valid JSON"}` |

List before T06: `[{"id":1,"title":"printer offline","priority":"high","status":"doing"}]` —
list after T06: identical.

## UI check

[1-ui-ticket-list.png](1-ui-ticket-list.png) — the page at http://localhost:8080 showing 4 tickets loaded
from the backend with statuses `doing`, `open`, `done`, `open`, the create form with labels, and
the all/open/doing/done filter.

## Additional self-check

Real-browser UI test (form, status change + reload, all/open/doing/done filters, empty and
error messages, backend stop/start): **17 / 17 PASS** — [ui-browser-test.txt](ui-browser-test.txt).


`bash check.sh` (bash + curl only) on a fresh volume: **70 / 70 PASS** — [check-sh-docker.txt](check-sh-docker.txt).
Also: backend stopped → proxy returns `503` JSON; 2 MB body → `413` JSON ([docker-extras.txt](docker-extras.txt));
fresh unzip + `docker compose up -d --build` works ([unzip-first-command.txt](unzip-first-command.txt)).
