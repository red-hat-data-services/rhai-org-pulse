const { fetchAllJqlResults } = require('../../../../shared/server/jira');

/**
 * Extract linked feature key from an RFE's issuelinks.
 * Returns the first matching link key (outward preferred), or null.
 */
function extractLinkedKey(issueLinks, config) {
  const { linkTypeName, linkedProject } = config;
  for (const link of issueLinks) {
    if (link.type.name !== linkTypeName) continue;
    // Check both directions: outwardIssue ("clones") and inwardIssue ("is cloned by")
    const linked = link.outwardIssue || link.inwardIssue;
    if (!linked || !linked.key.startsWith(linkedProject)) continue;
    return linked.key;
  }
  return null;
}

/**
 * Resolve linked features for all processed RFE issues.
 *
 * 1. Extract all unique linked keys from issue link data (already in memory)
 * 2. Batch-fetch details via JQL: `key IN ("KEY-1", "KEY-2", ...)` in chunks of 50
 * 3. Map fetched details back onto each RFE's `linkedFeature` field
 *
 * This avoids N+1 API calls — uses at most ceil(uniqueKeys / 50) JQL requests.
 */
async function resolveLinkedFeatures(jiraRequest, processedIssues, config) {
  // Step 1: Extract unique linked keys from each issue's raw issuelinks.
  const keyToRFEs = new Map(); // linked key → [indices into processedIssues]
  for (let i = 0; i < processedIssues.length; i++) {
    const rawLinks = processedIssues[i]._rawIssueLinks || [];
    const linkedKey = extractLinkedKey(rawLinks, config);
    if (linkedKey) {
      if (!keyToRFEs.has(linkedKey)) keyToRFEs.set(linkedKey, []);
      keyToRFEs.get(linkedKey).push(i);
    }
  }

  if (keyToRFEs.size === 0) return processedIssues;

  // Step 2: Batch-fetch in chunks of 50
  const allKeys = Array.from(keyToRFEs.keys());
  const CHUNK_SIZE = 50;
  const fetchedDetails = new Map(); // key → { summary, status, fixVersions }

  for (let i = 0; i < allKeys.length; i += CHUNK_SIZE) {
    const chunk = allKeys.slice(i, i + CHUNK_SIZE);
    const jql = `key IN (${chunk.map(k => `"${k}"`).join(', ')})`;
    const issues = await fetchAllJqlResults(jiraRequest, jql, 'summary,status,fixVersions');

    for (const issue of issues) {
      fetchedDetails.set(issue.key, {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        fixVersions: (issue.fields.fixVersions || []).map(v => v.name)
      });
    }
  }

  // Step 3: Attach to processed issues
  for (const [key, indices] of keyToRFEs) {
    const detail = fetchedDetails.get(key) || null;
    for (const idx of indices) {
      processedIssues[idx].linkedFeature = detail;
      delete processedIssues[idx]._rawIssueLinks; // clean up internal field
    }
  }

  // Clean up _rawIssueLinks on issues that had no linked features
  for (const issue of processedIssues) {
    delete issue._rawIssueLinks;
  }

  return processedIssues;
}

module.exports = { extractLinkedKey, resolveLinkedFeatures };
