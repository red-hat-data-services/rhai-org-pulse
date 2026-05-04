# Jira Automation Rule Setup for Activity Type Classification

This document describes how to set up a Jira automation rule that triggers real-time Activity Type classification when issues are created or updated in the AIPCC project.

## Overview

The classification webhook integrates with Org Pulse's classification endpoint to auto-populate the Activity Type field (customfield_10464) based on issue type, summary, and description.

**Endpoint:** `POST https://<org-pulse-url>/api/modules/allocation-tracker/classify`

**Payload:**
```json
{
  "issueKey": "AIPCC-12345",
  "dryRun": false
}
```

## Prerequisites

1. **Org Pulse deployed** and accessible at production URL
2. **Admin access** to Jira (redhat.atlassian.net)
3. **Activity Type field** exists (customfield_10464)

## Automation Rule Configuration

### Step 1: Create New Automation Rule

1. Navigate to Jira Settings → System → Automation
2. Click **Create rule**
3. Name: `Auto-Classify Activity Type (AIPCC)`
4. Description: `Automatically classify issues into 40/40/20 allocation buckets using Org Pulse classification service`

### Step 2: Configure Trigger

**Trigger Type:** Issue created OR Issue updated

**Filter Configuration:**
- **Project:** AIPCC
- **Issue Types:** Story, Bug, Spike, Task, Epic
- **Conditions:** 
  - Field value changed (Activity Type) OR Issue created
  - Activity Type is EMPTY

**JQL Filter (Advanced):**
```jql
project = AIPCC AND 
type in (Story, Bug, Spike, Task, Epic) AND 
"Activity Type" is EMPTY
```

### Step 3: Add Condition (Optional)

To avoid classifying issues that already have Activity Type set:

1. Add **Condition: Field Value**
2. Field: Activity Type
3. Condition: is empty

### Step 4: Configure Action - Send Web Request

**Action Type:** Send web request

**Configuration:**
- **Web request URL:** `https://<org-pulse-production-url>/api/modules/allocation-tracker/classify`
  - **Example:** `https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/modules/allocation-tracker/classify`
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
2. Test by creating a new AIPCC issue with keywords like "fix", "test", "spike"
3. Verify Activity Type field is populated within 5-10 seconds

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

## Monitoring

### View Classification Activity

1. Navigate to Org Pulse → Allocation Tracker → Settings
2. Click **Classification** tab
3. Test individual issues using dry-run mode

### Check Automation Rule Execution

1. Jira → Settings → System → Automation
2. Find rule "Auto-Classify Activity Type (AIPCC)"
3. View **Audit log** for execution history

## Troubleshooting

### Issue Not Classified

**Check:**
1. Activity Type field is empty (rule skips classified issues)
2. Issue type is Story, Bug, Spike, Task, or Epic
3. Project is AIPCC
4. Org Pulse endpoint is reachable from Jira
5. Check automation rule audit log for errors

**Manual Classification:**
1. Navigate to Org Pulse → Allocation Tracker → Settings → Classification
2. Enter issue key (e.g., AIPCC-12345)
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

## Expanding to Other Projects

To enable classification for RHOIENG, INFERENG, RHAIENG:

1. **Update backend configuration:**
   - Edit `modules/allocation-tracker/server/classification/index.js`
   - Add projects to `CONFIG.projects` array
   - Redeploy Org Pulse

2. **Clone automation rule:**
   - Duplicate existing rule
   - Change project filter from AIPCC to target project
   - Update rule name

3. **Test on small batch:**
   - Run on 10-20 issues first
   - Verify classification accuracy
   - Monitor manual override rate

## Rollback

To disable auto-classification:

1. Jira → Settings → System → Automation
2. Find rule "Auto-Classify Activity Type (AIPCC)"
3. Click **Turn it off**

Manual classification via Org Pulse UI remains available.

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
