# Jira Automation Rule Setup for Activity Type Classification

This document describes how to set up a Jira automation rule that triggers real-time Activity Type classification when issues are created or updated.

## Overview

The classification webhook integrates with Org Pulse's classification endpoint to auto-populate the Activity Type field (customfield_10464) based on issue type, summary, and description.

**Endpoint:** `POST https://<org-pulse-url>/api/modules/allocation-tracker/classify`

**Payload:**
```json
{
  "issueKey": "PROJECT-12345",
  "dryRun": false
}
```

## Prerequisites

1. **Org Pulse deployed** and accessible at production URL
2. **Admin access** to Jira (redhat.atlassian.net)
3. **Activity Type field** exists (customfield_10464)
4. **Verified project keys** - confirm the Jira projects you want to classify actually exist

## Important: Verify Your Project Keys First

Before configuring automation, verify your Jira project keys are correct:

1. Go to Jira → Settings → Projects
2. Find your target projects and note their **exact project keys**
3. Common mistakes:
   - `RHOAIENG` ❌ (doesn't exist) vs `RHOAIEDGE` ✅ (exists)
   - `INFERENG` ❌ (doesn't exist) vs actual inference project key
   - `RHAIENG` ❌ (doesn't exist) vs `RHELAI` ✅ (exists)

**Test your project keys:**
```bash
# Verify project exists
curl -s -u "${JIRA_EMAIL}:${JIRA_TOKEN}" \
  "https://redhat.atlassian.net/rest/api/3/project/YOUR-PROJECT-KEY" | \
  jq '.key, .name'
```

If this returns `null`, your project key is wrong.

## Step 0: Configure Org Pulse (REQUIRED FIRST)

**Before creating the Jira automation rule**, you must configure Org Pulse to recognize your project(s).

1. Navigate to **Org Pulse → Settings → Allocation Tracker → Classification tab**
2. In the **"Jira Projects"** field, enter your project keys (comma-separated):
   ```
   AIPCC, RHELAI, RHOAIEDGE
   ```
3. Verify other settings:
   - **Issue Types:** Story, Bug, Spike, Task, Epic, Vulnerability, Weakness
   - **Confidence Threshold:** 0.85 (85%)
   - **Enabled:** ✅
4. Click **"Save Configuration"**
5. **Test it works:**
   - Enter a real issue key from one of your projects
   - Click **"Test (Dry Run)"**
   - Verify you get a classification result (not "skipped: project not configured")

⚠️ **If you skip this step**, the Jira automation will trigger but classification will silently fail because the backend isn't configured for those projects.

## Automation Rule Configuration

### Step 1: Create New Automation Rule

1. Navigate to Jira Settings → System → Automation
2. Click **Create rule**
3. **Name:** Choose based on scope:
   - Single project: `Auto-Classify Activity Type (RHELAI)`
   - Multiple projects: `Auto-Classify Activity Type (Multi-Project)`
   - All configured: `Auto-Classify Activity Type (AIPCC, RHELAI, RHOAIEDGE)`
4. **Description:** `Automatically classify issues into 40/40/20 allocation buckets using Org Pulse classification service`

### Step 2: Configure Trigger

**Trigger Type:** Issue created OR Issue updated

**Filter Configuration:**
- **Project(s):** Select your target project(s)
- **Issue Types:** Story, Bug, Spike, Task, Epic
- **Conditions:** 
  - Field value changed (Activity Type) OR Issue created
  - Activity Type is EMPTY

**JQL Filter (Advanced):**

**For a single project:**
```jql
project = RHELAI AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

**For multiple projects:**
```jql
project in (AIPCC, RHELAI, RHOAIEDGE) AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

⚠️ **CRITICAL:** The project keys in this JQL filter must:
1. Actually exist in Jira (verify with Step 0)
2. Match the project keys configured in Org Pulse Settings (Step 0)

### Step 3: Add Condition (Optional)

To avoid classifying issues that already have Activity Type set:

1. Add **Condition: Field Value**
2. Field: Activity Type
3. Condition: is empty

### Step 4: Configure Action - Send Web Request

**Action Type:** Send web request

**Configuration:**
- **Web request URL:** `https://<org-pulse-production-url>/api/modules/allocation-tracker/classify`
  - **Production:** `https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/modules/allocation-tracker/classify`
- **HTTP method:** POST
- **HTTP headers:**
  - `Content-Type: application/json`
  - **Optional:** `Authorization: Bearer <api-token>` (if auth enabled)
- **Webhook body:** Custom data
  
**Request Body (JSON):**
```json
{
  "issueKey": "{{issue.key}}",
  "dryRun": false
}
```

**Advanced Settings:**
- **Timeout:** 10 seconds
- **Retry on error:** No (classification can be manually triggered if needed)

### Step 5: Add Logging (Optional)

To track classification activity:

1. Add **Action: Create a new issue comment**
2. Comment body:
   ```
   🤖 Auto-classified via Org Pulse
   ```
3. **Restrict visibility:** Internal only

### Step 6: Enable and Test

1. Click **Turn it on**
2. Test by creating a new issue in one of your configured projects with keywords like "fix", "test", "spike"
3. Verify Activity Type field is populated within 5-10 seconds
4. Check the issue matches your configured projects and issue types

## Multi-Project Configuration Strategies

### Option 1: Single Automation Rule (Recommended)

Use **one** automation rule for all projects:

**Pros:**
- Single rule to manage
- Consistent behavior across all projects
- Easier to update configuration

**Cons:**
- All projects share same webhook timeout/retry settings
- Harder to disable for just one project

**JQL Example:**
```jql
project in (AIPCC, RHELAI, RHOAIEDGE) AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

### Option 2: Separate Rules Per Project

Create **separate** automation rules for each project:

**Pros:**
- Per-project customization (different timeouts, logging, etc.)
- Can disable one project without affecting others
- Easier troubleshooting

**Cons:**
- More rules to maintain
- Risk of configuration drift between rules

**When to use:**
- Different projects need different webhook settings
- You want to pilot on one project before rolling out
- Projects have different stakeholders/requirements

## Expected Behavior

### High-Confidence Classifications (≥0.85)
- Activity Type field is automatically set
- Issue types Bug/Vulnerability → "Tech Debt & Quality"
- Keywords "fix", "test", "refactor" → "Tech Debt & Quality"
- Keywords "spike", "POC", "research" → "Learning & Enablement"
- Keywords "RFE", "enhancement" → "New Features"

### Low-Confidence Classifications (<0.85)
- Activity Type field remains empty
- Issue logged for manual review
- Can be classified manually via Org Pulse UI

### Already Classified
- Webhook skips issues with existing Activity Type
- Manual entries are never overwritten

### Project Not Configured
- If project is in Jira automation JQL but NOT in Org Pulse settings
- Webhook runs but classification returns `{skipped: true, reason: "project not configured"}`
- **Fix:** Add project to Org Pulse Settings → Classification tab

## Monitoring

### View Classification Activity

1. Navigate to Org Pulse → Allocation Tracker → Settings
2. Click **Classification** tab
3. Test individual issues using dry-run mode

### Check Automation Rule Execution

1. Jira → Settings → System → Automation
2. Find your auto-classification rule
3. View **Audit log** for execution history

## Troubleshooting

### Issue Not Classified

**Check:**
1. Activity Type field is empty (rule skips classified issues)
2. Issue type is Story, Bug, Spike, Task, or Epic
3. Project key is in your automation JQL filter
4. Project key is in Org Pulse Settings → Classification → "Jira Projects"
5. Org Pulse endpoint is reachable from Jira
6. Check automation rule audit log for errors

**Verify project configuration:**
```bash
# Test classification endpoint directly
curl -X POST https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/modules/allocation-tracker/classify \
  -H "Content-Type: application/json" \
  -d '{"issueKey": "YOUR-PROJECT-123", "dryRun": true}'

# Expected: {"classified": true, ...}
# Bad: {"skipped": true, "reason": "project not configured"}
```

**Manual Classification:**
1. Navigate to Org Pulse → Allocation Tracker → Settings → Classification
2. Enter issue key (e.g., RHELAI-12345)
3. Click "Test (Dry Run)" to preview
4. Click "Classify & Write" to apply

### Low Classification Rate

If >20% of issues remain unclassified:

1. Review low-confidence issues in audit log
2. Check if keywords need adjustment
3. Consider lowering confidence threshold (contact admin)

### Webhook Errors

**Common Issues:**
- **401 Unauthorized:** API token missing or expired (add Authorization header)
- **404 Not Found:** Wrong endpoint URL
- **500 Internal Server Error:** Org Pulse backend issue (check logs)
- **Timeout:** Classification took >10 seconds (increase timeout)

### "Project Not Configured" Error

**Symptoms:**
- Jira automation runs (shows in audit log)
- But Activity Type field stays empty
- Webhook returns `{skipped: true, reason: "project not configured"}`

**Fix:**
1. Go to Org Pulse → Settings → Allocation Tracker → Classification
2. Verify your project key is in the "Jira Projects" field
3. If missing, add it (comma-separated)
4. Click "Save Configuration"
5. Re-test a sample issue

### Wrong Project Keys

**Symptoms:**
- No issues are being classified
- Jira automation audit log shows no executions

**Fix:**
1. Verify project keys exist in Jira:
   ```bash
   curl -s -u "${JIRA_EMAIL}:${JIRA_TOKEN}" \
     "https://redhat.atlassian.net/rest/api/3/project/YOUR-KEY"
   ```
2. Update JQL filter in automation rule with correct keys
3. Update Org Pulse Settings with same keys

## Adding More Projects Later

To enable classification for additional Jira projects:

1. **Update Org Pulse configuration:**
   - Go to Settings → Allocation Tracker → Classification tab
   - Add the project key to the "Jira Projects" field (comma-separated)
   - Click "Save Configuration"

2. **Update Jira automation rule:**
   - **Option A (Recommended):** Edit existing rule's JQL filter to add new project
     ```jql
     project in (AIPCC, RHELAI, RHOAIEDGE, NEW-PROJECT) AND ...
     ```
   - **Option B:** Create a separate automation rule for the new project

3. **Test on small batch:**
   - Run on 10-20 issues first
   - Verify classification accuracy
   - Monitor manual override rate

## Rollback

To disable auto-classification:

**Disable for all projects:**
1. Jira → Settings → System → Automation
2. Find your auto-classification rule
3. Click **Turn it off**

**Disable for specific projects:**
1. Edit automation rule's JQL filter
2. Remove project from `project in (...)` list
3. Save rule

Manual classification via Org Pulse UI remains available.

## Configuration Examples

### Example 1: Single Project (Red Hat Enterprise Linux AI)

**Org Pulse Settings:**
```
Jira Projects: RHELAI
Issue Types: Story, Bug, Task, Epic
Confidence Threshold: 0.85
Enabled: ✅
```

**Jira Automation JQL:**
```jql
project = RHELAI AND 
type in (Story, Bug, Task, Epic) AND 
"Activity Type" is EMPTY
```

**Rule Name:** `Auto-Classify Activity Type (RHELAI)`

### Example 2: Multiple Projects (AI Platform)

**Org Pulse Settings:**
```
Jira Projects: AIPCC, RHELAI, RHOAIEDGE
Issue Types: Story, Bug, Spike, Task, Epic
Confidence Threshold: 0.85
Enabled: ✅
```

**Jira Automation JQL:**
```jql
project in (AIPCC, RHELAI, RHOAIEDGE) AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

**Rule Name:** `Auto-Classify Activity Type (AI Platform)`

## Future Enhancements

### Phase 2: AI Fallback (Not Yet Implemented)

For low-confidence cases (<0.85), send to Claude API:
- Requires `ANTHROPIC_API_KEY` env var
- Costs ~$0.01 per classification
- Improves coverage from 80% → 95%+

### Phase 3: Learning System (Not Yet Implemented)

Track manual overrides to improve classification:
- Store corrections in `data/allocation-tracker/classification-learning.json`
- Feed corrections back into keyword patterns
- Monitor override rate trends

## Support

- **Jira Ticket:** [AIPCC-15448](https://redhat.atlassian.net/browse/AIPCC-15448)
- **Feature Request:** [AIPCC-15139](https://redhat.atlassian.net/browse/AIPCC-15139)
- **Code Location:** `modules/allocation-tracker/server/classification/`
- **API Endpoint:** POST `/api/modules/allocation-tracker/classify`
