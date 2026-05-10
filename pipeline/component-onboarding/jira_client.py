"""Jira REST API client for the component onboarding pipeline."""

import base64
import time
import requests


class JiraClient:
    def __init__(self, base_url: str, email: str, token: str):
        self.base_url = base_url.rstrip("/")
        credentials = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: dict = None, max_retries: int = 3) -> dict:
        url = f"{self.base_url}{path}"
        for attempt in range(max_retries):
            response = requests.get(url, headers=self.headers, params=params, timeout=30)
            if response.status_code == 429:
                wait = int(response.headers.get("Retry-After", 2 ** attempt))
                print(f"  Rate limited — waiting {wait}s before retry {attempt + 1}/{max_retries}")
                time.sleep(wait)
                continue
            response.raise_for_status()
            return response.json()
        raise RuntimeError(f"Failed after {max_retries} retries: GET {path}")

    def search_jql(self, jql: str, fields: list[str], expand: list[str] = None) -> list[dict]:
        """Fetch all issues matching JQL using cursor-based pagination."""
        all_issues = []
        params = {
            "jql": jql,
            "fields": ",".join(fields),
            "maxResults": 100,
        }
        if expand:
            params["expand"] = ",".join(expand)

        while True:
            data = self._get("/rest/api/3/search/jql", params=params)
            issues = data.get("issues", [])
            all_issues.extend(issues)

            next_page_token = data.get("nextPageToken")
            if not next_page_token or data.get("isLast", True):
                break
            params["nextPageToken"] = next_page_token

        return all_issues

    def get_attachment_content(self, issue_key: str, filename: str) -> str | None:
        """Download a named attachment from a Jira issue. Returns text content or None."""
        data = self._get(f"/rest/api/3/issue/{issue_key}", params={"fields": "attachment"})
        attachments = data.get("fields", {}).get("attachment", [])

        for attachment in attachments:
            if attachment.get("filename") == filename:
                content_url = attachment.get("content")
                if not content_url:
                    return None
                response = requests.get(content_url, headers=self.headers, timeout=30)
                response.raise_for_status()
                return response.text

        return None

    def get_linked_feature_keys(self, issue: dict, link_type: str = "Cloners", target_project: str = "RHAISTRAT") -> list[str]:
        """Extract linked issue keys of a given link type from an already-fetched issue dict."""
        links = issue.get("fields", {}).get("issuelinks", [])
        keys = []
        for link in links:
            lt = link.get("type", {}).get("name", "")
            if lt != link_type:
                continue
            for direction in ("inwardIssue", "outwardIssue"):
                linked = link.get(direction, {})
                key = linked.get("key", "")
                if key.startswith(target_project + "-"):
                    keys.append(key)
        return keys
