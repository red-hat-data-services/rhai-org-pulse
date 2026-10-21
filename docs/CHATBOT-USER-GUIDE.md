# Org Pulse AI Assistant — User Guide

> **Always review AI-generated output prior to use.** The assistant can make mistakes.
> Do not act on its responses without verifying the underlying data where decisions matter.

---

## Overview

The Org Pulse AI Assistant is a natural language chatbot embedded in the Org Pulse engineering dashboard. It lets you query your organization's roster, Jira delivery metrics, and GitHub/GitLab contribution data using plain English — without needing to navigate multiple dashboards or write JQL.

### What you can ask

- "Who is on the Platform team?"
- "How many story points did the Model Serving team close this quarter?"
- "Who are the top GitHub contributors this month?"
- "What is Jane Smith's average cycle time?"
- "How many engineers have the title Senior Software Engineer?"

### Quickstart

1. Open the Org Pulse dashboard and click the **AI Assistant** icon in the sidebar.
2. Type your question in the chat input and press **Enter** or click **Send**.
3. The assistant will look up live data and respond, showing which tools it called.
4. You can ask follow-up questions — the assistant retains limited context across the current session.

No configuration is required for end users. Access is granted automatically through your Red Hat SSO login.

---

## Agent's Persona and Purpose

The assistant acts as a read-only analyst for your engineering organization's data. Its sole purpose is to answer questions about the data surfaced in Org Pulse: team roster, Jira delivery metrics, and GitHub/GitLab contributions.

It is **not** a general-purpose assistant. It will politely decline questions unrelated to organizational data (e.g., coding help, general knowledge, personal advice).

---

## Capabilities and Inventory

### Data Sources

| Source | Data Available |
|--------|---------------|
| Org Roster (LDAP / IPA) | Names, emails, job titles, managers, team membership, GitHub/GitLab usernames |
| Jira | Resolved issue counts, story points, in-progress issues, cycle time (365-day lookback) |
| GitHub | Total contributions and monthly breakdown per user |
| GitLab | Total contributions and monthly breakdown per user (multi-instance supported) |

### Tools

The assistant has access to the following read-only tools:

| Tool | Purpose |
|------|---------|
| `search_people` | Find people by name, team, or title (up to 20 results) |
| `get_person_details` | Full profile for a specific person (name, email, title, manager, GitHub/GitLab handles) |
| `count_people` | Headcount totals, optionally filtered by team or title |
| `list_teams` | All teams with member counts |
| `get_team_details` | Team members and full roster for a specific team |
| `get_person_metrics` | Individual Jira metrics: resolved issues, story points, cycle time |
| `get_team_metrics` | Aggregated Jira metrics across a team or the full organization |
| `get_github_contributions` | GitHub contribution totals and monthly trends |
| `get_gitlab_contributions` | GitLab contribution totals and monthly trends |

### Authorized Actions

- Querying and displaying organizational data in natural language
- Combining results across multiple tools to answer complex questions (e.g., team metrics + GitHub activity)

### Prohibited Actions

- **No write access**: The assistant cannot create, update, or delete anything in Jira, the roster, GitHub, or GitLab
- **No actions on your behalf**: It cannot file tickets, send messages, or trigger workflows
- **No data outside Org Pulse**: It cannot access external systems, browse the web, or retrieve information not present in the connected data sources
- **No unapproved personal or customer data**: Do not enter personal information or customer data into the chat (see [Data Handling](#data-handling))

---

## Limitations

- **Jira lookback is fixed at 365 days.** Metrics older than one year are not available.
- **Search results are capped at 20 people.** For large result sets, refine your query (e.g., filter by team or title).
- **Data is not real-time.** Jira metrics and contribution data are refreshed on a scheduled basis; very recent activity may not yet be reflected.
- **Short conversation memory.** The assistant retains only the last 3 messages and approximately 2,000 tokens of context. In long sessions, refer back to key facts explicitly.
- **Name matching is fuzzy.** If a person is not found, try a partial name, nickname, or UID. The assistant will suggest alternatives.
- **Metrics reflect assigned data only.** Jira metrics are based on ticket assignments; untracked or informally tracked work is not included.
- **The assistant can make mistakes.** It is designed to avoid hallucinating names or values (it always calls a tool rather than guessing), but errors in the underlying data or model reasoning can occur. Always verify responses against the dashboard for important decisions.

---

## Best Practices

### Effective interaction examples

| Instead of… | Try… |
|-------------|------|
| "Tell me about John" | "Who is John Smith?" or "Find people named John on the Platform team" |
| "How is our team doing?" | "What are the Jira metrics for the Model Serving team?" |
| "Top contributors" | "Who are the top GitHub contributors this month?" |
| "Compare Alice and Bob" | "Compare Jira metrics for Alice Johnson and Bob Martinez" |

### Common edge cases

- **Person not found**: The assistant will retry with a broader search. If it still fails, check the roster directly — the person may be inactive or listed under a different name.
- **Team name ambiguity**: If multiple teams partially match, the assistant will return all matches. Provide the full team name to narrow results.
- **No Jira metrics for a person**: Not all roster members have Jira accounts or assigned issues. The assistant will say so rather than returning zeros.
- **GitLab multi-instance**: If your organization uses multiple GitLab instances, contribution totals are aggregated across all instances by default.

---

## Human-in-the-Loop (HITL) and Accountability Workflow

> **Always review AI-generated output or actions prior to use.**

The Org Pulse AI Assistant is **advisory only**. It surfaces data to support human judgment — it does not make decisions, trigger actions, or modify any system.

Recommended review steps:

1. **Cross-check against the dashboard.** For any metric used in a decision (performance review, planning, reporting), verify the value directly in the Org Pulse dashboard or the source system (Jira, GitHub, GitLab).
2. **Do not rely solely on the assistant for personnel decisions.** Individual metrics (cycle time, story points) are directional signals, not definitive performance measures.
3. **If a response seems wrong, say so.** Ask the assistant to re-run the lookup or clarify its source. You can also check the tool call log shown in the chat to see exactly which data was fetched.

No override or justification workflow is required since the assistant takes no autonomous actions.

---

## Rollback and Emergency Stop (Kill Switch)

Because the assistant is read-only, **no rollback is needed** — it cannot modify data, so there is nothing to undo.

### Terminating an active session

Close the chat panel or navigate away from the page. The session is stateless server-side; no persistent session exists to terminate.

### Disabling the assistant (administrators only)

To immediately disable the assistant for all users:

1. Remove or rotate the `CHATBOT_LLM_BASE_URL` or `CHATBOT_LLM_API_KEY` secret in the OpenShift deployment.
2. Alternatively, scale the `chatbot` deployment to zero replicas:
   ```bash
   oc scale deployment chatbot --replicas=0 -n <namespace>
   ```
3. The Express proxy will return a "Chatbot service not configured" or "Chatbot service unavailable" message to all users.

Contact **Alex Corvin (acorvin@redhat.com)** if an emergency disable is needed outside of your admin access.

---

## Data Handling

**Do not enter any of the following into the chat:**

- Customer names, emails, or account information
- Non-public personal information beyond what is already in the Org Pulse roster
- Credentials, API tokens, or secrets
- Confidential business data not present in the connected data sources

The assistant has access only to data already stored in Org Pulse (roster, Jira metrics, GitHub/GitLab contributions). It does not retain conversation history between sessions and does not send data to external services — all model inference runs on internal Red Hat infrastructure.

---

## RBAC Enforcement

The assistant inherits your existing Org Pulse permissions:

- **Authentication**: Access requires a valid Red Hat SSO login (OpenShift OAuth proxy). Unauthenticated requests are rejected with HTTP 401.
- **Authorization**: The assistant calls the Org Pulse API using your authenticated session. It can only access data your account is permitted to see.
- **No privilege escalation**: The assistant cannot access data beyond what you can view directly in the Org Pulse dashboard.

To verify your current access level, log into the Org Pulse dashboard and check your role in **Settings → Access**. If you believe your access is incorrect, contact your manager or an Org Pulse administrator.

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---------|-------------|------------|
| "The AI assistant is not available" | LLM credentials not configured | Contact an administrator |
| "I can only help with questions about Org Pulse data" | Query was off-topic or ambiguous | Rephrase to mention people, teams, Jira, or contributions |
| Person not found despite correct name | Name mismatch in roster or person is inactive | Try partial name, UID, or search by team |
| No Jira metrics returned | Person has no Jira data in the 365-day window | Verify in the Team Tracker dashboard |
| Response is slow or times out | LLM inference latency or service load | Wait and retry; if persistent, contact the team |
| Chat panel doesn't load | Chatbot service is unreachable | Check `/api/modules/chatbot/health`; contact administrator |

---

## Feedback

To report unexpected behavior, incorrect responses, or feature requests, post in the internal Slack channel:

**[#forum-rhai-org-pulse](https://redhat.enterprise.slack.com/archives/C0ALEQK1TD0)**

Please include: what you asked, what the assistant responded, and what you expected. Screenshots of the chat (including the tool call trace) are helpful.

---

## Point of Contact

For questions, access issues, or concerns not covered in this guide:

**Alex Corvin** — acorvin@redhat.com
