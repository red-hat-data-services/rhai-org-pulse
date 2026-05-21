# Platform Modularization Plan

**Goal:** Extract a reusable "Org Pulse Core" platform so other Red Hat orgs can deploy their own instances with custom modules, and later add cross-instance federation.

**Approach:** Option E — Core Platform + Federation (Hybrid)

**Status:** Phase 1 in progress

---

## Phase 1: Core Platform Extraction

### Step 1.1 — Remove cross-module violations ⬜
**Effort:** Small (2 files) | **Breaks BC:** No

Two places where `team-tracker` reaches directly into `ai-impact`:

1. **`modules/team-tracker/client/components/RfeBacklogTable.vue`** — links directly to ai-impact's RFE review view
2. **`modules/team-tracker/client/components/TeamBacklogTab.vue`** — fetches from `/api/modules/ai-impact/assessments`

**Fix pattern:** Use `useModuleLink` with a "module installed?" guard, or emit a cross-module event. If ai-impact isn't present, these links/fetches should gracefully degrade (hide the link, skip the fetch).

### Step 1.2 — Externalize hardcoded Jira project keys ⬜
**Effort:** Medium | **Breaks BC:** Yes (module config API change)

~20 non-test/non-fixture files have hardcoded project keys (RHOAIENG, AIPCC, RHAIENG, INFERENG):

- `modules/releases/server/delivery/config.js`
- `modules/releases/client/` (4 files)
- `modules/team-tracker/server/jira/` (2 files)
- `modules/team-tracker/client/components/JiraSyncSettings.vue`
- `modules/ai-impact/server/` (3 files)
- `modules/ai-impact/client/` (5 files)
- `shared/server/smartsheet.js`

**Pattern:** Modules declare config in `module.json`:
```json
{
  "server": {
    "config": {
      "jiraProjects": {
        "label": "Jira Projects",
        "type": "string[]",
        "description": "Jira project keys to query"
      }
    }
  }
}
```
Modules read via `context.config.jiraProjects` instead of hardcoding. Config set per-instance via Settings UI or env vars.

**Config precedence:** Settings UI override > env var / ConfigMap > default from `module.json`

### Step 1.3 — Configurable branding ⬜
**Effort:** Small | **Breaks BC:** No

Currently hardcoded: Red Hat logo, "Org Pulse" title, color palette.

- Add `SITE_TITLE` / `SITE_LOGO_URL` env vars (or Settings UI)
- CSS custom properties for primary palette (already using Tailwind `primary` — make values configurable)
- `titlePrefix` mechanism partially exists — extend it

### Step 1.4 — Generic CronJob / refresh hooks ⬜
**Effort:** Medium | **Breaks BC:** Yes (CronJob script changes)

Replace the 150-line hardcoded bash CronJob with:
- Platform-level `/api/admin/refresh-all` endpoint that iterates enabled modules
- Modules register refresh hooks via `context.registerRefresh(fn)` (same pattern as `registerDiagnostics`)
- CronJob becomes: trigger roster sync → wait → trigger module refresh

### Step 1.5 — Tag v1.0.0 + BREAKING-CHANGES.md ⬜
**Effort:** Small | **Breaks BC:** No

- Tag current state as `v1.0.0` before starting breaking changes
- Create `BREAKING-CHANGES.md` documenting every breaking change with migration instructions
- Each phase gets a minor version bump

---

## Phase 2: Pilot Deployments

### Step 2.1 — Module development kit ⬜
- `create-module` CLI or template scaffold
- Extend existing `docs/MODULES.md` into full "How to build an Org Pulse module" guide
- Example starter module: basic Jira dashboard with configurable project keys

### Step 2.2 — External module loading (container layering) ⬜
- Org builds image `FROM org-pulse-core:v1.2`, copies modules into `/app/modules/`
- Their CI builds and pushes to their own registry
- Document the pattern

### Step 2.3 — Pilot support ⬜
- Deploy with 2 pilot Red Hat orgs
- Identify remaining AI Eng-specific gaps
- Iterate on module API based on real feedback

---

## Phase 3: Federation

### Step 3.1 — Shared data schemas ⬜
Start narrow: RFE/feature dependency tracking across orgs.

### Step 3.2 — Federation protocol ⬜
Direct API federation:
- Each instance exposes `/api/federation/published` (read-only)
- Admin configures peers in Settings UI (URLs + auth tokens)
- Hourly sync, cached locally
- Modules query via `context.federation.getArtifacts({ org, type })`

### Step 3.3 — Cross-org dependency UI ⬜
New core module showing cross-org dependencies, blockages, and links.

### Step 3.4 — RFE assessor portability ⬜
Make assessment rubrics configurable rather than AI Eng-specific.

---

## Architecture Decisions (Resolved)

1. **People & Teams stays as core module** — roster data powers auth, sidebar, shell. Not optional.
2. **Monorepo for now** — multi-repo adds complexity not needed with 2 pilot orgs. Split later at 5+ module packs.
3. **Kustomize, not Helm** — `secretGenerator` in base for required secrets, org overlays handle their own secret management.
4. **Container layering for module distribution** — orgs extend `FROM org-pulse-core`, copy modules in.
5. **Config: three-layer precedence** — Settings UI > env var/ConfigMap > module.json default. UI shows effective value + source badge.
6. **Multi-root roster** — `orgRoots` supports array of UIDs per org entry. LDAP traversal walks each, unions results.
7. **Federation: direct API, no shared infra** — no S3/Kafka/DB between instances.

## Effort Estimates

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1 (core extraction) | ~2-3 weeks | Can start immediately |
| Phase 2 (pilot deployments) | ~2-4 weeks | Depends on pilot org engagement |
| Phase 3 (federation) | ~3-4 weeks | Can overlap with Phase 2 |
