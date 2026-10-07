# E2E Results Publisher API

The Jenkins job decides which completed runs to publish. Create an Org Pulse API
token in Settings → API Tokens with only the `releases:e2e:write` scope. Send it
to the API server as `Authorization: Bearer tt_...`. The Jenkins API key used to
read Jenkins builds is a different credential and must not be sent to Org Pulse.

The first publisher call creates or replaces the base run. The analysis call
updates only the agent analysis, so it can arrive after the Jenkins result.
Both calls identify a run by the same Jenkins instance, full job path, and
build number. Retrying either call does not create a second run.

## Publish a completed run

`POST /api/modules/releases/build-health/runs`

```json
{
  "schemaVersion": 1,
  "jenkins": {
    "instance": "jenkins.example.com",
    "job": "components/dashboard/dashboard-e2e-tests",
    "buildNumber": 3424,
    "buildUrl": "https://jenkins.example.com/job/components/job/dashboard/job/dashboard-e2e-tests/3424/"
  },
  "reporting": { "stream": "rhoai-nightly" },
  "run": {
    "result": "SUCCESS",
    "displayName": "#3424",
    "startedAt": "2026-10-05T10:21:20.340Z",
    "completedAt": "2026-10-05T11:07:57.673Z",
    "durationMs": 2797333
  },
  "release": {
    "product": "RHOAI",
    "version": "3.6",
    "installedVersion": "3.6.0",
    "imageRef": "quay.io/rhoai/rhoai-fbc-fragment@sha256:example",
    "imageDigest": "sha256:example"
  },
  "environment": {
    "name": "GCP",
    "clusterName": "bvt-rhoai-gcp-20",
    "platform": "stage",
    "clusterType": "selfmanaged",
    "architecture": "amd64"
  },
  "tests": {
    "collectionState": "complete",
    "suiteCount": 1,
    "counts": { "passed": 52, "failed": 0, "skipped": 0 },
    "failedCases": []
  }
}
```

`reporting.stream` is one of `odh-nightly`, `rhoai-nightly`, or `release`.
For a RHOAI stream, send the canonical release version, such as `3.6`, rather
than the `rhoai-nightly` matrix label. An ODH nightly run can set
`release.version` to `null`; it remains separate from version-filtered RHOAI
health. The publisher can omit `trigger`, `stages`, and `tests` when unavailable.
If a build fails before tests run, send its Jenkins result and omit `tests` or
send `tests.collectionState: "unavailable"` with null counts. Never replace
missing counts with zero.

The response contains `status` (`created` or `updated`), `runKey`, and the
normalized version. Invalid data returns `400`; missing or invalid API token
returns `401`; a token without `releases:e2e:write` returns `403`.

## Publish agent analysis

`POST /api/modules/releases/build-health/runs/analysis`

```json
{
  "schemaVersion": 1,
  "jenkins": {
    "instance": "jenkins.example.com",
    "job": "components/dashboard/dashboard-e2e-tests",
    "buildNumber": 3424
  },
  "analysis": {
    "producedAt": "2026-10-05T11:20:00.000Z",
    "summary": "The model serving API failed during deployment.",
    "url": "https://jenkins.example.com/job/analysis/88/",
    "findings": [
      {
        "id": "serving-deployment",
        "category": "product-defect",
        "suggestedTeam": "Model Serving",
        "jiraIssue": "RHOAI-1234",
        "explanation": "Three failed cases share the same API error.",
        "failedCases": [
          { "suite": "model-serving", "name": "deploys a model" }
        ]
      }
    ]
  }
}
```

Analysis is stored with `source: "agent"` and
`reviewStatus: "unverified"`. A suggested team or Jira issue is not a
confirmed assignment. A later human triage workflow can record verified
conclusions separately. The analysis endpoint returns `404` if the base run
has not arrived yet; retry after publishing the run. A retry of the base run
preserves its agent analysis.

The full request schemas and responses are available in the Org Pulse OpenAPI
documentation at `/api/docs`.
