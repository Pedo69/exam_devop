# Roadmap — Service Desk Task 1
| # | IDs | Step | Test | Box | State |
| --- | --- | --- | --- | --- | --- |
| 1 | C1–C5 | Backend (Node, no deps): GET/POST /api/tickets, PATCH /api/tickets/:id, JSON file in DATA_DIR | check.sh API section → all PASS | 20m | ✅ |
| 2 | F1–F5 | Frontend index.html + app.js + style.css (relative /api) | local dev proxy :8080; manual browser check | 25m | ✅ |
| 3 | all | Dockerfiles + nginx.conf + compose.yaml (only 8080 published, named volume /data) | `docker compose up -d --build --wait` + check.sh docker section | 20m | ☐ (needs Docker Desktop) |
| 4 | all | Clean rebuild + full check + proof | check.sh all PASS | 15m | ☐ |
