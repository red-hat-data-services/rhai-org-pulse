/**
 * Pure data-mapping / planning-calculation logic extracted from the AI Planner
 * iframe (public/ai-first-scheduler/index.html), for the Vue migration's stage 1a
 * ("capture current behavior"). See AI-PLANNER-HANDOFF.md and the Nov 3 2026
 * migration plan.
 *
 * The functions below are byte-faithful copies (or, where noted, DOM-free
 * reimplementations) of logic that still lives -- unchanged -- in index.html.
 * index.html is NOT wired to this module; it keeps running standalone in
 * production until stage 1b/1c lands. Treat this file as a snapshot, not a
 * refactor: do not "fix" anything here without also tracking it back upstream.
 *
 * Provenance is called out per-function against index.html line numbers as of
 * origin/main @ b9e9418b (2026-11-04).
 */

import {
  BIG_ROCKS,
  CAP,
  FPDOR_WEIGHTS,
  FPDOR_MANDATORY_HARD,
  ML_SCORES,
  ML_REAL_KEYS,
  ROADMAP_OUTCOMES
} from './constants.js'

/**
 * DOM-free reimplementation of index.html's esc() (line 1128):
 *   function esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=String(s);return d.innerHTML;}
 * That original touches the DOM (creates a <div>, reads innerHTML back) purely to get
 * browser-standard text-node escaping. It is reused throughout index.html as a general
 * "coerce Jira field to safe string" helper, not just for render output -- schedule() and
 * the table filter predicate both call it on raw field values before matching/splitting.
 * This reimplementation produces the same output for the three entities a text-node
 * serialization actually escapes (&, <, >); quotes are left alone, matching browser
 * behavior for textContent -> innerHTML. Only Jira field values containing those three
 * characters would observably differ, and only in how matching/splitting treats them.
 */
export function esc(s) {
  if (!s) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Source: index.html lines 2693-2695 (weighted-FPDoR calc inlined in schedule()'s
// pre-filter step). Pulled out as its own function per the task's FPDoR-scoring
// candidate -- same formula, same FPDOR_WEIGHTS table, same default-3 fallback.
export function computeWeightedFPDoR(failedItems) {
  const wPenalty = (failedItems || []).reduce((sum, item) => sum + (FPDOR_WEIGHTS[item] || 3), 0)
  return Math.max(0, 100 - wPenalty)
}

/**
 * Faithful extraction of the main Feature Scheduling table's filter predicate from
 * run() (index.html lines 3465-3486). DOM reads (v(), msGet(), document.getElementById)
 * and `window.*` globals are replaced by an explicit `filters` object; the matching
 * logic, field names, and precedence order are otherwise unchanged.
 *
 * NOT included: the window._urgentFilter key-list filter applied right after this
 * predicate (index.html lines 3488-3490) and all of run()'s sorting/grouping logic
 * (lines 3492-3542) -- both are pure too and are reasonable candidates for stage 1b,
 * but weren't named in this extraction's scope.
 *
 * PM FILTER FLAG: as of this extraction (branched from origin/main @ b9e9418b, which
 * already includes PR #1859 "fix(ai-planner): filter PM/Executive views by live Jira
 * data, not stale proxies", merged 2026-11-03/04), `filters.pm` is matched directly
 * against each feature's live Jira PM field (`r['PM']`) -- there is no PM_COMPONENTS
 * component-ownership proxy in the code being extracted. The task briefing described
 * that bug as still present and unmerged on a separate branch
 * (fix/ai-planner-pm-team-filters, PR #1859); that is stale relative to current
 * origin/main. Nothing was silently fixed here -- the predicate below is simply what
 * main already does. Whoever picks up stage 1b should re-confirm PR #1859's merge
 * state before assuming this is still an open bug.
 */
export function filterFeatures(rows, filters) {
  const f = filters || {}
  return rows.filter(r => {
    if (f.rel && !((esc(r['Target Versions']) || '').includes(f.rel) || (esc(r['Fix Version']) || '').includes(f.rel))) return false
    if (f.read === 'committed' && r['Confidence'] !== 'committed') return false
    if (f.read === 'not-ready') {
      const fpdor = r['FPDoR']
      const fpdorStr = typeof fpdor === 'string' ? fpdor : ((fpdor?.passedCount ?? 0) + '/' + (fpdor?.totalCount ?? 0))
      if (fpdorStr === '17/17') return false
    }
    if (f.place === 'EA1+EA2') { if (r._place !== 'EA1' && r._place !== 'EA2') return false }
    else if (f.place && r._place !== f.place) return false
    if (f.outcome && esc(r['Outcome']) !== f.outcome) return false
    if (f.tv && f.tv.length && !f.tv.some(v => (esc(r['Target Versions']) || '').includes(v) || (esc(r['Fix Version']) || '').includes(v))) return false
    if (f.comp && f.comp.length && !f.comp.some(c => (esc(r['Components']) || '').includes(c))) return false
    if (f.pm && (r['PM'] || '').trim() !== f.pm) return false
    if (f.team && f.team.length && !f.team.some(t => (esc(r['Team']) || '').includes(t))) return false
    if (f.assign && (r['Assignee'] || '').trim() !== f.assign) return false
    if (f.pri && esc(r['Priority']) !== f.pri) return false
    if (f.fail && !(r['Failed FPDoR Items'] || '').includes(f.fail)) return false
    if (f.bigRockOnly && !r['Outcome']) return false
    if (f.selectedBR && !(r._bigRocks && r._bigRocks.includes(f.selectedBR))) return false
    return true
  })
}

/**
 * Pure aggregation extracted from renderExecView() (index.html lines 4379-4394) --
 * the Executive tab's per-outcome (Big Rock) coverage/confidence rollup. HTML
 * building and the DOM write stay in the iframe; this returns the same per-outcome
 * stats object plus the two summary counts shown in the Outcomes header.
 */
export function aggregateBigRockStats(rows) {
  const stats = {}
  BIG_ROCKS.forEach(br => { stats[br.name] = { inPlan: 0, total: 0, confSum: 0, avgConf: 0 } })
  rows.forEach(r => {
    if (!r._bigRocks) return
    r._bigRocks.forEach(name => {
      if (!stats[name]) return
      stats[name].total++
      if (r._place !== 'No') { stats[name].inPlan++; stats[name].confSum += (r._conf || 0) }
    })
  })
  BIG_ROCKS.forEach(br => {
    const d = stats[br.name]
    d.avgConf = d.inPlan > 0 ? Math.round(d.confSum / d.inPlan) : 0
  })
  const coveredOutcomes = BIG_ROCKS.filter(br => stats[br.name].inPlan > 0).length
  const gappedOutcomes = BIG_ROCKS.filter(br => stats[br.name].total > 0 && stats[br.name].inPlan === 0).length
  return { stats, coveredOutcomes, gappedOutcomes }
}

// ---- computeFPDoRRisk: index.html lines 1562-1623 ----
export function computeFPDoRRisk(r) {
  const failedItems = (r['Failed FPDoR Items'] || '').trim();
  const fpdorScore  = (r['FPDoR'] || '').trim();

  // Short-circuit: Org Pulse says all items pass → LOW risk, no further checks needed
  if (fpdorScore && failedItems === '') {
    return { riskLevel: 'LOW', ready: true, critFails: [], highFails: [], medFails: [], softFails: [] };
  }

  const labels    = (esc(r['Labels']) || '').toLowerCase();
  const tv        = (r['Target Version'] || esc(r['Target Versions']) || '').trim();
  const comps     = (esc(r['Components']) || '').trim();
  const releaseType = (esc(r['Release Type']) || '').trim();
  const priority  = (esc(r['Priority']) || '').trim();
  const docsField = (r['Product Documentation Required'] || '').trim().toLowerCase();
  const assignee  = r['Assignee'] !== undefined ? (r['Assignee'] || '').trim() : null;
  // null when the source has no such column, so CSV rows are not penalised for a
  // field they never carried.
  // Jira hands back a {displayName} object for some features and a bare string for
  // others; calling .trim() on the object threw and took the whole schedule with it.
  const pmRaw     = r['PM'];
  const pmName    = pmRaw && typeof pmRaw === 'object' ? (pmRaw.displayName || '') : (pmRaw || '');
  const pm        = pmRaw !== undefined ? String(pmName).trim() : null;
  const fv        = (esc(r['Fix Version']) || r['Fix Versions'] || '').trim();

  // CRITICAL — any fail = HIGH risk
  const critFails = [];
  if (!comps)                          critFails.push('Components');
  if (!tv)                             critFails.push('Target Version');
  if (!fv)                             critFails.push('Fix Version');
  if (assignee !== null && !assignee)  critFails.push('Delivery Owner');
  if (pm !== null && !pm)              critFails.push('PM');

  // HIGH — 2+ fails = HIGH; 1 fail = MEDIUM
  const highFails = [];
  if (!releaseType)                                                              highFails.push('Release Type');
  if (!priority)                                                                 highFails.push('Priority');
  if (!docsField || docsField === 'unknown')                                     highFails.push('Docs Impact');
  // RICE: only flag if Failed FPDoR Items explicitly lists it (not a label proxy)
  if (failedItems && failedItems.toLowerCase().includes('rice'))                 highFails.push('RICE score');

  // MEDIUM — any fail (no critical) = MEDIUM
  const medFails = [];
  if (!labels.includes('strat-creator-human-sign-off'))      medFails.push('Feature Sign-Off');

  // SOFT — margin only
  const softFails = [];
  if (!labels.includes('rp-qg1-pass') && !labels.includes('rfe-creator-autofix-rubric-pass'))
    softFails.push('Source RFE/AI SDLC');

  let riskLevel;
  if (critFails.length > 0 || highFails.length >= 2) {
    riskLevel = 'HIGH';
  } else if (highFails.length === 1 || medFails.length > 0) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  const ready = critFails.length === 0 && highFails.length === 0 && medFails.length === 0;
  return { riskLevel, ready, critFails, highFails, medFails, softFails };
}

// ---- computeApproxMLScore: index.html lines 2556-2572 ----
export function computeApproxMLScore(r){
  // RF+ROS approximation using CSV-available features only.
  // Slip history (53% of model signal per feature_importance_v3) is unknown → defaults to 0.
  // Uses: FPDoR pass rate/count/failures (27%), RICE+priority (8%), label boosts (8%) = ~43% of weight.
  const mandatoryList=['Release Type','Target Version','Components','PM','Delivery Owner','Priority','RICE','Docs impact'];
  const mFailed=(r._failedItems||[]).filter(i=>mandatoryList.includes(i)).length;
  const cFailed=Math.max(0,(r._failedItems||[]).length-mFailed);
  const passRate=(r._fNum||0)/13; // 0.846 = 11/13 ≈ training mean
  let pct=87; // base: 90% delivery rate adjusted down for unknown slip history
  pct+=(passRate-0.846)*45;
  pct-=mFailed*5;
  pct-=cFailed*1.5;
  pct+=(r._riceBoost||0)*1.5;
  pct+=(r._priorityBoost||0)*1.2;
  pct+=(r._labelBoost||0)*0.8;
  return Math.max(15,Math.min(98,Math.round(pct*10)/10));
}

// ---- schedule: index.html lines 2579-2900 ----
export function schedule(rows){
  // Usage counters — per-component and per-team
  const usedComp={EA1:{},EA2:{},GA:{}};
  const usedTeam={EA1:{},EA2:{},GA:{}};

  function addUsage(comps,team,evt){
    comps.forEach(c=>{ usedComp[evt][c]=(usedComp[evt][c]||0)+1; });
    if(team) usedTeam[evt][team]=(usedTeam[evt][team]||0)+1;
  }

  // Components that shipped in every release 3.3→3.5 (from opendatahub-io releases).
  // ODH names mapped to Jira component names from the Org Pulse CSV.
  // Dashboard→AI Core Dashboard, Ray→KubeRay, Datasciencepipelines→AI Pipelines,
  // Kserve→vLLM Runtime, Trustyai→AI Safety, Trainingoperator→Training Kubeflow,
  // Mlflowoperator→MLflow, Feastoperator→Feature Store, Workbenchesnotebooks→Notebooks Images,
  // Modelregistry→Model Runtimes, Modelcontroller→Serving Orchestration
  // New in 3.5 only (no bonus): llm-d, OGX Core, Batch gateway
  // Feature → team lookup: Erle Marion capacity-dataset.json (2026-08-11)
  // Source: RHAISTRAT byFeature, Jira Team field only, noise boards filtered.
  // 323 resolved features with team attribution — enriches matching CSV rows.
  const FEATURE_TEAM_LOOKUP = {"RHAISTRAT-2114":["AgentOps (RAG + Vector DB) Scrum Board","RAG","RHAI AgentOps"],"RHAISTRAT-2057":["Docs Team","evalhub"],"RHAISTRAT-2051":["RHAI Agentic API","RHAI Training Kanban Board"],"RHAISTRAT-2028":["RHOAI AI Hub"],"RHAISTRAT-2024":["AIP Training Ray"],"RHAISTRAT-2022":["AIP Training Ray"],"RHAISTRAT-2015":["RHAI INFERENG Runtime"],"RHAISTRAT-1969":["AI Innovation team","RHAI SDG Kanban Board","SDG-Hub"],"RHAISTRAT-1920":["AIP MLflow"],"RHAISTRAT-1915":["RHOAI Trusty AI"],"RHAISTRAT-1879":["evalhub"],"RHAISTRAT-1877":["RHAI INFERENG Runtime"],"RHAISTRAT-1868":["Docs Team","RHAI Model Runtimes"],"RHAISTRAT-1859":["RHAI Green"],"RHAISTRAT-1856":["AI Safety / Model Eval Planning","All EvalHub","RHOAI Trusty AI","TrustyAI Board"],"RHAISTRAT-1854":["Docs Team","RHAI AgentDev"],"RHAISTRAT-1850":["RHAI Notebooks"],"RHAISTRAT-1835":["RHAI Green"],"RHAISTRAT-1834":["AI Safety / Model Eval Planning","All EvalHub","RHOAI Trusty AI","TrustyAI Board"],"RHAISTRAT-1828":["AI Safety / Model Eval Planning","All EvalHub","TrustyAI Board","evalhub"],"RHAISTRAT-1824":["AI Innovation team","RHAI SDG Kanban Board","SDG-Hub"],"RHAISTRAT-1823":["AutoRAG","AutoX (AutoML & AutoRAG)","RHAI Purple"],"RHAISTRAT-1822":["AutoX (AutoML & AutoRAG)","RHAI Purple"],"RHAISTRAT-1817":["RHOAI AI Hub"],"RHAISTRAT-1816":["RHOAI AI Hub"],"RHAISTRAT-1815":["RHAI Tooling Experience"],"RHAISTRAT-1806":["AI Core Platform"],"RHAISTRAT-1789":["Docs Team","RHAI Serving Orchestration"],"RHAISTRAT-1765":["INFERENG Midstream"],"RHAISTRAT-1758":["RHAI Razzmatazz"],"RHAISTRAT-1757":["RHAI Tangerine","RHOAIUX Sprint Board"],"RHAISTRAT-1750":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1744":["RHAI Purple"],"RHAISTRAT-1740":["RHAI Green","RHOAI AI Hub"],"RHAISTRAT-1737":["RHAI Zaffre","Zaffre Planning (Dashboard)"],"RHAISTRAT-1733":["AgentDev Scrum Board","RHAI AgentDev"],"RHAISTRAT-1727":["AIP MLflow","RHAI Razzmatazz"],"RHAISTRAT-1726":["INFERENG llm-d","INFERENG llm-d Abba","INFERENG llm-d Paxos","INFERENG llm-d Raft","INFERENG llm-d backlog","RHAI Serving Orchestration"],"RHAISTRAT-1725":["INFERENG llm-d"],"RHAISTRAT-1722":["RHAI Pewter","RHAI Pewter Planning"],"RHAISTRAT-1721":["AI Safety / Model Eval Planning","AgentDev Scrum Board","AgentOps (RAG + Vector DB) Scrum Board","Agentic API Team Scrum Board","TrustyAI Board"],"RHAISTRAT-1719":["RHAI Serving Orchestration"],"RHAISTRAT-1717":["RHAI Serving Orchestration"],"RHAISTRAT-1714":["RHAI Green","RHOAI AI Hub"],"RHAISTRAT-1712":["RHAI Notebooks"],"RHAISTRAT-1704":["AutoRAG","AutoX (AutoML & AutoRAG)","Docs Team","RHAI Purple"],"RHAISTRAT-1703":["RHOAI Trusty AI"],"RHAISTRAT-1701":["RHOAI Trusty AI"],"RHAISTRAT-1700":["RHAI Agentic API"],"RHAISTRAT-1699":["Docs Team","RHAI Razzmatazz"],"RHAISTRAT-1698":["AI Safety / Model Eval Planning","All EvalHub","Docs Team","RHOAI Trusty AI","TrustyAI Board"],"RHAISTRAT-1694":["RHAI AgentDev"],"RHAISTRAT-1693":["AIP Kubeflow-DevX"],"RHAISTRAT-1686":["evalhub"],"RHAISTRAT-1685":["INFERENG llm-d"],"RHAISTRAT-1673":["AutoRAG","AutoX (AutoML & AutoRAG)","RHAI Purple"],"RHAISTRAT-1671":["RHAI INFERENG Runtime"],"RHAISTRAT-1662":["RHAI Notebooks"],"RHAISTRAT-1643":["INFERENG llm-d"],"RHAISTRAT-1641":["INFERENG llm-d"],"RHAISTRAT-1635":["AI Safety / Model Eval Planning","All EvalHub","RHOAI Trusty AI","TrustyAI Board","evalhub"],"RHAISTRAT-1615":["INFERENG llm-d"],"RHAISTRAT-1603":["evalhub"],"RHAISTRAT-1589":["RHOAI Trusty AI"],"RHAISTRAT-1567":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1566":["Crimson Planning (Dashboard)","RHAI Crimson","RHOAI Dashboard"],"RHAISTRAT-1565":["Crimson Planning (Dashboard)","Docs Team","RHAI Crimson","RHOAI Dashboard"],"RHAISTRAT-1555":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1550":["Onyx Planning Dashboard","RHAI Onyx"],"RHAISTRAT-1547":["Onyx Planning Dashboard","RHAI Onyx"],"RHAISTRAT-1540":["RHAI Serving Orchestration"],"RHAISTRAT-1538":["AutoML","AutoX (AutoML & AutoRAG)","Docs Team","RHAI Model Runtimes"],"RHAISTRAT-1536":["RHAI Razzmatazz"],"RHAISTRAT-1534":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1530":["RHOAI Trusty AI"],"RHAISTRAT-1528":["Crimson Planning (Dashboard)","Docs Team","RHAI Crimson"],"RHAISTRAT-1527":["Crimson Planning (Dashboard)","Docs Team","RHAI Crimson"],"RHAISTRAT-1526":["Crimson Planning (Dashboard)","RHAI Crimson","RHAI Green","RHOAI AI Hub"],"RHAISTRAT-1524":["RHAI Green","RHOAI AI Hub"],"RHAISTRAT-1523":["RHOAI AI Hub"],"RHAISTRAT-1521":["Docs Team","RHAI Teal","RHOAI IDE","RHOAIENG Teal Board"],"RHAISTRAT-1519":["AI Core Platform","AIP MLflow","AIP Training Kubeflow","AIP Training Ray","Fine Tuning","RHAI Data Processing","RHAI Indigo","RHAI Notebooks","RHAI Training Kanban Board","RHOAI AI Hub","Training Ray"],"RHAISTRAT-1507":["evalhub"],"RHAISTRAT-1506":["evalhub"],"RHAISTRAT-1505":["AI Safety / Model Eval Planning","All EvalHub","RHOAI Trusty AI","TrustyAI Board","evalhub"],"RHAISTRAT-1504":["RHOAI Trusty AI","evalhub"],"RHAISTRAT-1492":["AutoML","AutoX (AutoML & AutoRAG)","Docs Team","RHAI Purple"],"RHAISTRAT-1491":["AutoML","AutoX (AutoML & AutoRAG)","Docs Team","RHAI Purple"],"RHAISTRAT-1490":["AI Innovation team","RHAI SDG Kanban Board","SDG-Hub"],"RHAISTRAT-1483":["RHAI Agentic API"],"RHAISTRAT-1481":["RHOAI AI Hub"],"RHAISTRAT-1477":["AI Core Platform","RHAI Data Processing"],"RHAISTRAT-1476":["RHAI Agentic API"],"RHAISTRAT-1474":["RHOAI Dashboard","RHOAIUX Sprint Board"],"RHAISTRAT-1473":["Docs Team","RHAI Green","RHOAI AI Hub"],"RHAISTRAT-1469":["INFERENG llm-d"],"RHAISTRAT-1468":["RHAI Serving Orchestration"],"RHAISTRAT-1453":["RHAI INFERENG Runtime"],"RHAISTRAT-1441":["AI Safety / Model Eval Planning","All EvalHub","RHOAI Trusty AI","TrustyAI Board"],"RHAISTRAT-1439":["RHAI Agentic API"],"RHAISTRAT-1437":["evalhub"],"RHAISTRAT-1433":["RHAI AI Pipelines","RHAI Razzmatazz","RHOAI IDE+Docs (standup-optimized)"],"RHAISTRAT-1431":["RHAI Onyx","RHOAIUX Sprint Board"],"RHAISTRAT-1425":["AutoRAG","AutoX (AutoML & AutoRAG)","RHAI Purple"],"RHAISTRAT-1422":["Docs Team","RHAI Teal","RHOAIENG Teal Board"],"RHAISTRAT-1418":["RHAI Agentic API"],"RHAISTRAT-1416":["RHAI Agentic API"],"RHAISTRAT-1414":["AIP Kubeflow-DevX","Docs Team"],"RHAISTRAT-1412":["Docs Team","RHAI Serving Orchestration"],"RHAISTRAT-1410":["RHAI Data Processing"],"RHAISTRAT-1409":["RHAI Data Processing"],"RHAISTRAT-1408":["RHAI Data Processing"],"RHAISTRAT-1381":["ACS Automation"],"RHAISTRAT-1376":["RHAI Tooling Experience"],"RHAISTRAT-1374":["AI Safety / Model Eval Planning","AgentDev Scrum Board","AgentOps (RAG + Vector DB) Scrum Board","Agentic API Team Scrum Board","RHAI Agentic API","TrustyAI Board"],"RHAISTRAT-1373":["AI Core Platform","Agentic API Team Scrum Board","RHAI Agentic API","RHAI Tooling Experience","RHOAI DevTestOps"],"RHAISTRAT-1368":["Docs Team","RHAI Serving Orchestration"],"RHAISTRAT-1364":["RHAI Tooling Experience"],"RHAISTRAT-1362":["RHAI Agentic API"],"RHAISTRAT-1361":["RHAI Agentic API"],"RHAISTRAT-1329":["RHAI Agentic API"],"RHAISTRAT-1325":["INFERENG llm-d","INFERENG llm-d Raft"],"RHAISTRAT-1321":["Agentic API Team Scrum Board","Data Processing Scrum Board","RHAI Agentic API","RHAI Training Kanban Board"],"RHAISTRAT-1299":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1295":["RHOAI Inference Extensions"],"RHAISTRAT-1291":["RHAI Notebooks"],"RHAISTRAT-1290":["RHAI Tooling Experience"],"RHAISTRAT-1289":["All EvalHub","RHOAI Trusty AI"],"RHAISTRAT-1286":["RHAI Data Processing"],"RHAISTRAT-1284":["RHAI Razzmatazz"],"RHAISTRAT-1280":["Docs Team","RHAI Serving Orchestration"],"RHAISTRAT-1279":["RAG","RHAI AgentOps"],"RHAISTRAT-1276":["INFERENG llm-d","RHAI Serving Orchestration"],"RHAISTRAT-1267":["RHAI Monarch"],"RHAISTRAT-1266":["RHAI Model Runtimes"],"RHAISTRAT-1252":["RHOAI Trusty AI","evalhub"],"RHAISTRAT-1250":["RHAI Serving Orchestration"],"RHAISTRAT-1246":["RHAI Agentic API"],"RHAISTRAT-1245":["RHAI Agentic API"],"RHAISTRAT-1244":["Docs Team","RHOAI AI Hub"],"RHAISTRAT-1243":["RHOAI AI Hub"],"RHAISTRAT-1240":["INFERENG Midstream"],"RHAISTRAT-1235":["RHOAI Dashboard","RHOAI Inference Extensions","Zaffre Planning (Dashboard)"],"RHAISTRAT-1233":["RHOAI Trusty AI"],"RHAISTRAT-1231":["RHAI AgentDev","RHAI Agentic API"],"RHAISTRAT-1228":["RHAI Agentic API"],"RHAISTRAT-1218":["Project Navigator"],"RHAISTRAT-1217":["RHAI AgentDev","RHAI Agentic API"],"RHAISTRAT-1209":["Docs Team","INFERENG llm-d","InferEng Prio","llm-d Paxos Doing"],"RHAISTRAT-1208":["AI Core Platform","INFERENG llm-d"],"RHAISTRAT-1204":["AutoX (AutoML & AutoRAG)","RHAI Purple","RHOAI Dashboard"],"RHAISTRAT-1201":["RHOAI Dashboard","RHOAI Inference Extensions","Zaffre Planning (Dashboard)"],"RHAISTRAT-1199":["Docs Team","INFERENG llm-d"],"RHAISTRAT-1196":["RHAI Agentic API"],"RHAISTRAT-1193":["RHAI Notebooks"],"RHAISTRAT-1191":["AutoML","AutoX (AutoML & AutoRAG)","RHOAI Dashboard"],"RHAISTRAT-1186":["RHAI Serving Orchestration"],"RHAISTRAT-1185":["RHAI Serving Orchestration"],"RHAISTRAT-1176":["AutoML","AutoRAG","AutoX (AutoML & AutoRAG)","RHOAI Dashboard"],"RHAISTRAT-1167":["RHAI Serving Orchestration","RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-1161":["RHAI Indigo","RHAI Notebooks","RHAI Razzmatazz","RHOAI IDE+Docs (standup-optimized)"],"RHAISTRAT-1159":["INFERENG Midstream"],"RHAISTRAT-1155":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-1151":["AgentOps (RAG + Vector DB) Scrum Board","RHAI Model Runtimes"],"RHAISTRAT-1150":["AutoX (AutoML & AutoRAG)","RHAI Purple","RHOAI Dashboard"],"RHAISTRAT-1149":["RHAI AgentDev"],"RHAISTRAT-1148":["RHAI Agentic API"],"RHAISTRAT-1142":["RHAI Agentic API"],"RHAISTRAT-1138":["RHAI Notebooks"],"RHAISTRAT-1137":["RHAI Notebooks"],"RHAISTRAT-1135":["RHAI Notebooks"],"RHAISTRAT-1134":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1131":["AI Core Platform","AIP Feature Store","AgentOps (RAG + Vector DB) Scrum Board"],"RHAISTRAT-1129":["AIP Feature Store","AgentOps (RAG + Vector DB) Scrum Board"],"RHAISTRAT-1120":["RHOAI Inference Extensions"],"RHAISTRAT-1115":["AIP Feature Store","Docs Team","RHAI Tangerine"],"RHAISTRAT-1114":["RHAI Notebooks"],"RHAISTRAT-1113":["RHAI Notebooks"],"RHAISTRAT-1112":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1111":["RHAI Agentic API"],"RHAISTRAT-1106":["RHAI Agentic API"],"RHAISTRAT-1103":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-1088":["AIP Training Kubeflow"],"RHAISTRAT-1084":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-1081":["AI Core Platform","RHAI Razzmatazz","RHOAI Dashboard"],"RHAISTRAT-1076":["RHAI Agentic API"],"RHAISTRAT-1074":["RHOAI AI Hub"],"RHAISTRAT-1062":["AI Innovation team"],"RHAISTRAT-1061":["RHAI Agentic API","RHAI Training Kanban Board"],"RHAISTRAT-1060":["INFERENG Midstream"],"RHAISTRAT-1057":["INFERENG Midstream"],"RHAISTRAT-1054":["RHAI AgentDev"],"RHAISTRAT-1051":["All EvalHub","RHOAI Trusty AI"],"RHAISTRAT-1047":["RHAI Serving Orchestration","RHAI Zaffre","Zaffre Planning (Dashboard)"],"RHAISTRAT-1041":["RHAI Model Runtimes"],"RHAISTRAT-1016":["INFERENG Midstream"],"RHAISTRAT-990":["INFERENG Midstream"],"RHAISTRAT-989":["RHAI Agentic API"],"RHAISTRAT-971":["INFERENG Midstream","RHAI Klara's Team"],"RHAISTRAT-963":["INFERENG llm-d","RHAI Serving Orchestration"],"RHAISTRAT-962":["INFERENG Midstream"],"RHAISTRAT-958":["INFERENG Midstream"],"RHAISTRAT-956":["INFERENG Midstream"],"RHAISTRAT-954":["RHAI Agentic API"],"RHAISTRAT-949":["AI Core Platform"],"RHAISTRAT-945":["RHAI Agentic API"],"RHAISTRAT-944":["RHAI Agentic API"],"RHAISTRAT-942":["AIP Training Ray"],"RHAISTRAT-935":["AIP Feature Store"],"RHAISTRAT-864":["Crimson Planning (Dashboard)","RHAI Crimson","RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-863":["RHAI Agentic API"],"RHAISTRAT-861":["RHAI Razzmatazz"],"RHAISTRAT-853":["RHAI Serving Orchestration"],"RHAISTRAT-844":["RHAI Indigo","RHOAI IDE","RHOAI IDE+Docs (standup-optimized)"],"RHAISTRAT-838":["RHAI AgentOps"],"RHAISTRAT-827":["AI Core Platform","RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-813":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-809":["AI Core Platform","RHAI Klara's Team"],"RHAISTRAT-803":["AI Core Platform","RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-801":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-799":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-798":["RHAI Agentic API"],"RHAISTRAT-797":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-795":["RHAI Serving Orchestration"],"RHAISTRAT-791":["RHAI AgentOps","Workload Orchestration"],"RHAISTRAT-780":["RHAI Agentic API"],"RHAISTRAT-777":["RHOAI Dashboard"],"RHAISTRAT-758":["RHOAI Dashboard"],"RHAISTRAT-743":["AI Core Platform","RHAI Razzmatazz","RHOAI IDE+Docs (standup-optimized)"],"RHAISTRAT-731":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-712":["AgentOps (RAG + Vector DB) Scrum Board","RHAI Razzmatazz","RHOAI Dashboard"],"RHAISTRAT-705":["RHAI AgentDev"],"RHAISTRAT-683":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-670":["INFERENG llm-d","INFERENG llm-d Raft","RHAI Serving Orchestration","Zaffre Planning (Dashboard)"],"RHAISTRAT-667":["AI Core Platform","AIP Training Kubeflow","AIP Training Ray","RHAI Razzmatazz","RHAI Serving Orchestration","RHOAI IDE","RHOAI Workload Orchestration"],"RHAISTRAT-658":["AI Core Platform"],"RHAISTRAT-657":["RHOAI Trusty AI"],"RHAISTRAT-643":["RHOAI Trusty AI"],"RHAISTRAT-638":["AIP Training Ray"],"RHAISTRAT-634":["RHAI AI Pipelines","RHAI Razzmatazz","RHOAI IDE","RHOAI IDE+Docs (standup-optimized)"],"RHAISTRAT-629":["RHOAI AI Hub"],"RHAISTRAT-621":["AIP Feature Store"],"RHAISTRAT-620":["AI Core Platform","RHAI Serving Orchestration"],"RHAISTRAT-592":["Crimson Planning (Dashboard)","RHAI Crimson","RHOAI Dashboard"],"RHAISTRAT-589":["AIP Feature Store","Feature Store"],"RHAISTRAT-581":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-568":["RHOAI Trusty AI"],"RHAISTRAT-554":["AI Core Platform"],"RHAISTRAT-553":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-545":["Crimson Planning (Dashboard)","Docs Team","RHAI Crimson","RHAI Training Kanban Board"],"RHAISTRAT-543":["AIP Feature Store"],"RHAISTRAT-532":["RHAI AgentOps"],"RHAISTRAT-530":["RHAI AgentOps","RHAI Agentic API"],"RHAISTRAT-527":["AIP Feature Store","RHAI Notebooks"],"RHAISTRAT-525":["AIP Training Kubeflow"],"RHAISTRAT-517":["RHAI Serving Orchestration"],"RHAISTRAT-507":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-500":["Crimson Planning (Dashboard)","RHAI AgentOps","RHAI Crimson","RHOAI Dashboard"],"RHAISTRAT-497":["Docs Team","RHAI Tangerine","RHOAI Dashboard"],"RHAISTRAT-491":["RHAI Model Runtimes"],"RHAISTRAT-486":["AI Core Platform"],"RHAISTRAT-479":["RHOAI Dashboard"],"RHAISTRAT-456":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-454":["RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-446":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-424":["RHAI Notebooks","RHOAI IDE"],"RHAISTRAT-409":["RHAI Serving Orchestration"],"RHAISTRAT-400":["AI Core Platform","RHOAI Customer Quality"],"RHAISTRAT-396":["AI Core Platform"],"RHAISTRAT-391":["RHAI Serving Orchestration"],"RHAISTRAT-389":["RHAI Notebooks","RHOAI IDE"],"RHAISTRAT-386":["RHOAI Dashboard"],"RHAISTRAT-383":["RHAI Serving Orchestration"],"RHAISTRAT-363":["RHOAI Dashboard"],"RHAISTRAT-349":["RHOAI AI Hub","RHOAI Dashboard"],"RHAISTRAT-347":["RHOAI DevTestOps"],"RHAISTRAT-342":["AIP Kubeflow-DevX"],"RHAISTRAT-324":["AIP Training Ray","RHOAI Workload Orchestration"],"RHAISTRAT-323":["AIP Training Ray"],"RHAISTRAT-313":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-312":["AIP Feature Store","AIPCC Package Update Requests","Frank's Team","RHAI Tangerine","RHOAI IDE"],"RHAISTRAT-309":["AIP Training Kubeflow"],"RHAISTRAT-308":["AI Core Platform","AIP Kubeflow-DevX","AIP Training Kubeflow"],"RHAISTRAT-290":["INFERENG Midstream"],"RHAISTRAT-270":["INFERENG Midstream"],"RHAISTRAT-255":["INFERENG Midstream"],"RHAISTRAT-250":["INFERENG Midstream"],"RHAISTRAT-245":["INFERENG Midstream"],"RHAISTRAT-244":["INFERENG Midstream"],"RHAISTRAT-243":["INFERENG Midstream"],"RHAISTRAT-241":["INFERENG Midstream"],"RHAISTRAT-228":["INFERENG Midstream"],"RHAISTRAT-225":["INFERENG Midstream"],"RHAISTRAT-220":["INFERENG Midstream"],"RHAISTRAT-218":["INFERENG Midstream"],"RHAISTRAT-217":["INFERENG Midstream"],"RHAISTRAT-216":["INFERENG MLR","INFERENG Model Optimizations"],"RHAISTRAT-206":["RHAI Agentic API"],"RHAISTRAT-196":["RHAI Agentic API"],"RHAISTRAT-193":["AIP Training Ray","RHOAI Dashboard"],"RHAISTRAT-189":["RHAI AgentOps"],"RHAISTRAT-180":["AIP Feature Store"],"RHAISTRAT-174":["Crimson Planning (Dashboard)","RHAI Crimson","RHAI Serving Orchestration","RHOAI Dashboard","Zaffre Planning (Dashboard)"],"RHAISTRAT-172":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-163":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-162":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-150":["RHAI Razzmatazz","RHOAI Dashboard"],"RHAISTRAT-149":["AI Core Platform","AIP Kubeflow-DevX","AIP Training Kubeflow","RHOAI Dashboard"],"RHAISTRAT-148":["AIP Kubeflow-DevX","AIP Training Kubeflow"],"RHAISTRAT-146":["INFERENG Midstream"],"RHAISTRAT-143":["INFERENG Midstream"],"RHAISTRAT-134":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-133":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-132":["Crimson Planning (Dashboard)","RHAI Crimson"],"RHAISTRAT-113":["RHOAI Dashboard"],"RHAISTRAT-100":["RHAI AgentOps"],"RHAISTRAT-97":["RHAI Agentic API"],"RHAISTRAT-92":["RHAI Agentic API"],"RHAISTRAT-82":["RHOAI Trusty AI"],"RHAISTRAT-62":["RHAI Tooling Experience"],"RHAISTRAT-24":["RHAI AgentDev"],"RHAISTRAT-20":["RHAI AgentDev"],"RHAISTRAT-13":["RHAI AgentOps"]};

  // Component throughput: John Graham component-team-capacity-v2.html (2026-08-12)
  // Source: project in (RHAISTRAT,RHOAIENG,RHAIENG,INFERENG,AIPCC) AND status in ('Resolved','Closed')
  // avg_when_active = avg issues closed per planning cycle (EA1/EA2/GA) when component was active.
  // Tier: ≥20 → +5, ≥8 → +3, ≥3 → 0, <3 → −3, unknown → 0.
  const COMP_AVG_ACTIVE = {
    'Notebooks Images':           80.5,
    'TestOps':                    50.8,
    'AI Core Dashboard':          35.8,
    'Gen AI Studio':              25.2,
    'AI Evaluations':             21.3,
    'Training Kubeflow':          18.6,
    'AI Safety':                  18.0,
    'Model as a Service':         14.2,
    'AutoML':                     14.0,
    'AI Pipelines':               12.6,
    'AutoRAG':                    12.2,
    'Documentation':              12.0,
    'Serving Orchestration':      11.0,
    'Model Runtimes':             10.2,
    'Data Processing':             9.5,
    'DevOps':                      9.2,
    'OGX Core':                    9.0,
    'AI Core Platform':            7.6,
    'AI Hub':                      7.3,
    'Notebooks Server':            7.2,
    'Feature Store':               7.1,
    'IBM P':                       6.7,
    'AI Safety Orchestration':     6.0,
    'llm-d':                       5.8,
    'MLflow':                      5.1,
    'AgentOps':                    5.0,
    'KubeRay':                     4.4,
    'Fine Tuning':                 3.3,
    'Security':                    3.0,
    'AI Core Platform Security':   3.0,
    'UXD':                         3.0,
    'Inference Gateway':           3.0,
    'OCPMCPLO':                    3.0,
    'Kubeflow Spark Operator':     2.0,
    'Build and Release':           2.0,
    'AI Guardrails':               2.0,
    'IBM Z':                       2.0,
    'Workload Orchestration':      2.0,
    'Notebooks Extensions':        1.5,
    'OpenShift AI Productization': 1.0,
    'PXE':                         1.0,
  };

  function capacityPenalty(comps, evt){
    const over = comps.filter(c=>{
      const cap=(CAP[c]||{})[evt];
      return cap>0 && (usedComp[evt][c]||0)>=cap;
    });
    return {
      penalty: over.length * 10,
      warn: over.length ? ` ⚠ over ceiling: ${over.join(', ')}` : ''
    };
  }

  function compTier(avg){
    if(avg === undefined || avg === null) return 0;
    if(avg >= 20) return 5;
    if(avg >= 8)  return 3;
    if(avg >= 3)  return 0;
    return -3;
  }

  function componentBoost(comps){
    if(!comps.length) return {boost:0, signal:''};
    const entries = comps.map(c=>({c, d:COMP_AVG_ACTIVE[c]}));
    const best = entries.reduce((a,b)=>compTier(a.d)>=compTier(b.d)?a:b);
    const tier = compTier(best.d);
    const label = best.d !== undefined
      ? `~${best.d} issues/cycle`
      : 'no data';
    const signal = tier !== 0 ? ` · ${best.c} ${label}` : '';
    return {boost: tier, signal};
  }

  // ── Pre-filter: hard gates → No ──
  rows.forEach(r=>{
    r._comps = (esc(r['Components'])||'').split(';').map(x=>x.trim()).filter(Boolean);
    r._team  = (esc(r['Team'])||'').trim();
    r._teams = FEATURE_TEAM_LOOKUP[esc(r['Key'])] || null; // Erle's capacity-dataset: Jira Team field teams
    const fpdorStr = typeof r['FPDoR'] === 'string' ? r['FPDoR'] : (r['FPDoR']?.passedCount + '/' + r['FPDoR']?.totalCount || '0/17');
    r._fNum  = parseInt((fpdorStr||'0').split('/')[0])||0;
    r._score = parseInt(r['Score'])||0;
    r._committed = (r['Confidence']||'').toLowerCase()==='committed';
    r._tv = (esc(r['Target Versions'])||'').trim();
    r._fv = (esc(r['Fix Version'])||'').trim();
    r._failedItems = (r['Failed FPDoR Items']||'').split(';').map(x=>x.trim()).filter(Boolean);
    r._preferredEvt = detectEvt(r._tv.toLowerCase()) || detectEvt(r._fv.toLowerCase());
    // Weighted FPDoR score (0–100): penalise each failed item by its tier weight
    const wPenalty = r._failedItems.reduce((sum,item)=>sum+(FPDOR_WEIGHTS[item]||3),0);
    r._wFPDoR = Math.max(0, 100 - wPenalty);
    // Erle's weighted tier risk (CRITICAL/HIGH/MEDIUM/SOFT → HIGH/MEDIUM/LOW)
    const _riskResult = computeFPDoRRisk(r);
    r._riskLevel = _riskResult.riskLevel;
    r._riskFails = _riskResult;
    // Arjay's feature sizing (component count → Fibonacci pts)
    const _nComps=(esc(r['Components'])||'').split(';').filter(c=>c.trim()).length;
    r._featurePts=_nComps>=3?13:_nComps===2?8:_nComps===1?5:3;
    r._featureSize=_nComps>=3?'XL':_nComps===2?'L':_nComps===1?'M':'S';

    // Read labels from CSV if the column exists (requires Labels column in Org Pulse export)
    // Without it we fall back to heuristic detection
    const rawLabels = (esc(r['Labels'])||'').split(';').map(x=>x.trim()).filter(Boolean);
    r._labels = new Set(rawLabels);

    // Label shortcuts per Erle's FPDoR definition:
    const hasQG1Pass      = r._labels.has('rp-qg1-pass');
    const hasRubricPass   = r._labels.has('strat-creator-rubric-pass');
    const hasHumanSignoff = r._labels.has('strat-creator-human-sign-off');
    const hasAutoCreated  = r._labels.has('strat-creator-auto-created');
    const hasEpicDecomp   = r._labels.has('epic-creator-auto-decomposed');

    // PATH detection — real if Labels column present, heuristic fallback otherwise
    const hasLabelData = esc(r['Labels']) !== undefined;
    r._hasLabelData = hasLabelData;
    if(hasLabelData){
      r._path = (hasQG1Pass||hasRubricPass||hasHumanSignoff||hasAutoCreated||hasEpicDecomp) ? 'ai-first' : 'legacy';
    } else {
      r._path = (r._fNum===13 && r._failedItems.length===0) ? 'ai-first' : 'legacy';
    }

    // Confidence contribution from each label (stacks, capped later):
    // rp-qg1-pass   = +10  (full mandatory bundle confirmed)
    // rubric-pass   = +5   (AC, requirements, risks, architecture confirmed)
    // human-signoff = +5   (requirements, risks, architecture, human approval confirmed)
    // epic-decomp   = +3   (cross-team deps + child epics confirmed)
    r._labelBoost = (hasQG1Pass?10:0) + (hasRubricPass?5:0) + (hasHumanSignoff?5:0) + (hasEpicDecomp?3:0);

    // Fix Version signal — weak only (per Erle 2026-08-06: FV not reliable until PM+Eng approval workflow exists)
    // FV matches TV event → +5%, FV mismatches TV event → -10%, FV absent → 0
    const fvEvt = r._fv ? detectEvt(r._fv.toLowerCase()) : null;
    const tvEvt = detectEvt(r._tv.toLowerCase());
    r._fvBoost = fvEvt && tvEvt ? (fvEvt===tvEvt ? 5 : -10) : 0;

    // Priority boost — calibrated from 3.4 features.json delivery rates:
    // Blocker 50%, Major 42%, Normal 40%, Critical 34%, Undefined 0%
    // Major and Normal outperformed Critical — teams over-label Critical.
    // Blocker: +5, Major: +2, Normal: 0, Critical: −2, Undefined: −5
    const pri = (esc(r['Priority'])||'').trim().toLowerCase();
    r._priorityBoost = pri==='blocker'?5 : pri==='major'?2 : pri==='normal'?0 : pri==='critical'?-2 : pri==='minor'?-3 : pri===''?-5 : 0;
    r._priorityLabel = pri ? esc(r['Priority']).trim() : '';

    // PM Committed signal — explicit PM endorsement. In 3.4, committed features had higher delivery rates.
    // Currently parsed (_committed) but was unused. Now +5%.
    r._committedBoost = r._committed ? 5 : 0;

    // RICE Score signal — features with RICE > 20 were better-scoped and had better delivery rates.
    // Score > 20: +2, Score 5–20: +1, missing/0: 0
    r._riceBoost = r._score > 20 ? 2 : r._score >= 5 ? 1 : 0;

    // Release Type: read from CSV 'Release Type' column (PR #1394 merged 2026-08-12).
    // Fallback to title prefix [DP]/[TP]/[GA] for older exports without the column.
    // Aug 10 meeting decision (Erle, Yuval, John): DP → +8%, TP → +5%, GA → 0%.
    const rtField = (esc(r['Release Type'])||'').trim().toUpperCase();
    const rtMatch = !rtField ? (esc(r['Title'])||'').match(/^\[(DP|TP|GA)\]|^(Dev Preview|Tech Preview|General Availability)\b/i) : null;
    const rtFromTitle = rtMatch ? (rtMatch[1]||rtMatch[2]||'').toUpperCase() : null;
    const rtNorm = rtFromTitle==='DEV PREVIEW'?'DP':rtFromTitle==='TECH PREVIEW'?'TP':rtFromTitle==='GENERAL AVAILABILITY'?'GA':rtFromTitle;
    r._releaseType = rtField || rtNorm;
    r._releaseTypeBoost = r._releaseType==='DP' ? 8 : r._releaseType==='TP' ? 5 : 0;

    // Big Rock membership — match Outcome against known Big Rock keyword sets
    r._bigRocks = BIG_ROCKS.filter(br=>br.keywords.some(k=>(esc(r['Outcome'])||'').toLowerCase().includes(k))).map(br=>br.name);
    r._isBigRock = r._bigRocks.length > 0;
    // Roadmap outcome fallback — use explicit Big Rock label from RHAI-Roadmap.html when keyword match misses
    const _rm=ROADMAP_OUTCOMES[esc(r['Key'])];
    if(_rm){r._roadmapBigRock=_rm.br;r._roadmapRc=_rm.rc;}
    if(!r._isBigRock&&r._roadmapBigRock){r._bigRocks=[r._roadmapBigRock];r._isBigRock=true;}
    // Complexity warning — 6+ components signals cross-team dependency risk (spec: not an exclusion)
    r._complexityWarn = r._comps.length >= 6;

    // rp-qg1-pass satisfies ALL mandatory FPDoR fields as a bundle — skip hard gate
    if(hasQG1Pass){
      // Mandatory fields satisfied by label — skip to scheduling
    } else {
      if(!r._comps.length){
        r._place='No'; r._reason='No components assigned'; r._conf=0; return;
      }
      const hardFail = r._failedItems.find(i=>FPDOR_MANDATORY_HARD.includes(i));
      if(hardFail){
        r._place='No'; r._reason=`Mandatory FPDoR field missing: ${hardFail}`; r._conf=0; return;
      }
    }

    if(!r._tv){
      r._place='No'; r._reason='No Target Version set'; r._conf=0; return;
    }
    if(/^rhoai-|^rhaii-/i.test(r._tv)){
      r._place='No'; r._reason=`Non-standard Target Version: "${r._tv}" — set to standard format to qualify`; r._conf=5; return;
    }
    if(!r._preferredEvt){
      r._place='No'; r._reason='Target Version does not map to EA1/EA2/GA'; r._conf=5; return;
    }
    r._place=null; // eligible for scheduling
  });

  // Historical delivery rate caps — from 3.4 all-features baseline (Erle, Aug 2026).
  // EA1: 10/10 delivered (100% actual → 75% conservative cap)
  // EA2: 9/14 delivered (64% actual → 60% cap)
  // GA:  22/78 delivered (28% actual → 40% cap)
  // NOTE: Erle's 3.5 sealed data (2026-08-12, n=205, tv+fv committed at freeze) shows
  // EA2=83% (15/18) · GA=92% (88/96) for properly-committed features.
  // RF+ROS v3 trained on 3.4+3.5 combined (2026-08-18, AUC=91.8%, 5-fold CV). Inference run on
  // 3.6 EA1 freeze baseline (70 features) → ML_SCORES below. Old caps still apply as
  // fallback for features not in the ML set.
  const HIST_CAP = {EA1:75, EA2:60, GA:40};

  // ── Single phase: delivery confidence classifier ──
  // Goal: how likely is this feature to ship in its requested Target Version event?
  // Fix Version is NOT a primary signal (per Erle 2026-08-06 — unreliable until approval workflow).
  // Confidence = readiness base + label boosts + FV signal + component reliability - capacity penalty
  // Capped by historical delivery rate per event.
  // Phase 2: Big Rocks scheduled first (global leadership priorities), then remaining by score.
  // Within each tier (BR / non-BR), sort descending by priority score.
  rows.filter(r=>r._place===null)
      .sort((a,b)=>{
        if(a._isBigRock&&!b._isBigRock) return -1;
        if(!a._isBigRock&&b._isBigRock) return 1;
        return b._score-a._score;
      })
      .forEach(r=>{
        const pref = r._preferredEvt;
        const order = pref==='EA1'?['EA1','EA2','GA']:
                      pref==='EA2'?['EA2','GA']:['GA'];
        const {boost:compBonus, signal:compSignal} = componentBoost(r._comps);
        const extraBoosts = r._priorityBoost + r._committedBoost + r._riceBoost + r._releaseTypeBoost;
        const extraSignal = [
          r._committedBoost ? ' · PM committed' : '',
          r._priorityLabel && r._priorityBoost !== 0 ? ` · ${r._priorityLabel} priority (${r._priorityBoost>0?'+':''}${r._priorityBoost}%)` : '',
          r._riceBoost ? ` · RICE ${r._score}` : '',
          r._releaseType ? ` · ${r._releaseType}` : '',
        ].join('');

        let placed=false;
        for(const evt of order){
          const {penalty,warn} = capacityPenalty(r._comps,evt);
          const boost = r._labelBoost + r._fvBoost + compBonus + extraBoosts - penalty;
          if(evt===pref){
            if(r._wFPDoR>=85){
              r._place=evt; r._reason=`High readiness (${r['FPDoR']} · w:${r._wFPDoR}) + ${evt} target${compSignal}${extraSignal}${warn}`;
              r._conf=Math.max(0,Math.min(HIST_CAP[evt]||96,(r._wFPDoR>=95?72:62)+boost));
            } else if(r._wFPDoR>=60&&evt!=='EA1'){
              r._place=evt; r._reason=`Moderate readiness (${r['FPDoR']} · w:${r._wFPDoR}) + ${evt} target${compSignal}${extraSignal}${warn}`;
              r._conf=Math.max(0,Math.min(HIST_CAP[evt]||96,48+boost));
            } else if(r._wFPDoR>=60&&evt==='EA1'){
              continue;
            } else {
              break;
            }
          } else {
            if(r._wFPDoR>=60){
              r._place=evt; r._reason=`Readiness gap → moved to ${evt} (target was ${pref})${compSignal}${extraSignal}${warn}`;
              r._conf=Math.max(0,Math.min(HIST_CAP[evt]||96,38+boost));
            } else break;
          }
          addUsage(r._comps,r._team,evt);
          placed=true; break;
        }
        if(!placed){
          r._place='No';
          r._reason=`Readiness too low (${r['FPDoR']} · w:${r._wFPDoR}) — fix: ${r._failedItems.slice(0,2).join(', ')||'see FPDoR items'}`;
          r._conf=10;
        }
      });

  // ML scoring — pre-computed RF+ROS for 70 EA1-freeze features, JS approximation for all others.
  // Pre-computed: trained on RHOAI 3.4+3.5 (AUC=91.8%), includes slip history signal (53% of weight).
  // Approx: all other in-plan features — uses FPDoR+RICE+priority only (no slip history, ~43% weight).
  rows.forEach(r=>{
    if(!r._place||r._place==='No') return;
    const mlScore=ML_SCORES[esc(r['Key'])];
    if(mlScore!==undefined){
      const isReal=ML_REAL_KEYS.has(esc(r['Key']));
      // CSV-imputed scores: slip_count=0 → model over-optimistic by ~15pts. Cap at 85.
      r._rawMlScore=Math.round(mlScore);
      if(isReal){
        r._conf=Math.min(95,r._rawMlScore);
      } else {
        // FPDoR-completeness penalty: restores differentiation erased by the 85% cap.
        // Features with incomplete FPDoR (e.g. 9/17) score below the cap even when raw ML >= 85.
        const fpdorStr2 = typeof r['FPDoR'] === 'string' ? r['FPDoR'] : (r['FPDoR']?.passedCount + '/' + r['FPDoR']?.totalCount || '0/17');
        const fpdorDen=parseInt((fpdorStr2||'0/17').split('/')[1])||17;
        const fpdorRatio=fpdorDen>0?r._fNum/fpdorDen:1;
        const fpdorPenalty=Math.round((1-fpdorRatio)*15);
        r._conf=Math.max(Math.min(85,r._rawMlScore)-fpdorPenalty,20);
      }
      r._reason=r._reason+(isReal?' · 🤖 ML':' · ~ML');
      r._mlType=isReal?'ml':'approx';
    } else {
      r._conf=computeApproxMLScore(r);
      r._reason=r._reason+' · ~ML';
      r._mlType='approx';
    }
  });

  return rows;
}

// ---- detectEvt: index.html lines 2902-2910 ----
export function detectEvt(s){
  if(s.includes('ea1')) return 'EA1';
  if(s.includes('ea2')) return 'EA2';
  // 3.7 onwards ships a single EA rather than EA1/EA2. Word-bounded so the "ea"
  // inside "release" cannot match. Treated as the first early-access checkpoint.
  if(/\bea\b/.test(s)) return 'EA1';
  if(/ ga /.test(s)||s.endsWith(' ga')||s.includes('ga release')||s.includes('ga rhaii')||s.includes('ga rhelai')) return 'GA';
  return null;
}

// ---- classifyFeature: index.html lines 3991-4000 ----
export function classifyFeature(r){
  const title=(esc(r['Title'])||'').toLowerCase();
  const labels=(esc(r['Labels'])||'').toLowerCase();
  if(r._bigRocks&&r._bigRocks.some(n=>/stabiliz|quality.and.cohesion|remediat/i.test(n))) return 'bugs';
  if(/bug|hotfix|tech.?debt|z-stream|stabiliz|remediat/.test(labels)) return 'bugs';
  if(/\bbug fix\b|hotfix|tech debt|stabiliz|remediat/.test(title)) return 'bugs';
  if(/spike|research|learning|\bpoc\b|proof.of.concept|investig/.test(labels)) return 'research';
  if(/\bspike\b|\bpoc\b|proof.of.concept/.test(title)) return 'research';
  return 'features';
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1b additions (Feature Scheduling UI conversion). Same extraction rules
// as stage 1a: byte-faithful to index.html where noted, DOM/window reads
// replaced by explicit parameters where the original read them from the page.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source: index.html lines 2961-2986 -- the `ai-planner-data` postMessage handler's
 * per-feature mapping, run just before schedule(). AIPlanner.vue already fetches
 * GET /modules/releases/planning/ai-planner and posts exactly this `features` array
 * shape to the iframe; this native composable fetches the same endpoint and applies
 * the same mapping instead of relying on postMessage.
 *
 * KNOWN QUIRKS, preserved as-is (not fixed, matching current production behavior):
 *  - `_conf: parseInt(f.Confidence)||0` -- f.Confidence is a word like "committed"
 *    or "not-ready", so parseInt always yields NaN -> 0. schedule() overwrites
 *    `_conf` anyway, so this placeholder value is never actually used downstream.
 *  - There is no `Score` key in the mapped object (only `RICE`), but schedule()'s
 *    pre-filter step reads `r['Score']` for `_score` (the RICE-boost signal) --
 *    so `_score` is always 0 for API-sourced rows and the RICE boost is inert.
 *    This matches index.html's live-data path exactly; it is a pre-existing gap,
 *    not introduced by this extraction.
 *  - The real API response (modules/releases/server/planning/ai-planner/storage.js
 *    `projectSnapshot`) does not include Team, Outcome, Labels,
 *    "Failed FPDoR Items", "Fix Version", or "Release Type" -- those fields come
 *    through as '' for every API-sourced row, in both index.html and here.
 */
export function mapApiFeatureToRow(f) {
  return {
    'Rank': f.Rank || '',
    'Key': f.Key || '',
    'Title': f.Summary || f.Title || '',
    'Components': (f.Components || []).join('; '),
    'Team': f.Team || '',
    'Priority': f.Priority || '',
    'Outcome': f.Outcome || '',
    'OutcomeNumber': f.OutcomeNumber || '—',
    'Target Versions': f.PlannedFor || '',
    'RICE': f.Score || 0,
    'FPDoR': f.FPDoR || '0/17',
    'Failed FPDoR Items': f['Failed FPDoR Items'] || '',
    'Confidence': f.Confidence || 'not-ready',
    'Labels': f.Labels || '',
    'Fix Version': f['Fix Version'] || '',
    'Release Type': f['Release Type'] || '',
    'PM': f.PM || '',
    'Assignee': f.DeliveryOwner || '',
    'PlannedFor': f.PlannedFor || '3.6 GA',
    '_conf': parseInt(f.Confidence) || 0,
    '_place': f.PlannedFor || 'Unknown',
    '_riskLevel': f.riskLevel || 'Medium'
  }
}

// Source: index.html lines 3492-3517 (run()'s per-column sort comparator).
// `sortCol`/`sortAsc` were outer closures in index.html; here they're explicit
// parameters. Returns a new array (same as the original's `rows=rows.slice().sort(...)`).
export function sortFeatures(rows, sortCol, sortAsc) {
  return rows.slice().sort((a, b) => {
    let va=a[sortCol],vb=b[sortCol];
    if(sortCol==='Score'||sortCol==='Rank'){va=+va;vb=+vb;}
    else if(sortCol==='OutcomeNumber'){
      // Handle em-dash (—) for features without outcomes
      const isEmDashA = va === '—' || va === null || va === undefined;
      const isEmDashB = vb === '—' || vb === null || vb === undefined;

      // If both are em-dash, keep original order
      if(isEmDashA && isEmDashB) return 0;
      // If only A is em-dash, send to end
      if(isEmDashA) return 1;
      // If only B is em-dash, send to end
      if(isEmDashB) return -1;

      // Both have outcome numbers - compare numerically
      va = parseInt(va) || Infinity;
      vb = parseInt(vb) || Infinity;
    }
    else if(sortCol==='FPDoR'){
      const vaStr = typeof va === 'string' ? va : (va?.passedCount + '/' + va?.totalCount || '0');
      const vbStr = typeof vb === 'string' ? vb : (vb?.passedCount + '/' + vb?.totalCount || '0');
      va=parseInt((vaStr||'0').split('/')[0]);vb=parseInt((vbStr||'0').split('/')[0]);
    }
    return sortAsc?(va>vb?1:-1):(va<vb?1:-1);
  });
}

// Source: index.html lines 3520-3527 (run()'s "No" row sub-tiering for the 3-tier
// below-the-line display). Mutates `_noTier` on each "No" row, same as the
// original; rows not placed "No" are left untouched. Returns `rows` for convenience.
export function assignNoTier(rows) {
  rows.filter(r=>r._place==='No').forEach(r=>{
    const hasTv=!!(r._tv);
    const hasComps=!!(esc(r['Components'])||'').trim();
    const wFP=r._wFPDoR||0;
    if(!hasTv||!hasComps||wFP<20){r._noTier=3;return;}  // insufficient info — can't analyze
    if(wFP>=55){r._noTier=2;return;}                      // has data but capacity/risk keeps below cut
    r._noTier=1;                                           // missing some analysis fields, PM can fix
  });
  return rows;
}

// Source: index.html lines 3531-3542 (run()'s placement-based grouping, skipped
// when sorting by OutcomeNumber so that sort order is preserved instead).
export function applyPlacementGrouping(rows, sortCol) {
  if (sortCol === 'OutcomeNumber') return rows;
  const PLACE_ORDER={'EA1':0,'EA2':1,'GA':2,'No':3};
  return rows.slice().sort((a,b)=>{
    const pg=(PLACE_ORDER[a._place]??3)-(PLACE_ORDER[b._place]??3);
    if(pg!==0) return pg;
    if(a._place==='No'&&b._place==='No'){
      const tg=(a._noTier||1)-(b._noTier||1);
      if(tg!==0) return tg;
    }
    return (b._conf||0)-(a._conf||0);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1c additions (Roadmap tab). Same extraction rules as before.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source: index.html lines 3287-3313 (renderRoadmapTimeline()'s outcome × release-phase
 * aggregation). HTML table building and the click-to-drilldown popover (the rest of
 * renderRoadmapTimeline, plus showRoadmapDrilldown) are view-layer and stay in Vue.
 *
 * NOT ported: index.html prefers a live ~22-outcome list fetched separately
 * (window.outcomeData from GET /ai-planner/outcomes) over BIG_ROCKS when available.
 * That fetch-and-prefer branch isn't reproduced here; `outcomes` always falls back to
 * the BIG_ROCKS-derived shape ({key, title, outcomeNumber: 0}) index.html itself uses
 * before that fetch resolves (or when it fails). Pass a real outcomes list in to get
 * the live-equivalent behavior once that API is wired up.
 *
 * KNOWN GAP, preserved as-is: `r['Status']` is never populated on API-sourced rows --
 * mapApiFeatureToRow() (this file) doesn't map it, matching index.html's own
 * `ai-planner-data` postMessage mapping, which also omits it. So `done`/`wip` are
 * always false for live data and every in-grid feature counts as "not started".
 */
export function aggregateRoadmapGrid(rows, outcomes) {
  const phases = ['EA1','EA2','GA'];
  const list = outcomes || BIG_ROCKS.map(br => ({ key: br.name, title: br.name, outcomeNumber: 0 }));
  const grid = {};
  list.forEach(o=>{
    const name = o.key || o.name;
    grid[name]={EA1:{c:0,s:0,done:0,wip:0,feats:[]},EA2:{c:0,s:0,done:0,wip:0,feats:[]},GA:{c:0,s:0,done:0,wip:0,feats:[]},No:{c:0,s:0,done:0,wip:0,feats:[]}};
  });
  rows.forEach(r=>{
    const outcomeKey = r['Outcome'] || (r._bigRocks && r._bigRocks[0]);
    if(!outcomeKey) return;
    const ph = phases.includes(r._place) ? r._place : 'No';
    const st = (r._status||esc(r['Status'])||'').toLowerCase();
    const done = /done|closed|released|release pending/.test(st);
    const wip  = /in progress|review|testing/.test(st);
    if(grid[outcomeKey]){
      grid[outcomeKey][ph].c++;
      grid[outcomeKey][ph].s += (r._conf||0);
      if(done) grid[outcomeKey][ph].done++;
      else if(wip) grid[outcomeKey][ph].wip++;
      grid[outcomeKey][ph].feats.push({key:esc(r['Key'])||'',title:(esc(r['Title'])||esc(r['Summary'])||''),conf:Math.round(r._conf||0)});
    }
  });
  const rowsOut=[];
  list.forEach(o=>{
    const name = o.key || o.name;
    const g=grid[name];
    if(!g) return;
    const total=phases.reduce((s,p)=>s+g[p].c,0)+g.No.c;
    if(!total) return;
    rowsOut.push({ name, displayName: o.title || o.key || name, phases: g, total });
  });
  return rowsOut;
}

// Source: index.html line 3314 (renderRoadmapTimeline()'s cell background banding).
export function roadmapCellColor(count, avgConf) {
  if(!count) return '#fafafa';
  if(avgConf>=70) return '#e8f5e9';
  if(avgConf>=50) return '#fff8e1';
  return '#ffebee';
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1c additions (Executive tab). Same extraction rules as before. As of this
// extraction, production (PR #1877, not yet merged) is relocating the Roadmap
// tab's EA1/EA2/GA/No summary cards + release selector into Executive and
// dropping Roadmap entirely (it duplicated Executive's outcomes table) -- those
// cards are already covered by the `placementCounts`-style aggregation from
// stage 1b, not re-extracted here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source: index.html lines 4371-4377 (renderExecView()'s delivery-confidence
 * tile). `confColor` is a 3-way color ramp -- left to the Vue layer, same as
 * the placement/risk color maps in FeatureSchedulingRow.vue, since it's pure
 * presentation with no independent business meaning beyond confLabel's bands.
 */
export function computeDeliveryConfidenceSummary(rows) {
  const inPlan = rows.filter(r=>r._place!=='No');
  const total = rows.length;
  const totalInPlan = inPlan.length;
  const avgConf = totalInPlan>0 ? Math.round(inPlan.reduce((s,r)=>s+(r._conf||0),0)/totalInPlan) : 0;
  const confLabel = avgConf>=70?'On Track':avgConf>=50?'At Risk':'Critical';
  return { total, totalInPlan, avgConf, confLabel };
}

// Source: index.html lines 4396-4408 (renderExecView()'s "Work Mix (In-Plan)"
// panel) -- in-plan feature counts by classifyFeature() bucket, each measured
// against its target share. HTML/color/label strings stay in the Vue layer.
const WORK_MIX_TARGETS = { features: 40, bugs: 40, research: 20 };
export function computeWorkMix(rows) {
  const inPlan = rows.filter(r=>r._place!=='No');
  const counts = { features:0, bugs:0, research:0 };
  inPlan.forEach(r=>counts[classifyFeature(r)]++);
  const totalInPlan = inPlan.length;
  return ['features','bugs','research'].map(key=>{
    const pct = totalInPlan ? Math.round(counts[key]/totalInPlan*100) : 0;
    const target = WORK_MIX_TARGETS[key];
    return { key, count: counts[key], pct, target, onTarget: Math.abs(pct-target)<=5 };
  });
}

// Source: index.html lines 4160-4162 (renderBigRocks()'s "Aha! OKR thresholds"
// status label for the outcomes table/tiles) -- ≥70% avg confidence = Confident,
// 40-69% = Lagging, else At Risk; an outcome with nothing in-plan yet is its own
// label rather than a 0%-confidence "At Risk".
export function bigRockStatusLabel(inPlanCount, avgConf) {
  if(!inPlanCount) return 'No features in plan';
  if(avgConf>=70) return 'Confident';
  if(avgConf>=40) return 'Lagging';
  return 'At Risk';
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1c additions (Data Appendix tab). Same extraction rules as before.
// renderAppendix() (index.html lines 3873-3989) is mostly HTML-string building
// around four small aggregations; each is pulled out below as structured data,
// HTML/color/label strings left to the Vue layer.
// ─────────────────────────────────────────────────────────────────────────────

// Source: index.html lines 3874-3899 (Component Capacity table).
export function computeComponentCapacityUsage(rows) {
  const usedC = {};
  rows.forEach(r=>{
    if(r._place==='No') return;
    (esc(r['Components'])||'').split(';').forEach(c=>{
      c=c.trim(); if(!c) return;
      if(!usedC[c]) usedC[c]={EA1:0,EA2:0,GA:0};
      if(usedC[c][r._place]!==undefined) usedC[c][r._place]++;
    });
  });
  const allC=[...new Set([...Object.keys(CAP),...Object.keys(usedC)])].sort();
  return allC.map(c=>{
    const cap=CAP[c]||{EA1:1,EA2:1,GA:1};
    const used=usedC[c]||{EA1:0,EA2:0,GA:0};
    const over=used.EA1>cap.EA1||used.EA2>cap.EA2||used.GA>cap.GA;
    return { component:c, cap, used, over };
  });
}

// Source: index.html lines 3901-3926 (Team — Features In-Plan vs p75 Capacity
// table). BOTTLENECK_TEAMS keeps Dashboard/Docs teams pinned to the top of the
// list (John Graham, Aug 24: they set the EA2 system ceiling).
const BOTTLENECK_TEAMS = ['documentation','doc ','docs ','dashboard'];
function isBottleneckTeam(t) { return BOTTLENECK_TEAMS.some(b=>t.toLowerCase().includes(b)); }
export function computeTeamCapacityUsage(rows) {
  const usedT = {};
  rows.forEach(r=>{
    if(r._place==='No') return;
    const t=(esc(r['Team'])||'').trim();
    if(t){
      if(!usedT[t]) usedT[t]={EA1:0,EA2:0,GA:0};
      if(usedT[t][r._place]!==undefined) usedT[t][r._place]++;
    }
  });
  const allT=[...new Set(Object.keys(usedT))].sort((a,b)=>{
    if(isBottleneckTeam(a)&&!isBottleneckTeam(b)) return -1;
    if(!isBottleneckTeam(a)&&isBottleneckTeam(b)) return 1;
    return a.localeCompare(b);
  });
  return allT.map(t=>{
    const used=usedT[t]||{EA1:0,EA2:0,GA:0};
    return { team:t, used, total: used.EA1+used.EA2+used.GA, isBottleneck: isBottleneckTeam(t), isDoc: /doc/i.test(t) };
  });
}

// Source: index.html lines 3928-3957 (Exclusion Breakdown (No) table). Group
// order mirrors the original if/else-if chain -- a row matches the first
// applicable reason, falling through to "other" only if none match.
const EXCLUSION_GROUPS = [
  { key:'No Target Version',     label:'Assign a Target Version',     match: rs=>rs.includes('No Target Version')||rs.includes('No components') },
  { key:'Mandatory FPDoR field', label:'Fill mandatory FPDoR fields',  match: rs=>rs.includes('Mandatory FPDoR') },
  { key:'Non-standard',          label:'Fix Target Version format',   match: rs=>rs.includes('Non-standard')||rs.includes('does not map') },
  { key:'Readiness too low',     label:'Complete FPDoR checklist',    match: rs=>rs.includes('Readiness too low')||rs.includes('Moderate readiness')||rs.includes('w:') },
];
export function computeExclusionBreakdown(rows) {
  const noRows = rows.filter(r=>r._place==='No');
  const groups = {};
  EXCLUSION_GROUPS.forEach(g=>{ groups[g.key] = { key:g.key, label:g.label, rows:[] }; });
  groups.other = { key:'other', label:'Other / review reason', rows:[] };
  noRows.forEach(r=>{
    const rs = r._reason||'';
    const matched = EXCLUSION_GROUPS.find(g=>g.match(rs));
    (matched ? groups[matched.key] : groups.other).rows.push(r);
  });
  return Object.values(groups)
    .filter(g=>g.rows.length>0)
    .sort((a,b)=>b.rows.length-a.rows.length);
}

// Source: index.html lines 3959-3988 (FPDoR Field Failure Breakdown table) --
// which specific mandatory fields are blocking the most "No"-placed features.
export function computeFpdorFieldBreakdown(rows) {
  const noRows = rows.filter(r=>r._place==='No');
  const fpdorRows = noRows.filter(r=>(r._reason||'').includes('Mandatory FPDoR'));
  const fieldCounts = {};
  fpdorRows.forEach(r=>{
    const m=(r._reason||'').match(/missing:\s*(.+?)(\s*·|$)/i);
    const field=m?m[1].trim():'Unknown field';
    fieldCounts[field]=(fieldCounts[field]||0)+1;
  });
  const sorted=Object.entries(fieldCounts).sort((a,b)=>b[1]-a[1]);
  const maxCount=sorted[0]?sorted[0][1]:1;
  return sorted.map(([field,count])=>({ field, count, pct: Math.round(count/maxCount*100) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1c corrections (Nov 10/11): PR #1877 (fix/ai-planner-csv-export-roadmap-
// removal, not yet merged to main) re-adds an Export CSV button to Feature
// Scheduling and makes the FPDoR breakdown hover-only instead of permanent
// inline pills. Extracted read-only from that branch (commits a43241d9,
// 2f97e1d6) without merging/rebasing onto it, per instructions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Source: index.html lines 3661-3678 (renderTbl()'s FPDoR hover tooltip, as of
 * PR #1877 -- the breakdown is hover-only now; the inline <span class="fd-item">
 * pills that used to sit under the w-score were removed).
 */
export function buildFpdorTooltip(r) {
  const failedSet = new Set(r._failedItems);
  const hasFpdorData = r['FPDoR'] && r['FPDoR'] !== '—';
  const tooltipLines = ['Weighted FPDoR: '+r._wFPDoR+'/100', ''];
  // 7-item FPDoR checklist (Nov 24 2026): Target Version, Feature Human Signoff, Components,
  // PM, Assignee, Release Type, Product Documentation Required
  if(failedSet.size > 0) {
    tooltipLines.push('✗ Missing: '+Array.from(failedSet).join(', '));
  } else if(hasFpdorData) {
    tooltipLines.push('✓ All criteria met');
  }
  return tooltipLines.join('\n');
}

/**
 * Source: index.html's doExport() as of PR #1877 commit 2f97e1d6 (final form --
 * an earlier revision in the same PR used esc() for CSV cells, which produced
 * HTML entities like &amp; instead of & in exported text; that was corrected
 * to a CSV-only quote escaper before doExport() shipped). Returns the CSV text;
 * triggering the browser download is left to the Vue layer (DOM side effect),
 * same split as index.html.doExport() being Blob/anchor glue around this logic.
 */
export function buildFeatureSchedulingCsv(rows) {
  function csvQ(v){ const s=v==null?'':String(v); return '"'+s.replace(/"/g,'""')+'"'; }
  const hdr=['Rank','Key','Title','FPDoR','Weighted FPDoR','Readiness Issues','Risk','Target Versions','Fix Version','Components','Team','Priority','Confidence','Placement','Confidence%','PM','Outcome'];
  const lines=[hdr.join(','),...rows.map(r=>{
    const failedSet=new Set(r._failedItems);
    const issues=Array.from(failedSet).join('; ');
    return [
      r['Rank'],r['Key']||'',csvQ(r['Title']),r['FPDoR'],r._wFPDoR,
      csvQ(issues),r._riskLevel||'',
      csvQ(r['Target Versions']),csvQ(r['Fix Version']),csvQ(r['Components']),
      csvQ(r['Team']),r['Priority']||'',r['Confidence'],r._place,(r._conf||0)+'%',
      csvQ(r['PM']),csvQ(r['Outcome'])
    ].join(',');
  })];
  return lines.join('\n');
}
