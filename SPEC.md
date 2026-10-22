# Spec — Service Desk (ระบบรับแจ้งปัญหาขนาดเล็ก)
Began 2026-10-22 · Source: paper pasted by student (Task 1 only so far)

## Scope (paper wording)
- "ใช้ html และ javascript ธรรมดา ออกแบบหน้าหลักเพียงหน้าเดียวให้ชัดเจน"
- NOT required: login, delete, dashboard, CI/CD, deploy ขึ้น cloud, "ไม่ต้องมี 7 เมนู" (see Q2)
- UI language: Thai or English

## Exact names (copied verbatim)
| What | Value | Paper wording |
| --- | --- | --- |
| system | service desk | "service desk คือระบบรับแจ้ง...ขนาดเล็ก" |
| ticket fields | id, title, priority, status | สัญญา ticket |
| priority values | low, medium(?), high | "low,mediem,high" — see Q1 |
| status values | open, doing, done | |
| filters | all, open, doing, done | |
| frontend tech | plain HTML + JavaScript | "html และ javascript ธรรมดา" |
| backend routes / ports / storage | **not specified yet** | see Q3 |

## Ticket contract
- id: positive integer, backend-generated, unique; user never enters it
- title: string; after trimming, length 1–80; not empty, not another type
- priority: string low|medium|high; required on every create
- status: string open|doing|done; new ticket = open
- Any status → any status (incl. back to open). No ordering, no timestamps, no seed data.
- New system on a new volume starts with an empty list.

## Items
| ID | Item (paper wording) | Test (command → expected) | State |
| --- | --- | --- | --- |
| F1 | แสดงรายการจาก backend จริง (id,title,priority,status) ไม่ใช้ mock data | create via API → appears in UI; grep frontend for hard-coded tickets → none | ✅ local (node, no Docker) |
| F2 | ฟอร์ม title + priority พร้อม label; สร้างแล้วเห็นใน API และ UI | POST → 201, GET lists it; form has `<label for>` | ✅ local (node, no Docker) |
| F3 | ข้อความเมื่อไม่มีข้อมูล / เกิดข้อผิดพลาด | empty volume → empty message; backend down / 400 → error message | ✅ local (node, no Docker) |
| F4 | เปลี่ยน status แต่ละรายการ บันทึกลง backend, refresh แล้วคงค่า | PATCH → 200; GET after reload shows new status | ✅ local (node, no Docker) |
| F5 | กรอง all/open/doing/done ถูกต้อง | each filter shows only matching tickets | ✅ local (node, no Docker) |
| C1 | id บวก ไม่ซ้ำ สร้างโดย backend | POST ×2 → ids differ, >0; client-sent id ignored | ✅ local (node, no Docker) |
| C2 | title validation (trim, 1–80, string) | "", "   ", 81 chars, 123, missing → 400; 80 chars → 201 | ✅ local (node, no Docker) |
| C3 | priority required, enum | missing / "urgent" → 400 | ✅ local (node, no Docker) |
| C4 | status enum, default open, any→any | POST → status open; PATCH bad value → 400; done→open → 200 | ✅ local (node, no Docker) |
| C5 | new volume → empty list | fresh volume GET → [] | ✅ local empty DATA_DIR; Docker volume ☐ |

## Task 2 — API contract (added mid-exam)
- "ให้กำหนดเลยว่าจะทำเกี่ยวกับแจ้งเตือนอะไร" → chosen theme: แจ้งปัญหาอุปกรณ์ไอทีในสำนักงาน (IT equipment issues)
- JSON in/out; requests with body send `Content-Type: application/json`; every API response is JSON
- Other port allowed if the URL is written in README → README must state URL

| ID | Request | Expected | Test | State |
| --- | --- | --- | --- | --- |
| A1 | GET /api/health | 200 `{"status":"ok"}` (paper: `{"status ok"}`, see Q5) | curl → body exact | ✅ local (node, no Docker) |
| A2 | GET /api/tickets | 200 JSON array of all; empty → `[]` | fresh → `[]` | ✅ local (node, no Docker) |
| A3 | POST /api/ticket(s) `{"title":"printer offline ","priority":"high"}` | 201 ticket, title=`printer offline`, id by server, status=open | curl | ✅ local (node, no Docker) |
| A4 | PATCH /api/tickets/{id} `{"status":"doing"}` | 200 updated ticket, other fields unchanged; unknown id → 404 + JSON error object | curl | ✅ local (node, no Docker) |
| A5 | invalid data | 400/422 + JSON error object with readable message; **data unchanged** | list identical before/after | ✅ local (node, no Docker) |
| A6 | README with URL | README.md states http://localhost:8080 | grep | ✅ local (node, no Docker) |

Validation cases (paper):
- title empty/missing: `{"title":" ","priority":"low"}` or no title
- title too long: 81 × "a", priority low
- title wrong type: paper shows `{"title":"1234",...}` — see Q6
- priority invalid/missing: `{"title":"Test","priority":"urgent"}` or no priority
- status invalid/missing: PATCH existing with `{"status":"closed"}` or `{}`
- broken JSON: body `{broken` with Content-Type application/json

## Task 3 — Docker + self-check (added mid-exam, with ภาพ 1)
| ID | Item (paper wording) | Test | State |
| --- | --- | --- | --- |
| T1 | frontend และ backend คนละ container, Dockerfile แต่ละส่วน, `compose.yml` หรือ `docker-compose.yml` ที่ root | files exist; `docker compose ps` → 2 healthy | ☐ needs Docker |
| T2 | ข้อมูลอยู่ที่ backend, Docker **named volume** เก็บข้อมูลถาวร (DB container optional; chose JSON file, no DB) | down/up + force-recreate keep data; `servicedesk_tickets` exists | ☐ needs Docker |
| T3 | หลัง unzip สั่งคำสั่งแรกที่ root แล้วใช้งานได้ ไม่ต้องติดตั้ง runtime บน host | from clean copy: `docker compose up -d --build` → page works | ☐ needs Docker |
| T4 | README แนะนำหน้าเว็บ และระบุ `API_BASE` | grep README | ✅ |
| T5 | browser ไม่เรียก `backend` ตรง: reverse proxy (or localhost API + CORS) | app.js uses relative /api; nginx /api/ → backend:8000 | ✅ code; ☐ Docker run |
| T6 | ใน container รับการเชื่อมต่อจากภายนอก bind 0.0.0.0 | backend log "listening on 0.0.0.0:8000" | ☐ needs Docker |
| T7 | หลัง build ทำงานได้โดยไม่พึ่ง cloud | no CDN/external URLs in UI; no runtime fetches | ✅ (grep) |

Notes: file renamed `compose.yaml` → `compose.yml` (paper names compose.yml/docker-compose.yml).
Submission = zip; zip root must contain compose.yml. SPEC.md / ROADMAP.md stay out of the zip.

## Forbidden
- mock data in frontend; seed data; login; delete; dashboard; CI/CD; cloud deploy

## Interpretations (pending student confirmation)
- Q1 "mediem" → assume typo for `medium`
- Q2 "ไม่ต้องมี 7 เมนู" → assume "no menu / navigation needed" (single page)
- Q3 Backend/Docker details not given in Task 1 → wait for further tasks; meanwhile assume reference
  architecture (frontend nginx :8080 → /api → backend:8000, named volume /data) and REST:
  GET /api/tickets, POST /api/tickets, PATCH /api/tickets/:id
- Status change wording "เปลี่ยน status" → PATCH with body {"status": ...}

- Q4 paper `post/api/ticket` (singular) vs every other route `/api/tickets` → canonical `/api/tickets`;
  POST `/api/ticket` accepted as an alias so either reading passes
- Q5 `{"status ok"}` is not valid JSON → assume `{"status":"ok"}`
- Q6 "ชนิดข้อมูลผิด" with `"1234"` (a string) contradicts "wrong type" → assume paper means number `1234`;
  a string "1234" is a valid 4-char title per the ticket contract and returns 201

## Environment notes
- Docker Desktop NOT installed (docker not on PATH, Docker Desktop.exe missing) — blocks any "volume"/compose items
- git 2.53, node 22.20, python 3.12.4 present; ports 8080/8000 free
- SemesterProject/ folder not present in workspace

## Extras
- GET /api/tickets/{id}, GET /api/tickets?status= (optional server filter) — not required, harmless
- POST /api/ticket alias (Q4)
- 413 for bodies > 10 KB, 405 for wrong method — all JSON
## Overrides

## Progress log
- Backend + frontend built; `SKIP_DOCKER=1 bash check.sh` → 37/37 PASS (proof/check-local-*.txt) via local node + dev proxy.
- Backend restart keeps data, ids continue (4 after 3); Thai title round-trips; 20 KB body → 413 (proof/restart-and-extras.txt).
- NOT yet verified: Docker build, compose, named volume, backend unexposed, non-root (D1–D4) — Docker Desktop not installed.
- Task 2 added; `SKIP_DOCKER=1 bash check.sh` → 57/57 PASS (proof/check-local-task2-*.txt). Health now {"status":"ok"}; README.md added.
