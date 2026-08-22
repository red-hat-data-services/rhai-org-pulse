/**
 * AI Adoption pipeline — fetches features from Jira and scans for
 * AI pipeline labels to produce adoption scorecards per release group.
 *
 * Mount: consumed by ./routes.js
 */

const PROJECTS = ['AIPCC', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'RHAI', 'RHAISTRAT'];

const RELEASE_GROUPS = [
  {
    name: '3.4 GA',
    fixVersions: ['rhoai-3.4', 'rhelai-3.4', 'RHAII-3.4']
  },
  {
    name: '3.5 EA1',
    fixVersions: ['3.5 EA1 RHOAI RELEASE', '3.5 EA1 RHELAI RELEASE', '3.5 EA1 RHAII RELEASE']
  },
  {
    name: '3.5 EA2',
    fixVersions: ['3.5 EA2 RHOAI RELEASE', '3.5 EA2 RHELAI RELEASE', '3.5 EA2 RHAII RELEASE']
  },
  {
    name: '3.5 GA',
    fixVersions: ['3.5 GA RHOAI Release', '3.5 GA RHELAI RELEASE', '3.5 GA RHAII RELEASE']
  }
];

const AI_PIPELINE_TAXONOMY = {
  stratCreator: {
    name: 'Strategy Creator',
    prefixes: [
      'strat-creator-auto-created',
      'strat-creator-auto-refined',
      'strat-creator-rubric-pass',
      'strat-creator-human-sign-off'
    ]
  },
  rfeCreator: {
    name: 'RFE Creator',
    prefixes: [
      'rfe-creator-auto-created',
      'rfe-creator-autofix-rubric-pass',
      'rfe-creator-feasibility-pass',
      'rfe-creator-split-result'
    ]
  },
  testPlan: {
    name: 'Test Plan Generator',
    prefixes: [
      'test-plan-auto-created',
      'test-plan-auto-revised',
      'test-plan-rubric-pass'
    ]
  },
  qg1: {
    name: 'Priority Scoring (QG1)',
    prefixes: ['rp-qg1-auto-rice', 'rp-qg1-pass', 'rp-qg1-fail']
  },
  aiDoc: {
    name: 'AI-First Documentation',
    prefixes: [
      'ai1st-doc-contributed',
      'ai1st-doc-invoked',
      'ai1st-jira-contributed'
    ]
  },
  uxdAgentic: {
    name: 'UXD Agentic',
    prefixes: ['uxd-agentic']
  },
  epicCreator: {
    name: 'Epic Creator / Decomposer',
    prefixes: ['epic-creator-auto-decomposed', 'epic-creator-auto-created', 'epic-creator-split-result']
  }
};

const PIPELINE_KEYS = Object.keys(AI_PIPELINE_TAXONOMY);

const FIRST_PASS_RULES = {
  stratCreator: {
    created: ['strat-creator-auto-created'],
    revised: ['strat-creator-auto-refined']
  },
  rfeCreator: {
    created: ['rfe-creator-auto-created'],
    revised: ['rfe-creator-autofix-rubric-pass']
  },
  testPlan: {
    created: ['test-plan-auto-created'],
    revised: ['test-plan-auto-revised']
  },
  qg1: {
    created: ['rp-qg1-pass'],
    revised: ['rp-qg1-fail']
  }
};
const FIRST_PASS_KEYS = Object.keys(FIRST_PASS_RULES);

const EFFORT_FIELD = 'customfield_10430';
const RICE_EFFORT_FIELD = 'customfield_10637';
const STORY_POINTS_FIELD = 'customfield_10016';
const CHILD_BATCH_SIZE = 40;

/**
 * Scan a single issue's labels and return which pipelines are present,
 * plus first-pass acceptance for pipelines that have revision signals.
 * @param {string[]} labels
 * @returns {{ touched: boolean, pipelines: Record<string, number>, firstPass: Record<string, number|undefined> }}
 */
function scanLabels(labels) {
  const pipelines = {};
  let touched = false;

  for (const key of PIPELINE_KEYS) {
    const { prefixes } = AI_PIPELINE_TAXONOMY[key];
    const hit = labels.some(l => prefixes.some(p => l === p || l.startsWith(p + '-')));
    if (hit) {
      pipelines[key] = 1;
      touched = true;
    } else {
      pipelines[key] = 0;
    }
  }

  const firstPass = {};
  for (const key of FIRST_PASS_KEYS) {
    if (pipelines[key] !== 1) continue;
    const rule = FIRST_PASS_RULES[key];
    const hasCreated = labels.some(l => rule.created.some(p => l === p || l.startsWith(p + '-')));
    if (!hasCreated) continue;
    const hasRevised = labels.some(l => rule.revised.some(p => l === p || l.startsWith(p + '-')));
    firstPass[key] = hasRevised ? 0 : 1;
  }

  return { touched, pipelines, firstPass };
}

/**
 * Determine which effort signal has best coverage for a release group.
 * Priority: customfield_10430 > RICE Effort > child story points > child count
 * @param {{ effortCount: number, riceEffortCount: number, childSpCount?: number }} acc
 * @param {number} totalFeatures
 * @returns {'effort'|'rice'|'childSp'|'children'}
 */
function resolveEffortSignal(acc, totalFeatures) {
  if (totalFeatures === 0) return 'children';
  if (acc.effortCount / totalFeatures >= 0.5) return 'effort';
  if (acc.riceEffortCount / totalFeatures >= 0.5) return 'rice';
  if ((acc.childSpCount || 0) / totalFeatures >= 0.3) return 'childSp';
  return 'children';
}

/**
 * Compute resolved aggregateEffort and avgEffort using the selected signal.
 * @param {{ effortSum: number, riceEffortSum: number, childSpSum?: number, childIssueSum: number, total?: number }} entry
 * @param {'effort'|'rice'|'childSp'|'children'} signal
 */
function applyEffortSignal(entry, signal) {
  const n = entry.total || 0;
  let raw;
  if (signal === 'effort') raw = entry.effortSum;
  else if (signal === 'rice') raw = entry.riceEffortSum;
  else if (signal === 'childSp') raw = entry.childSpSum || 0;
  else raw = entry.childIssueSum;
  return {
    aggregateEffort: Math.round(raw * 10) / 10,
    avgEffort: n > 0 ? Math.round((raw / n) * 10) / 10 : 0
  };
}

/**
 * Fetch child issues for a batch of parent feature keys and roll up
 * child count + story point sum per parent.
 *
 * @param {object} jiraClient - { fetchAllJqlResults }
 * @param {string[]} parentKeys - Feature issue keys
 * @returns {Promise<Map<string, { childCount: number, childSpSum: number }>>}
 */
async function fetchChildRollups(jiraClient, parentKeys) {
  const rollups = new Map();
  if (!parentKeys.length) return rollups;

  for (let i = 0; i < parentKeys.length; i += CHILD_BATCH_SIZE) {
    const batch = parentKeys.slice(i, i + CHILD_BATCH_SIZE);
    const parentList = batch.join(', ');
    const jql = `parent in (${parentList}) ORDER BY parent ASC`;
    const fields = `parent,${STORY_POINTS_FIELD},${RICE_EFFORT_FIELD},timeoriginalestimate`;

    try {
      const children = await jiraClient.fetchAllJqlResults(jql, fields, { maxResults: 200 });
      for (const child of children) {
        const cf = child.fields || {};
        const parentKey = cf.parent && cf.parent.key;
        if (!parentKey) continue;

        if (!rollups.has(parentKey)) {
          rollups.set(parentKey, { childCount: 0, childSpSum: 0 });
        }
        const entry = rollups.get(parentKey);
        entry.childCount++;

        const sp = parseFloat(cf[STORY_POINTS_FIELD]) || 0;
        const rice = parseFloat(typeof cf[RICE_EFFORT_FIELD] === 'object' && cf[RICE_EFFORT_FIELD]
          ? cf[RICE_EFFORT_FIELD].value : cf[RICE_EFFORT_FIELD]) || 0;
        const timeEst = cf.timeoriginalestimate
          ? Math.round(cf.timeoriginalestimate / 3600) : 0;
        entry.childSpSum += sp || rice || timeEst;
      }
    } catch (err) {
      console.warn(`[ai-adoption] Child issue fetch failed for batch ${i}: ${err.message}`);
    }
  }

  return rollups;
}

/**
 * Fetch AI adoption data for the specified release groups.
 *
 * @param {object} jiraClient - { fetchAllJqlResults }
 * @param {object} [options]
 * @param {string} [options.releaseGroup] - single release group name to filter
 * @param {string} [options.component] - component name filter
 * @returns {Promise<object[]>} array of release group results
 */
async function fetchAiAdoptionData(jiraClient, options = {}) {
  const groups = options.releaseGroup
    ? RELEASE_GROUPS.filter(g => g.name === options.releaseGroup)
    : RELEASE_GROUPS;

  const results = [];

  for (const group of groups) {
    const fvList = group.fixVersions.map(v => `"${v}"`).join(', ');
    const projectList = PROJECTS.join(', ');
    const jql = `project in (${projectList}) AND issuetype = Feature AND fixVersion in (${fvList}) ORDER BY key ASC`;
    const fields = `summary,status,labels,components,fixVersions,${EFFORT_FIELD},${RICE_EFFORT_FIELD}`;

    let issues;
    try {
      issues = await jiraClient.fetchAllJqlResults(jql, fields, { maxResults: 200 });
    } catch (err) {
      console.warn(`[ai-adoption] Jira fetch failed for ${group.name}: ${err.message}`);
      issues = [];
    }

    const featureKeys = issues.map(i => i.key).filter(Boolean);
    const childRollups = await fetchChildRollups(jiraClient, featureKeys);

    const componentMap = {};
    let totalFeatures = 0;
    let aiTouchedFeatures = 0;
    let filteredTotal = 0;
    let filteredAiTouched = 0;
    const groupPipelines = {};
    for (const key of PIPELINE_KEYS) groupPipelines[key] = 0;
    const groupFirstPass = {};
    for (const key of FIRST_PASS_KEYS) groupFirstPass[key] = { accepted: 0, total: 0 };
    const groupEffort = {
      effortSum: 0, effortCount: 0,
      riceEffortSum: 0, riceEffortCount: 0,
      childIssueSum: 0,
      childSpSum: 0, childSpCount: 0
    };

    for (const issue of issues) {
      const f = issue.fields || {};
      const labels = f.labels || [];
      const components = (f.components || []).map(c => c.name);
      const { touched, pipelines, firstPass } = scanLabels(labels);

      const effortVal = parseFloat(f[EFFORT_FIELD]) || 0;
      const hasEffort = effortVal > 0;
      const riceRaw = f[RICE_EFFORT_FIELD];
      const riceVal = parseFloat(typeof riceRaw === 'object' && riceRaw ? riceRaw.value : riceRaw) || 0;
      const hasRice = riceVal > 0;

      const rollup = childRollups.get(issue.key) || { childCount: 0, childSpSum: 0 };
      const childCount = rollup.childCount;
      const childSp = rollup.childSpSum;
      const hasChildSp = childSp > 0;

      totalFeatures++;
      if (touched) aiTouchedFeatures++;
      for (const key of PIPELINE_KEYS) groupPipelines[key] += pipelines[key];
      for (const key of FIRST_PASS_KEYS) {
        if (firstPass[key] !== undefined) {
          groupFirstPass[key].total++;
          groupFirstPass[key].accepted += firstPass[key];
        }
      }
      if (hasEffort) { groupEffort.effortSum += effortVal; groupEffort.effortCount++; }
      if (hasRice) { groupEffort.riceEffortSum += riceVal; groupEffort.riceEffortCount++; }
      groupEffort.childIssueSum += Math.max(1, childCount);
      if (hasChildSp) { groupEffort.childSpSum += childSp; groupEffort.childSpCount++; }

      if (options.component && !components.includes(options.component)) continue;

      filteredTotal++;
      if (touched) filteredAiTouched++;

      const compNames = options.component
        ? [options.component]
        : (components.length > 0 ? components : ['(No Component)']);
      for (const compName of compNames) {
        if (!componentMap[compName]) {
          componentMap[compName] = {
            name: compName, total: 0, aiTouched: 0, pipelines: {},
            firstPass: {},
            effortSum: 0, effortCount: 0,
            riceEffortSum: 0, riceEffortCount: 0,
            childIssueSum: 0,
            childSpSum: 0, childSpCount: 0
          };
          for (const key of PIPELINE_KEYS) componentMap[compName].pipelines[key] = 0;
          for (const key of FIRST_PASS_KEYS) componentMap[compName].firstPass[key] = { accepted: 0, total: 0 };
        }
        componentMap[compName].total++;
        if (touched) componentMap[compName].aiTouched++;
        for (const key of PIPELINE_KEYS) {
          componentMap[compName].pipelines[key] += pipelines[key];
        }
        for (const key of FIRST_PASS_KEYS) {
          if (firstPass[key] !== undefined) {
            componentMap[compName].firstPass[key].total++;
            componentMap[compName].firstPass[key].accepted += firstPass[key];
          }
        }
        if (hasEffort) { componentMap[compName].effortSum += effortVal; componentMap[compName].effortCount++; }
        if (hasRice) { componentMap[compName].riceEffortSum += riceVal; componentMap[compName].riceEffortCount++; }
        componentMap[compName].childIssueSum += Math.max(1, childCount);
        if (hasChildSp) { componentMap[compName].childSpSum += childSp; componentMap[compName].childSpCount++; }
      }
    }

    const n = options.component ? filteredTotal : totalFeatures;
    const effortSource = resolveEffortSignal(groupEffort, n);

    const componentList = Object.values(componentMap).map(c => {
      const resolved = applyEffortSignal(c, effortSource);
      return { ...c, ...resolved };
    }).sort((a, b) => b.aiTouched - a.aiTouched);

    const filteredPipelines = {};
    const filteredFirstPass = {};
    if (options.component) {
      for (const key of PIPELINE_KEYS) {
        filteredPipelines[key] = componentList.reduce((s, c) => s + (c.pipelines[key] || 0), 0);
      }
      for (const key of FIRST_PASS_KEYS) {
        filteredFirstPass[key] = componentList.reduce((acc, c) => {
          const fp = c.firstPass && c.firstPass[key];
          if (fp) { acc.accepted += fp.accepted; acc.total += fp.total; }
          return acc;
        }, { accepted: 0, total: 0 });
      }
    }

    const groupResolved = applyEffortSignal({ ...groupEffort, total: n }, effortSource);

    results.push({
      releaseGroup: group.name,
      totalFeatures: options.component ? filteredTotal : totalFeatures,
      aiTouchedFeatures: options.component ? filteredAiTouched : aiTouchedFeatures,
      pipelines: options.component ? filteredPipelines : groupPipelines,
      firstPass: options.component ? filteredFirstPass : groupFirstPass,
      components: componentList,
      effortSignal: effortSource,
      aggregateEffort: groupResolved.aggregateEffort,
      avgEffort: groupResolved.avgEffort
    });
  }

  return results;
}

module.exports = {
  fetchAiAdoptionData,
  fetchChildRollups,
  scanLabels,
  resolveEffortSignal,
  applyEffortSignal,
  AI_PIPELINE_TAXONOMY,
  PIPELINE_KEYS,
  FIRST_PASS_RULES,
  FIRST_PASS_KEYS,
  RELEASE_GROUPS,
  PROJECTS,
  EFFORT_FIELD,
  RICE_EFFORT_FIELD,
  STORY_POINTS_FIELD,
  CHILD_BATCH_SIZE
};
