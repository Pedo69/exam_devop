#!/usr/bin/env bash
# work/check.sh — run from work/ (beside compose.yaml). Expects an EMPTY volume for C5.
#   bash check.sh                 # against http://localhost:8080
#   SKIP_DOCKER=1 bash check.sh   # API checks only (no docker)
export MSYS_NO_PATHCONV=1
URL=${URL:-http://localhost:8080}
API="$URL/api/tickets"
ok=0; bad=0

status() {
  local id=$1 want=$2 code; shift 2
  code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$@")
  if [[ $code =~ ^($want)$ ]]; then echo "PASS $id  $code  $*"; ok=$((ok+1))
  else echo "FAIL $id  got $code, want $want  $*"; bad=$((bad+1)); fi
}
cmd() {
  local id=$1 label=$2 out
  if out=$(bash -c "$3" 2>&1); then echo "PASS $id  $label"; ok=$((ok+1))
  else echo "FAIL $id  $label"; printf '%s\n' "$out" | tail -5 | sed 's/^/      /'; bad=$((bad+1)); fi
}
H=(-H 'Content-Type: application/json')
export URL API

# ---- frontend served, no mock data ----
status F1 200 "$URL/"
cmd    F1 "page loads app.js and calls /api"   "curl -fs $URL/ | grep -q 'app.js' && curl -fs $URL/app.js | grep -q \"/api/tickets\""
cmd    F2 "form has labels for title+priority" "curl -fs $URL/ | grep -q 'for=\"title\"' && curl -fs $URL/ | grep -q 'for=\"priority\"'"
cmd    F5 "filter buttons all/open/doing/done" "p=\$(curl -fs $URL/); for f in all open doing done; do echo \"\$p\" | grep -q \"data-filter=\\\"\$f\\\"\" || exit 1; done"

# ---- C5: fresh volume starts empty ----
cmd    C5 "fresh system → empty list []"       "[ \"\$(curl -fs $API | tr -d ' \n')\" = '[]' ]"

# ---- C2/C3: invalid create → 400 ----
long81=$(printf 'a%.0s' $(seq 1 81)); long80=${long81:1}
status C2 400 -X POST "$API" "${H[@]}" -d '{"priority":"low"}'
status C2 400 -X POST "$API" "${H[@]}" -d '{"title":"","priority":"low"}'
status C2 400 -X POST "$API" "${H[@]}" -d '{"title":"   ","priority":"low"}'
status C2 400 -X POST "$API" "${H[@]}" -d '{"title":123,"priority":"low"}'
status C2 400 -X POST "$API" "${H[@]}" -d '{"title":null,"priority":"low"}'
status C2 400 -X POST "$API" "${H[@]}" -d "{\"title\":\"$long81\",\"priority\":\"low\"}"
status C3 400 -X POST "$API" "${H[@]}" -d '{"title":"x"}'
status C3 400 -X POST "$API" "${H[@]}" -d '{"title":"x","priority":"urgent"}'
status C3 400 -X POST "$API" "${H[@]}" -d '{"title":"x","priority":"mediem"}'
status C1 400 -X POST "$API" "${H[@]}" -d '{"id":99,"title":"x","priority":"low"}'
status C4 400 -X POST "$API" "${H[@]}" -d '{"title":"x","priority":"low","status":"done"}'
status C2 400 -X POST "$API" "${H[@]}" -d 'not json'
status C2 400 -X POST "$API" "${H[@]}" -d '["x"]'
cmd    C5 "invalid requests stored nothing"   "[ \"\$(curl -fs $API | tr -d ' \n')\" = '[]' ]"

# ---- valid create ----
status F2 201 -X POST "$API" "${H[@]}" -d "{\"title\":\"$long80\",\"priority\":\"high\"}"
cmd    C2 "title trimmed + defaults"          "curl -fs -X POST $API -H 'Content-Type: application/json' -d '{\"title\":\"  printer broken  \",\"priority\":\"medium\"}' | grep -q '\"title\":\"printer broken\",\"priority\":\"medium\",\"status\":\"open\"'"
cmd    C1 "ids positive + unique"             "curl -fs -X POST $API -H 'Content-Type: application/json' -d '{\"title\":\"wifi\",\"priority\":\"low\"}' >/dev/null; ids=\$(curl -fs $API | grep -o '\"id\":[0-9]*' | cut -d: -f2); [ -n \"\$ids\" ] && ! echo \"\$ids\" | grep -qx 0 && [ \"\$(echo \"\$ids\" | sort | uniq -d)\" = '' ]"
cmd    F1 "API lists created tickets"         "[ \"\$(curl -fs $API | grep -o '\"id\":' | wc -l)\" -eq 3 ]"

# ---- status change ----
status C4 200 -X PATCH "$API/1" "${H[@]}" -d '{"status":"done"}'
status C4 200 -X PATCH "$API/2" "${H[@]}" -d '{"status":"doing"}'
status C4 400 -X PATCH "$API/1" "${H[@]}" -d '{"status":"closed"}'
status C4 400 -X PATCH "$API/1" "${H[@]}" -d '{"status":"done","title":"hack"}'
status C4 400 -X PATCH "$API/1" "${H[@]}" -d '{}'
status C4 404 -X PATCH "$API/999" "${H[@]}" -d '{"status":"done"}'
status C4 400 -X PATCH "$API/abc" "${H[@]}" -d '{"status":"done"}'
cmd    F4 "status persisted (re-GET)"         "curl -fs $API/1 | grep -q '\"status\":\"done\"'"
status C4 200 -X PATCH "$API/1" "${H[@]}" -d '{"status":"open"}'
cmd    C4 "done → open allowed"               "curl -fs $API/1 | grep -q '\"status\":\"open\"'"
status C4 200 -X PATCH "$API/1" "${H[@]}" -d '{"status":"done"}'

# ---- server-side filter (optional; UI filters client-side) ----
cmd    F5 "?status=done → only #1"            "r=\$(curl -fs \"$API?status=done\"); echo \"\$r\" | grep -q '\"id\":1,' && [ \"\$(echo \"\$r\" | grep -o '\"id\":' | wc -l)\" -eq 1 ]"
cmd    F5 "?status=doing → only #2"           "r=\$(curl -fs \"$API?status=doing\"); echo \"\$r\" | grep -q '\"id\":2,' && [ \"\$(echo \"\$r\" | grep -o '\"id\":' | wc -l)\" -eq 1 ]"
status F5 400 "$API?status=bogus"

# ---- docker-level checks ----
if [ -z "$SKIP_DOCKER" ]; then
  status D1 000 "http://localhost:8000/"
  cmd    D1 "only frontend publishes a port"   '[ -z "$(docker compose port backend 8000 2>/dev/null)" ]'
  cmd    D2 "persists across down/up"          'docker compose down && docker compose up -d --wait && curl -fs "$API/1" | grep -q "\"status\":\"done\""'
  cmd    D2 "persists across backend recreate" 'docker compose up -d --force-recreate --wait backend && curl -fs "$API/1" | grep -q "\"status\":\"done\""'
  cmd    D2 "new id continues after restart"   'curl -fs -X POST "$API" -H "Content-Type: application/json" -d "{\"title\":\"after restart\",\"priority\":\"low\"}" | grep -q "\"id\":4"'
  cmd    D3 "named volume present"             'docker volume ls --format "{{.Name}}" | grep -qx servicedesk_tickets'
  cmd    D4 "backend not root"                 'u=$(docker compose exec -T backend id -u) && [ "$u" != 0 ]'
fi

echo "== $ok ok, $bad failed"; [ "$bad" -eq 0 ]
