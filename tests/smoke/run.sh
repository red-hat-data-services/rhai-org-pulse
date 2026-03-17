#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Team Tracker Smoke Test Suite
# Runs against a deployed instance (Kind cluster or local).
# Requires: curl, jq
#
# Usage: BACKEND_URL=http://localhost:3001 FRONTEND_URL=http://localhost:8080 ./run.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"

PASSED=0
FAILED=0
SKIPPED=0
ERRORS=()

# ─── Helpers ─────────────────────────────────────────────────────────

pass() { ((PASSED++)); echo "  ✅ $1"; }
fail() { ((FAILED++)); ERRORS+=("$1"); echo "  ❌ $1"; }
skip() { ((SKIPPED++)); echo "  ⏭️  $1"; }

# GET request, capture body + status code
# Usage: response=$(api_get "/api/endpoint")
#        body=$(echo "$response" | head -n -1)
#        status=$(echo "$response" | tail -1)
api_get() {
  local url="${BACKEND_URL}$1"
  curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo -e "\n000"
}

api_post() {
  local url="${BACKEND_URL}$1"
  local body="${2:-{}}"
  curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null || echo -e "\n000"
}

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$label → $actual"
  else
    fail "$label → expected $expected, got $actual"
  fi
}

# Extract body (all but last line) and status (last line) from api_get/api_post output
get_body() { echo "$1" | head -n -1; }
get_status() { echo "$1" | tail -1; }

# Check that a jq expression returns a truthy value
check_jq() {
  local label="$1" body="$2" expr="$3"
  if echo "$body" | jq -e "$expr" > /dev/null 2>&1; then
    pass "$label"
  else
    local actual
    actual=$(echo "$body" | jq -r "$expr" 2>/dev/null || echo "jq error")
    fail "$label (got: $actual)"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# TIER 1: Infrastructure Health
# ═════════════════════════════════════════════════════════════════════
echo ""
echo "━━━ TIER 1: Infrastructure Health ━━━"

if command -v kubectl &> /dev/null && kubectl get ns team-tracker &> /dev/null; then
  echo ""
  echo "  Checking pod status..."
  BACKEND_READY=$(kubectl get pods -n team-tracker -l app=backend -o jsonpath='{.items[0].status.containerStatuses[0].ready}' 2>/dev/null || echo "unknown")
  FRONTEND_READY=$(kubectl get pods -n team-tracker -l app=frontend -o jsonpath='{.items[0].status.containerStatuses[0].ready}' 2>/dev/null || echo "unknown")

  if [ "$BACKEND_READY" = "true" ]; then pass "Backend pod is ready"; else fail "Backend pod not ready ($BACKEND_READY)"; fi
  if [ "$FRONTEND_READY" = "true" ]; then pass "Frontend pod is ready"; else fail "Frontend pod not ready ($FRONTEND_READY)"; fi

  echo ""
  echo "  Checking services..."
  BACKEND_SVC=$(kubectl get svc backend -n team-tracker -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "")
  FRONTEND_SVC=$(kubectl get svc team-tracker -n team-tracker -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "")

  if [ -n "$BACKEND_SVC" ]; then pass "Backend service exists (port $BACKEND_SVC)"; else fail "Backend service not found"; fi
  if [ -n "$FRONTEND_SVC" ]; then pass "Frontend service exists (port $FRONTEND_SVC)"; else fail "Frontend service not found"; fi

  echo ""
  echo "  Checking secrets..."
  SECRET_EXISTS=$(kubectl get secret team-tracker-secrets -n team-tracker -o name 2>/dev/null || echo "")
  SA_KEY_EXISTS=$(kubectl get secret google-sa-key -n team-tracker -o name 2>/dev/null || echo "")

  if [ -n "$SECRET_EXISTS" ]; then pass "team-tracker-secrets exists"; else fail "team-tracker-secrets not found"; fi
  if [ -n "$SA_KEY_EXISTS" ]; then pass "google-sa-key exists"; else fail "google-sa-key not found"; fi
else
  skip "Kubernetes checks (kubectl not available or namespace not found)"
fi

# ═════════════════════════════════════════════════════════════════════
# TIER 2: API Contract Tests
# ═════════════════════════════════════════════════════════════════════
echo ""
echo "━━━ TIER 2: API Contract Tests ━━━"

# ── Health check ──
echo ""
echo "  [Health]"
response=$(api_get "/healthz")
check_status "GET /healthz" "200" "$(get_status "$response")"
check_jq "/healthz has status field" "$(get_body "$response")" '.status == "ok" or .status == "healthy" or . == "OK"'

# ── Identity ──
echo ""
echo "  [Identity]"
response=$(api_get "/api/whoami")
check_status "GET /api/whoami" "200" "$(get_status "$response")"
check_jq "/api/whoami has email" "$(get_body "$response")" '.email | length > 0'
check_jq "/api/whoami has displayName" "$(get_body "$response")" '.displayName | length > 0'

# ── Teams ──
echo ""
echo "  [Teams]"
response=$(api_get "/api/teams")
check_status "GET /api/teams" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "/api/teams has teams array" "$body" '.teams | type == "array"'
check_jq "/api/teams has enabled teams" "$body" '[.teams[] | select(.enabled == true)] | length >= 2'
check_jq "/api/teams team has required fields" "$body" '.teams[0] | has("teamId", "boardId", "displayName")'

# ── Boards ──
echo ""
echo "  [Boards]"
response=$(api_get "/api/boards")
check_status "GET /api/boards" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "/api/boards has boards array" "$body" '.boards | type == "array"'
check_jq "/api/boards has lastUpdated" "$body" '.lastUpdated | length > 0'
check_jq "/api/boards boards have required fields" "$body" '.boards[0] | has("id", "boardId", "name")'
# Disabled teams should not appear
check_jq "/api/boards excludes disabled teams" "$body" '[.boards[] | select(.name == "Gamma Board")] | length == 0'

# ── Board Sprints ──
echo ""
echo "  [Board Sprints]"
response=$(api_get "/api/boards/team-alpha/sprints")
check_status "GET /api/boards/:boardId/sprints" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Board has sprints array" "$body" '.sprints | type == "array"'
check_jq "Board has multiple sprints" "$body" '.sprints | length >= 2'
check_jq "Sprint has required fields" "$body" '.sprints[0] | has("id", "name", "state", "startDate")'
check_jq "Has both active and closed sprints" "$body" '([.sprints[] | .state] | unique | length) >= 2'

# ── Sprint Detail ──
echo ""
echo "  [Sprint Detail]"
response=$(api_get "/api/sprints/5000")
check_status "GET /api/sprints/:sprintId" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Sprint has committed data" "$body" '.committed.totalPoints > 0'
check_jq "Sprint has delivered data" "$body" '.delivered.totalPoints > 0'
check_jq "Sprint has metrics" "$body" '.metrics | has("scopeChangeCount")'
check_jq "Committed issues is array" "$body" '.committed.issues | type == "array"'
check_jq "Delivered points <= committed points" "$body" '.delivered.totalPoints <= .committed.totalPoints'
check_jq "Issues have Jira-like keys" "$body" '.committed.issues[0].key | test("^DEMO-[0-9]+")'

# ── Dashboard Summary ──
echo ""
echo "  [Dashboard Summary]"
response=$(api_get "/api/dashboard-summary")
check_status "GET /api/dashboard-summary" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Dashboard has boards object" "$body" '.boards | type == "object"'
check_jq "Dashboard has lastUpdated" "$body" '.lastUpdated | length > 0'
check_jq "Dashboard has team metrics" "$body" '.boards | keys | length > 0'
# Validate metric shape for any team that appears
check_jq "Team metrics have commitment reliability" "$body" '[.boards[]][0].metrics | has("commitmentReliabilityPoints")'
check_jq "Team metrics have avg velocity" "$body" '[.boards[]][0].metrics | has("avgVelocityPoints")'
check_jq "Commitment reliability is 0-100 range" "$body" '[.boards[]][0].metrics.commitmentReliabilityPoints | (. >= 0 and . <= 100)'

# ── Roster ──
echo ""
echo "  [Roster]"
response=$(api_get "/api/roster")
check_status "GET /api/roster" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Roster returns data" "$body" '. | length > 0'

# ── People Metrics (bulk) ──
echo ""
echo "  [People Metrics]"
response=$(api_get "/api/people/metrics")
check_status "GET /api/people/metrics" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Has fixture people" "$body" 'keys | length >= 4'
check_jq "Has Bob Smith" "$body" 'has("Bob Smith")'
check_jq "Has Carol Williams" "$body" 'has("Carol Williams")'
check_jq "Person has resolvedCount (number)" "$body" '.["Bob Smith"].resolvedCount | type == "number"'
check_jq "Person has resolvedPoints (number)" "$body" '.["Bob Smith"].resolvedPoints | type == "number"'
check_jq "Person has avgCycleTimeDays" "$body" '.["Bob Smith"] | has("avgCycleTimeDays")'
check_jq "ResolvedCount is positive" "$body" '.["Bob Smith"].resolvedCount > 0'

# ── Person Metrics (individual) ──
echo ""
echo "  [Person Metrics — Individual]"
response=$(api_get "/api/person/Bob%20Smith/metrics")
check_status "GET /api/person/:name/metrics" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Person has jiraDisplayName" "$body" '.jiraDisplayName == "Bob Smith"'
check_jq "Person has resolved section" "$body" '.resolved | has("count", "storyPoints", "issues")'
check_jq "Person has inProgress section" "$body" '.inProgress | has("count")'
check_jq "Person has cycleTime section" "$body" '.cycleTime | has("avgDays")'
check_jq "Resolved issues have keys" "$body" '.resolved.issues[0] | has("key", "summary", "type")'

# ── GitHub Contributions ──
echo ""
echo "  [GitHub Contributions]"
response=$(api_get "/api/github/contributions")
check_status "GET /api/github/contributions" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Has users object" "$body" '.users | type == "object"'
check_jq "Has at least one user" "$body" '.users | keys | length > 0'

# ── Allowlist ──
echo ""
echo "  [Allowlist]"
response=$(api_get "/api/allowlist")
check_status "GET /api/allowlist" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Allowlist has emails array" "$body" '.emails | type == "array"'
check_jq "Allowlist has demo entry" "$body" '.emails | index("demo@example.com") != null'

# ── DEMO_MODE Guards ──
echo ""
echo "  [DEMO_MODE Guards]"
response=$(api_post "/api/refresh" '{}')
check_status "POST /api/refresh (demo)" "200" "$(get_status "$response")"
check_jq "Refresh returns skipped status" "$(get_body "$response")" '.status == "skipped"'

response=$(api_post "/api/roster/refresh" '{}')
check_status "POST /api/roster/refresh (demo)" "200" "$(get_status "$response")"
check_jq "Roster refresh returns skipped" "$(get_body "$response")" '.status == "skipped"'

# ── Write Operations ──
echo ""
echo "  [Write Operations]"
response=$(api_post "/api/teams" '{"teams": [{"teamId": "test", "boardId": 9999, "displayName": "CI Test", "enabled": true}]}')
check_status "POST /api/teams (valid)" "200" "$(get_status "$response")"
check_jq "POST teams returns success" "$(get_body "$response")" '.success == true'

# ═════════════════════════════════════════════════════════════════════
# TIER 3: Frontend Integration
# ═════════════════════════════════════════════════════════════════════
echo ""
echo "━━━ TIER 3: Frontend Integration ━━━"

echo ""
echo "  [Frontend Serving]"
FRONTEND_RESPONSE=$(curl -s "$FRONTEND_URL/" 2>/dev/null || echo "")
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/" 2>/dev/null || echo "000")

check_status "GET / (frontend)" "200" "$FRONTEND_STATUS"

if [ -n "$FRONTEND_RESPONSE" ]; then
  if echo "$FRONTEND_RESPONSE" | grep -q "</html>"; then
    pass "Frontend returns valid HTML"
  else
    fail "Frontend response missing </html>"
  fi

  if echo "$FRONTEND_RESPONSE" | grep -q '<div id="app"'; then
    pass "Frontend has Vue app mount point"
  else
    skip "Vue mount point check (may use different id)"
  fi

  if echo "$FRONTEND_RESPONSE" | grep -qE '\.(js|mjs)"'; then
    pass "Frontend references JavaScript bundle"
  else
    fail "Frontend missing JS bundle reference"
  fi
else
  fail "Frontend returned empty response"
fi

# ═════════════════════════════════════════════════════════════════════
# TIER 4: Negative & Edge Cases
# ═════════════════════════════════════════════════════════════════════
echo ""
echo "━━━ TIER 4: Negative & Edge Cases ━━━"

echo ""
echo "  [Error Handling]"

# Invalid team POST
response=$(api_post "/api/teams" '{"invalid": "data"}')
check_status "POST /api/teams (invalid body)" "400" "$(get_status "$response")"

# Nonexistent person
response=$(api_get "/api/person/Nonexistent%20Person/metrics")
status=$(get_status "$response")
if [ "$status" = "404" ] || [ "$status" = "200" ]; then
  pass "GET /api/person/Nonexistent (handled: $status)"
else
  fail "GET /api/person/Nonexistent → unexpected $status"
fi

# Nonexistent board sprints (should return empty, not error)
response=$(api_get "/api/boards/99999/sprints")
check_status "GET /api/boards/99999/sprints (nonexistent)" "200" "$(get_status "$response")"
check_jq "Nonexistent board returns empty sprints" "$(get_body "$response")" '.sprints | length == 0'

# Nonexistent sprint
response=$(api_get "/api/sprints/99999")
status=$(get_status "$response")
if [ "$status" = "200" ] || [ "$status" = "404" ]; then
  pass "GET /api/sprints/99999 (handled: $status)"
else
  fail "GET /api/sprints/99999 → unexpected $status"
fi

# ═════════════════════════════════════════════════════════════════════
# RESULTS
# ═════════════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: ✅ $PASSED passed, ❌ $FAILED failed, ⏭️  $SKIPPED skipped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo "  Failures:"
  for err in "${ERRORS[@]}"; do
    echo "    • $err"
  done
fi

echo ""
exit $FAILED
