"""Fetch component onboarding issues from Jira and push to org-pulse API."""

import json
import os
import sys
import time
from datetime import datetime, timezone

import yaml
import requests

from jira_client import JiraClient

JIRA_BASE_URL = "https://redhat.atlassian.net"
JQL = (
    'project = RHOAIENG AND labels = "component-onboarding" AND ('
    'issueFunction in linkedIssuesOf("key = RHOAIENG-17225", "is cloned by") OR '
    'issueFunction in linkedIssuesOf("key = RHOAIENG-35683", "is cloned by")'
    ") ORDER BY created DESC"
)
JIRA_FIELDS = [
    "summary", "status", "labels", "issuelinks",
    "created", "resolutiondate", "attachment",
]
ATTACHMENT_FILENAME = "componentonboardingdetails.yaml"
CHUNK_SIZE = 500

LABEL_TO_STEP = {
    "component-onboarding":        "yamlValidated",
    "quay-mr-raised":              "quayRepoCreated",
    "konflux-mr-raised":           "konfluxOnboarded",
    "push-pipeline-mr-raised":     "pushPipelineConfigured",
    "operator-integration-mr-raised": "operatorIntegrated",
    "bundle-config-mr-raised":     "bundleConfigured",
    "delivery-repo-mr-raised":     "deliveryRepoProvisioned",
    "product-listing-mr-raised":   "productListingUpdated",
    "renovate-setup-mr-raised":    "renovateSetup",
}
RESOLVED_STATUSES = {"Resolved", "Closed", "Done"}


def env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        print(f"ERROR: Required environment variable {name!r} is not set.", file=sys.stderr)
        sys.exit(1)
    return val


def build_component(issue: dict, yaml_data: dict, linked_features: list[str], synced_at: str) -> dict:
    fields = issue.get("fields", {})
    status_name = fields.get("status", {}).get("name", "")
    labels = [lbl for lbl in (fields.get("labels") or []) if isinstance(lbl, str)]

    onboarding_steps = {step: False for step in LABEL_TO_STEP.values()}
    for label in labels:
        step = LABEL_TO_STEP.get(label)
        if step:
            onboarding_steps[step] = True

    created_raw = fields.get("created")
    resolved_raw = fields.get("resolutiondate")

    component = {
        "key": issue["key"],
        "summary": fields.get("summary", ""),
        "status": status_name,
        "completionStatus": "completed" if status_name in RESOLVED_STATUSES else "in-progress",
        "productContext": yaml_data.get("productContext", _guess_product_context(labels)),
        "syncedAt": synced_at,
        "labels": labels,
        "onboardingSteps": onboarding_steps,
        "linkedFeatures": linked_features,
    }

    if created_raw:
        component["created"] = created_raw
    if resolved_raw:
        component["resolved"] = resolved_raw

    for field in ("componentName", "repoUrl", "branch", "dockerfilePath"):
        val = yaml_data.get(field)
        if val is not None:
            component[field] = val

    if "isOperator" in yaml_data:
        component["isOperator"] = bool(yaml_data["isOperator"])

    return component


def _guess_product_context(labels: list[str]) -> str:
    lower = [l.lower() for l in labels]
    if any("odh" in l for l in lower):
        return "ODH"
    return "RHOAI"


def push_to_api(backend_url: str, token: str, components: list[dict]) -> dict:
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    base = backend_url.rstrip("/")
    totals = {"created": 0, "updated": 0, "unchanged": 0, "errors": 0}

    for i in range(0, len(components), CHUNK_SIZE):
        chunk = components[i : i + CHUNK_SIZE]
        resp = requests.post(
            f"{base}/api/modules/ai-impact/component-onboarding/bulk",
            headers=headers,
            json={"components": chunk},
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        for key in totals:
            totals[key] += result.get(key, 0)
        print(f"  Chunk {i // CHUNK_SIZE + 1}: {result}")

    return totals


def clear_existing(backend_url: str, token: str) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.delete(
        f"{backend_url.rstrip('/')}/api/modules/ai-impact/component-onboarding",
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    print(f"  Cleared existing data: {resp.status_code}")


def main() -> None:
    jira_email = env("JIRA_EMAIL")
    jira_token = env("JIRA_TOKEN")
    backend_url = env("ORG_PULSE_BACKEND_URL")
    api_token = env("ORG_PULSE_API_TOKEN")

    synced_at = datetime.now(timezone.utc).isoformat()

    print("=== Component Onboarding Sync ===")
    print(f"Synced at: {synced_at}")

    jira = JiraClient(JIRA_BASE_URL, jira_email, jira_token)

    print("\n[1/4] Fetching issues from Jira…")
    issues = jira.search_jql(JQL, JIRA_FIELDS, expand=["issuelinks"])
    print(f"  Found {len(issues)} issues")

    print("\n[2/4] Processing issues…")
    components = []
    for idx, issue in enumerate(issues, 1):
        key = issue["key"]
        print(f"  [{idx}/{len(issues)}] {key}", end="", flush=True)

        yaml_content = jira.get_attachment_content(key, ATTACHMENT_FILENAME)
        if yaml_content:
            try:
                yaml_data = yaml.safe_load(yaml_content) or {}
            except yaml.YAMLError as exc:
                print(f" — YAML parse error: {exc}", end="")
                yaml_data = {}
        else:
            yaml_data = {}

        linked_features = jira.get_linked_feature_keys(issue)

        component = build_component(issue, yaml_data, linked_features, synced_at)
        components.append(component)
        print(f" — {component['completionStatus']} ({component['productContext']})")

    print(f"\n  Built {len(components)} component records")

    print("\n[3/4] Clearing existing data…")
    clear_existing(backend_url, api_token)

    print("\n[4/4] Pushing to API…")
    totals = push_to_api(backend_url, api_token, components)

    print("\n=== Summary ===")
    print(f"  Total processed : {len(components)}")
    print(f"  Created         : {totals['created']}")
    print(f"  Updated         : {totals['updated']}")
    print(f"  Unchanged       : {totals['unchanged']}")
    print(f"  Errors          : {totals['errors']}")

    if totals["errors"]:
        print("\nERROR: Some records failed to upsert.", file=sys.stderr)
        sys.exit(1)

    print("\nDone.")


if __name__ == "__main__":
    main()
