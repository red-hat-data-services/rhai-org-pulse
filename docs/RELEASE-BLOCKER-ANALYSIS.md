# Release blocker continuous-improvement analysis

The dashboard section is computed directly from the Approved and Rejected
issues returned by the historical trend data used by the Release Blocker
Trends chart. It does not make a second Jira request, require an AI service,
or wait for a scheduled workflow. The section therefore covers the full
historical issue set represented by that chart, independent of page filters.

The local analysis provides deterministic grouping, counts, label detection,
regression signals, and comment-based early-detection classification. It reads
the five assessment-question responses already present in the loaded Jira
comments and normalizes them into `Yes`, `No`, or `Unknown`, the documented
detection taxonomy, and an action-oriented prevention recommendation. Issues
without a qualifying response remain `Unknown`; no AI service or workflow is
required for this dashboard section.

The former workflow-based snapshot ingestion is not used by the dashboard and
is not scheduled. The optional snapshot API and generator remain documented
for a future historical dataset, but they are not needed for the dashboard
section described above.

The optional snapshot generator can read current Approved and Rejected Blocker
issues from Jira, fetch comment and changelog pages, and upload a precomputed
snapshot to Org Pulse. It is not required by the dashboard. If it is used
separately, configure these values:

| Name | Type | Purpose |
| --- | --- | --- |
| `JIRA_EMAIL` | Secret | Jira API account email |
| `JIRA_TOKEN` | Secret | Jira API token |
| `ORG_PULSE_URL` | Secret | Base URL of the deployed Org Pulse instance |
| `ORG_PULSE_TOKEN` | Secret | Bearer token with `releases:write` |
| `AI_API_KEY` | Secret | API key for the configured model endpoint |
| `JIRA_HOST` | Variable | Optional Jira base URL; defaults to Red Hat Jira |
| `AI_BASE_URL` | Variable | Optional OpenAI-compatible API base URL; defaults to `https://api.openai.com/v1` |
| `AI_MODEL` | Variable | Optional model name; defaults to `gpt-5` |

The collector sends issue metadata and relevant human-comment excerpts only. It
does not send automation comments, comment authors, or unrelated comment text.
It reuses an issue’s previous AI result when its SHA-256 fingerprint is
unchanged. A failed issue is retained with `Unknown` analysis values and marks
the snapshot partial. A total Jira, model, or upload failure exits non-zero and
does not replace the existing snapshot.

The optional snapshot API serves the precomputed data from:

`GET /api/modules/releases/delivery/blockers/analysis`

The ingestion endpoint is:

`POST /api/modules/releases/delivery/blockers/analysis/bulk`

Both endpoints require authentication; ingestion additionally requires the
`releases:write` scope. The full response format is documented in
`docs/DATA-FORMATS.md`.
