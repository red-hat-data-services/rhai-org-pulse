# Container Health Index hierarchy

Org Pulse report under **Releases → Reports → Container Health Index**
([RHOAIENG-97404](https://redhat.atlassian.net/browse/RHOAIENG-97404)).

The app is a **display layer**: an external CHI collector builds a snapshot
(Prod + Stage + Latest) and POSTs it to
`/api/modules/releases/chi-hierarchy/bulk`. Org Pulse does not call Pyxis,
Konflux, or ProdSec at runtime.

| Piece | Location |
|---|---|
| UI | `modules/releases/client/reports/ChiHierarchyReport.vue` |
| API | `modules/releases/server/chi-hierarchy/routes.js` |
| Schema | [DATA-FORMATS.md](./DATA-FORMATS.md#releases--chi-hierarchy-datareleaseschi-hierarchylatestjson) |
| Demo fixture | `fixtures/releases/chi-hierarchy/latest.json` |
| Collector | [CHI repo `PIPELINE.md`](https://gitlab.cee.redhat.com/sustaining-engineering/rhoai-sustaining/chi/-/blob/main/PIPELINE.md) |

---

## How versions appear

Versions in the UI come from ProdSec product definitions, not from Org Pulse
config:

1. [`ps_modules.json` → `openshift-ai.active_ps_update_streams`](https://gitlab.cee.redhat.com/prodsec/product-definitions/-/blob/master/data/openshift/ps_modules.json)
   lists streams such as `rhoai-2.25`, `rhoai-3.5`.
2. The CHI pipeline maps each stream to a catalog tag (`rhoai-3.5` → `v3.5`),
   collects CHI grades, joins images to `components.override`, and uploads one
   JSON snapshot.
3. The report’s version dropdown is built from `environments.*.versions` in
   that snapshot. **No Org Pulse code change is required** when a new stream
   is already in `active_ps_update_streams` and the next pipeline run succeeds.

---

## Onboard a new RHOAI version

Use this when a new stream (e.g. `rhoai-3.6`) should show up in the report.

### 1. Confirm ProdSec has the stream

In `ps_modules.json` under `openshift-ai`:

- `active_ps_update_streams` includes the new stream (e.g. `rhoai-3.6`)
- `components.override` covers the images you expect for that release

If the stream is missing, ask ProdSec / product-definitions owners to add it.
Until it lands there, the collector will not treat it as an active version.

### 2. Confirm catalog / Stage tags exist

Images under `rhoai/` must carry the matching tag (`v3.6`) in:

| Env | Source |
|---|---|
| Prod | `catalog.redhat.com` (public Pyxis) |
| Stage | `pyxis.stage.engineering.redhat.com` (Kerberos) |
| Latest | Konflux clair-scan via KubeArchive (`OC_TOKEN`) |

Do **not** use `catalog.stage.redhat.com` (403).

Spot-check one known image (e.g. `odh-dashboard-rhel9`) for the new tag before
relying on a full pipeline run.

### 3. Re-run the CHI collector

In the [CHI repository](https://gitlab.cee.redhat.com/sustaining-engineering/rhoai-sustaining/chi):

- **Scheduled / CI:** the daily pipeline resolves tags from
  `active_ps_update_streams` automatically — wait for the next successful run,
  or trigger the pipeline manually.
- **Local:** follow `PIPELINE.md` — collect Prod (+ Stage if Kerberos works),
  run `build_chi_hierarchy.py`, POST to Org Pulse bulk.

After upload, open **Container Health Index**, pick Prod/Stage/Latest, and confirm the
new version appears in the dropdown with component → image rows.

### 4. Org Pulse changes (usually none)

| Situation | Action |
|---|---|
| New stream already in `active_ps_update_streams` + catalog tags exist | None — next bulk upload is enough |
| Demo mode should show the new version | Update `fixtures/releases/chi-hierarchy/latest.json` (and keep [DATA-FORMATS.md](./DATA-FORMATS.md) example in sync if the schema changes) |
| New component ownership / rename | Fix in ProdSec `components.override`; unmapped images show under **Unmapped** until then |
| Schema or API change | Update routes, fixture, DATA-FORMATS, and tests in the same PR |

---

## Retire / drop a version

Remove the stream from `active_ps_update_streams` (or stop collecting that tag
in the CHI pipeline). The next bulk payload will omit it; the UI only lists
versions present in the latest snapshot. Optionally trim the demo fixture for
consistency.

---

## Grading

Hover the help icon next to **Container Health Index**.

- **Prod / Stage:** catalog HealthIndex ([article 2803031](https://access.redhat.com/articles/2803031)).
- **Latest:** same article, computed from the latest green Konflux clair-scan. Letter is the age of the oldest **rhel-vex** patched Critical/Important (High → Important). Unpatched Clair findings and `osv/go` / `osv/pypi` do not change the letter. Zero such findings → A. Unknown means missing pipeline or scan. Latest will not match Prod for the same image name.

---

## Component mapping notes

- Override keys look like `rhoai/odh-dashboard-rhel9` → component name
  (e.g. `AI Core Dashboard`).
- Join key: strip `rhoai/`, match CHI `images[].name`.
- Images with no override entry roll into **Unmapped** (still visible, with
  worst-grade rollup).

## Catalog links

Each image’s `catalogUrl` must end with the Pyxis **repository** `_id`
(not the per-architecture image id):

```
https://catalog.redhat.com/en/software/containers/rhoai/<name>/<repo_id>
```

Without that final segment, catalog.redhat.com returns **404**. Latest images
use `konfluxUrl` (PipelineRun) instead.

---

## Local smoke (non-demo)

```bash
# Org Pulse must NOT be in DEMO_MODE (bulk is skipped when DEMO_MODE=true)
curl -sS -X POST http://localhost:3001/api/modules/releases/chi-hierarchy/bulk \
  -H 'Content-Type: application/json' \
  --data-binary @chi-hierarchy-latest.json

curl -sS http://localhost:3001/api/modules/releases/chi-hierarchy/status | jq .
```

Then open: `/#/releases/reports?report=container-health-index`

---

## Related links

- Jira: [RHOAIENG-97404](https://redhat.atlassian.net/browse/RHOAIENG-97404)
- CHI pipeline guide: [PIPELINE.md](https://gitlab.cee.redhat.com/sustaining-engineering/rhoai-sustaining/chi/-/blob/main/PIPELINE.md)
- ProdSec definitions: [ps_modules.json](https://gitlab.cee.redhat.com/prodsec/product-definitions/-/blob/master/data/openshift/ps_modules.json)
