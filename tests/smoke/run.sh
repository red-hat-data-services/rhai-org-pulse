#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Team Tracker Smoke Test Suite
# Runs against a deployed instance (Kind cluster or local).
# Requires: curl, jq
#
# Usage: BACKEND_URL=http://localhost:3001 FRONTEND_URL=http://localhost:8080 ./run.sh
# ─────────────────────────────────────────────────────────────────────

set -uo pipefail
# Note: not using set -e — individual test failures are tracked via counters.

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"

PASSED=0
FAILED=0
SKIPPED=0
ERRORS=()

# ─── Helpers ─────────────────────────────────────────────────────────

pass() { PASSED=$((PASSED + 1)); echo "  ✅ $1"; }
fail() { FAILED=$((FAILED + 1)); ERRORS+=("$1"); echo "  ❌ $1"; }
skip() { SKIPPED=$((SKIPPED + 1)); echo "  ⏭️  $1"; }

# GET/POST returning body\nstatus
api_get() {
  curl -s -w "\n%{http_code}" "${BACKEND_URL}$1" 2>/dev/null || echo -e "\n000"
}
api_post() {
  curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "${2:-{}}" "${BACKEND_URL}$1" 2>/dev/null || echo -e "\n000"
}

get_body() { echo "$1" | sed '$d'; }
get_status() { echo "$1" | tail -1; }

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then pass "$label → $actual"; else fail "$label → expected $expected, got $actual"; fi
}

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

if command -v kubectl &> /dev/null && kubectl get ns team-tracker &> /dev/null 2>&1; then
  echo ""
  echo "  Checking pods..."
  BACKEND_PHASE=$(kubectl get pods -n team-tracker -l component=backend -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "unknown")
  FRONTEND_PHASE=$(kubectl get pods -n team-tracker -l component=frontend -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "unknown")

  if [ "$BACKEND_PHASE" = "Running" ]; then pass "Backend pod is Running"; else fail "Backend pod: $BACKEND_PHASE"; fi
  if [ "$FRONTEND_PHASE" = "Running" ]; then pass "Frontend pod is Running"; else fail "Frontend pod: $FRONTEND_PHASE"; fi

  echo ""
  echo "  Checking services..."
  BACKEND_SVC=$(kubectl get svc backend -n team-tracker -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "")
  FRONTEND_SVC=$(kubectl get svc team-tracker -n team-tracker -o jsonpath='{.spec.ports[0].port}' 2>/dev/null || echo "")

  if [ -n "$BACKEND_SVC" ]; then pass "Backend service exists (port $BACKEND_SVC)"; else fail "Backend service not found"; fi
  if [ -n "$FRONTEND_SVC" ]; then pass "Frontend service exists (port $FRONTEND_SVC)"; else fail "Frontend service not found"; fi

  echo ""
  echo "  Checking secrets..."
  if kubectl get secret team-tracker-secrets -n team-tracker &> /dev/null; then pass "team-tracker-secrets exists"; else fail "team-tracker-secrets not found"; fi
  if kubectl get secret google-sa-key -n team-tracker &> /dev/null; then pass "google-sa-key exists"; else fail "google-sa-key not found"; fi
else
  skip "Kubernetes checks (kubectl not available or namespace not found)"
fi

# ═════════════════════════════════════════════════════════════════════
# TIER 2: API Contract Tests
# ═════════════════════════════════════════════════════════════════════
echo ""
echo "━━━ TIER 2: API Contract Tests ━━━"

# ── Health ──
echo ""
echo "  [Health]"
response=$(api_get "/healthz")
check_status "GET /healthz" "200" "$(get_status "$response")"

# ── Identity ──
echo ""
echo "  [Identity]"
response=$(api_get "/api/whoami")
check_status "GET /api/whoami" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "whoami has email" "$body" '.email | type == "string"'
check_jq "whoami has displayName" "$body" '.displayName | type == "string"'

# ── Teams ──
echo ""
echo "  [Teams]"
response=$(api_get "/api/teams")
check_status "GET /api/teams" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Response is array" "$body" 'type == "array"'
check_jq "Has at least one team" "$body" 'length >= 1'
check_jq "Team has teamId" "$body" '.[0] | has("teamId")'
check_jq "Team has boardId" "$body" '.[0] | has("boardId")'
check_jq "Team has displayName" "$body" '.[0] | has("displayName")'
check_jq "Team has enabled flag" "$body" '.[0] | has("enabled")'

# ── Boards ──
echo ""
echo "  [Boards]"
response=$(api_get "/api/boards")
check_status "GET /api/boards" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Response has boards array" "$body" '.boards | type == "array"'
check_jq "Response has lastUpdated" "$body" '.lastUpdated | type == "string"'

# ── Dashboard Summary ──
echo ""
echo "  [Dashboard Summary]"
response=$(api_get "/api/dashboard-summary")
check_status "GET /api/dashboard-summary" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Has boards object" "$body" '.boards | type == "object"'
check_jq "Has lastUpdated" "$body" '.lastUpdated | type == "string"'

# ── Roster ──
echo ""
echo "  [Roster]"
response=$(api_get "/api/roster")
check_status "GET /api/roster" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Roster has vp field" "$body" 'has("vp")'
check_jq "Roster has orgs" "$body" '.orgs | type == "object"'
check_jq "Roster has at least one org" "$body" '.orgs | keys | length >= 1'

# ── People Metrics (bulk) ──
echo ""
echo "  [People Metrics]"
response=$(api_get "/api/people/metrics")
check_status "GET /api/people/metrics" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Has fixture people" "$body" 'keys | length >= 4'
check_jq "Has Bob Smith" "$body" 'has("Bob Smith")'
check_jq "Has Carol Williams" "$body" 'has("Carol Williams")'
check_jq "Person has resolvedCount" "$body" '.["Bob Smith"].resolvedCount | type == "number"'
check_jq "Person has resolvedPoints" "$body" '.["Bob Smith"].resolvedPoints | type == "number"'
check_jq "Person has avgCycleTimeDays" "$body" '.["Bob Smith"].avgCycleTimeDays | type == "number"'
check_jq "ResolvedCount is positive" "$body" '.["Bob Smith"].resolvedCount > 0'

# ── Person Metrics (individual) ──
echo ""
echo "  [Person Metrics — Individual]"
response=$(api_get "/api/person/Bob%20Smith/metrics")
check_status "GET /api/person/:name/metrics" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Has jiraDisplayName" "$body" '.jiraDisplayName == "Bob Smith"'
check_jq "Has resolved section" "$body" '.resolved | has("count", "storyPoints", "issues")'
check_jq "Has inProgress section" "$body" '.inProgress | has("count")'
check_jq "Has cycleTime section" "$body" '.cycleTime | has("avgDays")'
check_jq "Resolved issues have keys" "$body" '.resolved.issues[0] | has("key", "summary", "type")'
check_jq "Issue keys look like Jira keys" "$body" '.resolved.issues[0].key | test("^DEMO-[0-9]+")'
check_jq "Resolved count > 0" "$body" '.resolved.count > 0'
check_jq "Story points > 0" "$body" '.resolved.storyPoints > 0'

# ── GitHub Contributions ──
echo ""
echo "  [GitHub Contributions]"
response=$(api_get "/api/github/contributions")
check_status "GET /api/github/contributions" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Has users object" "$body" '.users | type == "object"'
check_jq "Has at least one user" "$body" '.users | keys | length >= 1'
check_jq "User data has totalPRs" "$body" '[.users[]][0] | has("totalPRs")'

# ── Allowlist ──
echo ""
echo "  [Allowlist]"
response=$(api_get "/api/allowlist")
check_status "GET /api/allowlist" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Allowlist has emails" "$body" '.emails | type == "array"'
check_jq "Allowlist has entries" "$body" '.emails | length >= 1'

# ── DEMO_MODE Guards ──
echo ""
echo "  [DEMO_MODE Guards]"
response=$(api_post "/api/refresh" '{}')
check_status "POST /api/refresh" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Refresh returns skipped" "$body" '.status == "skipped"'

response=$(api_post "/api/roster/refresh" '{}')
check_status "POST /api/roster/refresh" "200" "$(get_status "$response")"
body=$(get_body "$response")
check_jq "Roster refresh returns skipped" "$body" '.status == "skipped"'

# ── Write Operations ──
echo ""
echo "  [Write Operations]"
response=$(api_post "/api/teams" '[{"teamId":"ci-test","boardId":9999,"displayName":"CI Test","enabled":true}]')
check_status "POST /api/teams (valid)" "200" "$(get_status "$response")"

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
  if echo "$FRONTEND_RESPONSE" | grep -q "</html>"; then pass "Returns valid HTML"; else fail "Missing </html>"; fi
  if echo "$FRONTEND_RESPONSE" | grep -qE '\.(js|mjs)'; then pass "References JS bundle"; else fail "Missing JS bundle reference"; fi
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

# Invalid teams POST — app currently accepts any shape (no server-side validation)
# Just verify it doesn't crash
response=$(api_post "/api/teams" '{"invalid": "data"}')
status=$(get_status "$response")
if [ "$status" = "200" ] || [ "$status" = "400" ]; then
  pass "POST /api/teams (invalid body) → handled ($status)"
else
  fail "POST /api/teams (invalid body) → unexpected $status"
fi

# Nonexistent person — app may return 404 or empty metrics
response=$(api_get "/api/person/Nonexistent%20Person/metrics")
status=$(get_status "$response")
if [ "$status" = "404" ] || [ "$status" = "200" ]; then
  pass "GET /api/person/Nonexistent (handled: $status)"
else
  fail "GET /api/person/Nonexistent → unexpected $status"
fi

# Nonexistent board sprints
response=$(api_get "/api/boards/99999/sprints")
status=$(get_status "$response")
if [ "$status" = "200" ] || [ "$status" = "404" ]; then
  pass "GET /api/boards/99999/sprints (handled: $status)"
else
  fail "GET /api/boards/99999/sprints → unexpected $status"
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
if [ "$FAILED" -gt 0 ]; then exit 1; else exit 0; fi
