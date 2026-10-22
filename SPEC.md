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

## Forbidden
- mock data in frontend; seed data; login; delete; dashboard; CI/CD; cloud deploy

## Interpretations (pending student confirmation)
- Q1 "mediem" → assume typo for `medium`
- Q2 "ไม่ต้องมี 7 เมนู" → assume "no menu / navigation needed" (single page)
- Q3 Backend/Docker details not given in Task 1 → wait for further tasks; meanwhile assume reference
  architecture (frontend nginx :8080 → /api → backend:8000, named volume /data) and REST:
  GET /api/tickets, POST /api/tickets, PATCH /api/tickets/:id
- Status change wording "เปลี่ยน status" → PATCH with body {"status": ...}

## Environment notes
- Docker Desktop NOT installed (docker not on PATH, Docker Desktop.exe missing) — blocks any "volume"/compose items
- git 2.53, node 22.20, python 3.12.4 present; ports 8080/8000 free
- SemesterProject/ folder not present in workspace

## Extras
## Overrides

## Progress log
- Backend + frontend built; `SKIP_DOCKER=1 bash check.sh` → 37/37 PASS (proof/check-local-*.txt) via local node + dev proxy.
- Backend restart keeps data, ids continue (4 after 3); Thai title round-trips; 20 KB body → 413 (proof/restart-and-extras.txt).
- NOT yet verified: Docker build, compose, named volume, backend unexposed, non-root (D1–D4) — Docker Desktop not installed.
