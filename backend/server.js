'use strict';
// Service Desk API — Node built-ins only, data in DATA_DIR/tickets.json
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 8000);
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_FILE = path.join(DATA_DIR, 'tickets.json');
const MAX_BODY = 10 * 1024;

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['open', 'doing', 'done'];

// ---- storage: new volume → empty list, no seed data ----
fs.mkdirSync(DATA_DIR, { recursive: true });

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return { nextId: 1, tickets: [] };
    throw err;
  }
}

function save(db) {
  // write temp file then rename over the target (crash-safe)
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

let db = load();

// ---- validation ----
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function onlyKeys(body, allowed) {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) throw new HttpError(400, `unknown field(s): ${extra.join(', ')}`);
}

function validateTitle(value) {
  if (value === undefined) throw new HttpError(400, 'title is required');
  if (typeof value !== 'string') throw new HttpError(400, 'title must be a string');
  const title = value.trim();
  const len = Array.from(title).length;
  if (len < 1 || len > 80) throw new HttpError(400, 'title must be 1-80 characters after trimming');
  return title;
}

function validateEnum(name, value, allowed) {
  if (value === undefined) throw new HttpError(400, `${name} is required (one of: ${allowed.join(', ')})`);
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new HttpError(400, `${name} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      // keep draining (not destroy) so the 413 response can still be delivered
      if (size <= MAX_BODY) chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return reject(new HttpError(413, 'request body too large'));
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reject(new HttpError(400, 'body must be valid JSON'));
      }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return reject(new HttpError(400, 'body must be a JSON object'));
      }
      resolve(body);
    });
    req.on('error', reject);
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// ---- routes ----
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname.replace(/\/+$/, '') || '/';

  if (p === '/api/health' && req.method === 'GET') {
    return send(res, 200, { status: 'ok' });
  }

  // paper lists `POST /api/ticket` once (singular) — accept it as an alias of POST /api/tickets
  if (p === '/api/ticket' && req.method !== 'POST') throw new HttpError(405, 'method not allowed');

  if (p === '/api/tickets' || p === '/api/ticket') {
    if (req.method === 'GET') {
      // optional server-side filter: ?status=open|doing|done (all = no param)
      const status = url.searchParams.get('status');
      if (status === null || status === 'all') return send(res, 200, db.tickets);
      validateEnum('status', status, STATUSES);
      return send(res, 200, db.tickets.filter((t) => t.status === status));
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      onlyKeys(body, ['title', 'priority']);
      const title = validateTitle(body.title);
      const priority = validateEnum('priority', body.priority, PRIORITIES);
      const ticket = { id: db.nextId, title, priority, status: 'open' };
      const next = { nextId: db.nextId + 1, tickets: [...db.tickets, ticket] };
      save(next);
      db = next;
      return send(res, 201, ticket);
    }
    throw new HttpError(405, 'method not allowed');
  }

  const m = p.match(/^\/api\/tickets\/([^/]+)$/);
  if (m) {
    if (!/^[1-9]\d*$/.test(m[1])) throw new HttpError(400, 'id must be a positive integer');
    const id = Number(m[1]);
    const ticket = db.tickets.find((t) => t.id === id);
    if (req.method === 'GET') {
      if (!ticket) throw new HttpError(404, 'ticket not found');
      return send(res, 200, ticket);
    }
    if (req.method === 'PATCH') {
      if (!ticket) throw new HttpError(404, 'ticket not found');
      const body = await readJson(req);
      onlyKeys(body, ['status']);
      const status = validateEnum('status', body.status, STATUSES);
      const updated = { ...ticket, status };
      const next = { ...db, tickets: db.tickets.map((t) => (t.id === id ? updated : t)) };
      save(next);
      db = next;
      return send(res, 200, updated);
    }
    throw new HttpError(405, 'method not allowed');
  }

  throw new HttpError(404, 'not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: 'internal server error' });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`service-desk api listening on ${HOST}:${PORT}, data in ${DB_FILE}`);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
