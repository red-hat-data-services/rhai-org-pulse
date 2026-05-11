# Classification Logic - Dual Implementation

The Activity Type classification logic exists in **two places**:

## 1. This Repository (Org Pulse - JavaScript)

**Location:** `modules/allocation-tracker/server/classification/classifier.js`

**Purpose:** Single-issue testing and debugging via Settings UI

**Used by:**
- Settings > Allocation Tracker > Classification > "Test Classification" card
- Manual testing of classification rules
- Debugging classification decisions

## 2. GitLab Repository (Python)

**Location:** `gitlab.com/redhat/rhel-ai/agentic-ci/jira-issue-classifier`

**Purpose:** Production bulk classification via CI pipelines

**Used by:**
- Settings > Allocation Tracker > Classification > "Bulk Classification" card
- Automated classification pipelines
- Backfilling historical issues

## Why Two Implementations?

Following Alex's architectural pattern:
- **Org Pulse = Visualization layer** (not in critical automation path)
- **GitLab CI = Processing layer** (handles bulk operations)

The JS implementation in Org Pulse provides fast feedback for testing rules without triggering GitLab pipelines.

## Keeping Them in Sync

⚠️ **When updating classification rules, update BOTH implementations:**

### Classification Rules Live In

| Component | Org Pulse (JS) | GitLab (Python) |
|-----------|----------------|-----------------|
| Keywords | `classifier.js` lines 15-35 | `classifier.py` lines 20-45 |
| Issue Types | `classifier.js` lines 36-40 | `classifier.py` lines 46-50 |
| Confidence | `classifier.js` line 42 | `classifier.py` line 52 |

### Sync Checklist

When changing classification logic:

1. **Update in Org Pulse:**
   ```javascript
   // modules/allocation-tracker/server/classification/classifier.js
   const CATEGORIES = {
     'Tech Debt & Quality': {
       keywords: ['bug', 'fix', 'NEW_KEYWORD', ...],
       // ...
     }
   };
   ```

2. **Update in GitLab:**
   ```python
   # classifier.py
   CATEGORIES = {
       'Tech Debt & Quality': {
           'keywords': ['bug', 'fix', 'NEW_KEYWORD', ...],
           # ...
       }
   }
   ```

3. **Test both:**
   - Org Pulse: Settings UI → Test Classification
   - GitLab: Trigger test pipeline with same issue

4. **Verify same results:**
   - Same category classification
   - Similar confidence scores

### What Needs Syncing

✏️ **Sync these changes:**
- Adding/removing keywords
- Changing confidence thresholds (also update in Settings UI config)
- Adding/removing issue type mappings
- Changing category fallback logic

✅ **Don't need to sync:**
- Jira API client improvements (different implementations)
- UI changes (Org Pulse only)
- Pipeline configuration (GitLab only)
- Error handling (implementation-specific)

## Testing

### Test in Org Pulse
1. Go to Settings > Allocation Tracker > Classification
2. Enter issue key (e.g., `AIPCC-15430`)
3. Click "Test (Dry Run)"
4. Note the category and confidence

### Test in GitLab
1. Trigger manual pipeline or use Settings > Bulk Classification
2. Enter JQL: `key = AIPCC-15430`
3. Set limit: 1, dry run: true
4. Click "Preview (Dry Run)" → View pipeline
5. Check pipeline logs for category and confidence

### Both should produce the same classification

## Current Classification Rules

See `classifier.js` or `classifier.py` for the authoritative list, but as of the last sync:

**Tech Debt & Quality:**
- Keywords: bug, fix, refactor, test, technical debt, security, CVE, regression, QE
- Issue Types: Bug, Vulnerability, Weakness
- Confidence: 0.85+

**New Features:**
- Keywords: RFE, feature, enhancement, new, implement, capability
- Confidence: 0.85+

**Learning & Enablement:**
- Keywords: spike, research, POC, training, documentation, enablement
- Issue Types: Spike
- Confidence: 0.85+

**Fallback:**
- Default to "New Features" with 0.60 confidence if no strong matches

## See Also

- `JIRA-AUTOMATION-SETUP.md` - How Jira automation will trigger classification
- GitLab repo: `SYNC-WITH-ORG-PULSE.md` - Sync guide from GitLab perspective
- GitLab repo: `DEPLOYMENT-GUIDE.md` - How to deploy the GitLab pipeline
