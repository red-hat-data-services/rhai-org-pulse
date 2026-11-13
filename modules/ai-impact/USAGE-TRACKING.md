# AI Impact usage tracking

Temporary measurement for [AISDLC-2](https://redhat.atlassian.net/browse/AISDLC-2): which AI Impact features each persona uses, so we can decide what moves to the new Org Pulse. Remove `client/composables/useUsageTracking.js` and its callers once that decision is made.

Events go to core's health-metrics store through `trackUsage(action, detail)` from `@shared/client`. Read them with `GET /api/health-metrics/report` (admin or `usage-metrics-viewer`).

## What is recorded

Which control was used. Never what was typed, and never which RFE, feature, test plan or component was opened. The server also rejects any `detail` outside `[a-zA-Z0-9:_/-]` or longer than 64 characters.

| action | detail | When |
|--------|--------|------|
| `view` | none | The shell records every view open. Home-page widgets record one under `ai-impact::sotu/<widget-id>` |
| `nav` | `from-<viewId>` | Arrived from another AI Impact view |
| `filter` | filter name, e.g. `status`, `timeWindow`, `sortBy` | A filter, sort or time window left its default |
| `search` | none | A search box went from empty to non-empty |
| `open` | `rfe`, `feature`, `testPlan`, `strategy`, `component`, `phase-<id>`, `assessment-guide`, `settings` | A detail panel, modal or guide phase opened |
| `tab` | tab id, e.g. `enablement` | Assessment guide tab changed |
| `link` | `jira`, `github`, `gitlab`, `slack`, `google`, `other` | Outbound link clicked. Only the host kind is read, never the path |
| `button` | `charts`, `labels-<phase>` or a `data-track` value | Expand/collapse and other one-off controls |
| `wizard` | `complete-auto`, `complete-manual`, `skip` | For You wizard finished |
| `settings` | `for-you` | For You preferences applied |

## Adding a control

- State in a `ref`: add it to the `useUsageTracking({ filter, search, open, toggle, tab })` call in the view, or `trackRefs({...})` in a child component.
- A plain button or link: add `data-track="action:detail"` to the element.
- `detail` must be a fixed id written in the source, not a value from data or user input.

Not covered: `AIImpactSettings.vue` (admin-only, lives on the shell Settings page, which health-metrics does not track).
