# AI usage

## AI ที่ใช้

| Item | Value |
| --- | --- |
| AI | **Claude Code** (Anthropic), model **Claude Opus 5.5** |
| ใช้ผ่าน | ส่วนขยาย Claude Code ใน VS Code บน Windows 10 (AI รันคำสั่งในเครื่องได้หลังผู้สอบอนุญาต) |
| ช่วงเวลา | ระหว่างสอบ 2026-10-22 |

## Prompt / งานสำคัญ

1. **Task 1 — สร้างระบบ:** วางโจทย์ frontend + สัญญา ticket แล้วสั่ง "สร้างมาให้หน่อย"
   AI สรุปโจทย์ลงตาราง และถามข้อที่กำกวม เช่น "mediem" แล้วสร้าง backend Node.js (ไม่มี dependency),
   หน้าเว็บ HTML/JS, Dockerfile และ compose และสคริปต์ตรวจ `check.sh`
2. **Task 2 — สัญญา API:** วางตาราง API และกรณีตรวจสอบ ให้ AI เทียบกับของเดิม
   AI แก้ health ให้ตอบ `{"status":"ok"}`, รับ `POST /api/ticket` เพิ่ม, ปรับข้อความ error
   ให้อ่านเข้าใจ, เพิ่มการตรวจทุกกรณีในโจทย์ และเขียน README
3. **Task 3–4 — Docker และหลักฐาน:** สั่ง "รันให้หน่อย" และ "รันเว็บให้ที" AI ช่วยติดตั้ง Docker Desktop
   (รวมการเปิด Virtual Machine Platform และ WSL แล้วรีสตาร์ทเครื่อง), build และรันด้วย compose,
   ทดสอบการแตก zip แล้วรันคำสั่งแรก, เก็บ evidence (ภาพหน้าจอ, ps/logs, T01–T08, ก่อน/หลัง down-up)
   และเขียนเอกสารนี้

## สิ่งที่ตรวจและแก้จากคำตอบ AI

ทุกข้อใช้การรันจริงเป็นเกณฑ์ ไม่ได้ดูจากคำอธิบายของ AI อย่างเดียว

| สิ่งที่พบ | วิธีพบ | การแก้ |
| --- | --- | --- |
| ส่วนจำกัดขนาด body ใน `server.js` เรียก `req.destroy()` ทำให้ socket ปิดก่อนส่ง 413 ได้ | ตรวจโค้ดก่อนทดสอบ | อ่าน body จนจบก่อน แล้วค่อยตอบ 413 เป็น JSON ทดสอบด้วย body 20 KB และ 2 MB |
| ไม่ส่ง title แต่ได้ข้อความ "title must be a string" ซึ่งไม่ตรงกับปัญหาจริง | อ่านผลทดสอบ | เปลี่ยนเป็น "title is required" และทำแบบเดียวกันกับ priority/status |
| ตั้งชื่อไฟล์ compose เป็น `compose.yaml` แต่โจทย์กำหนด `compose.yml` / `docker-compose.yml` | เทียบกับโจทย์ Task 3 | เปลี่ยนชื่อเป็น `compose.yml` |
| `check.sh` เวอร์ชันแรกใช้ `node` บนเครื่อง ขัดกับข้อ "ไม่ต้องติดตั้ง runtime บน host" | เทียบกับโจทย์ | เปลี่ยนไปใช้ bash + curl อย่างเดียว |
| ตัวตรวจ D1 ตัดสินว่า "backend เปิดพอร์ต" ทั้งที่ไม่ได้เปิด เพราะ `docker compose port` คืนค่า `:0` | ผล check ไม่ผ่าน 1 ข้อ จึงตรวจด้วย `docker inspect` | เปลี่ยนตัวตรวจให้ดู `HostConfig.PortBindings` ที่เป็น `{}` แล้วผ่าน 70/70 |
| ตัว node ที่ใช้ทดสอบก่อนมี Docker ยังฟัง `127.0.0.1:8080` ซ้อนกับ Docker ผลทดสอบจึงอาจไม่ได้มาจาก container | ตรวจ process ที่ฟังพอร์ต | ปิด node แล้วรันทดสอบใหม่ทั้งหมดบน Docker |
| ใน evidence มี `ls /data` กลายเป็น `C:/Program Files/Git/data` เพราะ Git Bash แปลง path | อ่านไฟล์ evidence | ตั้ง `MSYS_NO_PATHCONV=1` แล้วรันบรรทัดนั้นใหม่ |
| ชื่อ ticket ภาษาไทยที่ส่งผ่าน curl จาก Git Bash ออกมาเพี้ยน | ทดสอบภาษาไทย | ส่ง UTF-8 ด้วยวิธีอื่นแล้วได้ข้อความถูกต้อง ปัญหาอยู่ที่การเข้ารหัส argument ของ shell ไม่ใช่ backend |
| จุดกำกวมในโจทย์: "mediem", `{"status ok"}`, `post/api/ticket`, `"1234"` เป็น "ชนิดผิด" | AI แจ้งแทนที่จะเดาเงียบ ๆ | ใช้การตีความที่ตรงตัวที่สุด และบันทึกไว้ใน README หัวข้อ Limitations |
