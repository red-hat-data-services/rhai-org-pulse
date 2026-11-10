<script setup>
import { onMounted } from 'vue'
import { useFeatureScheduling } from '../composables/useFeatureScheduling'

// Stage 1c preview -- native Vue port of the AI Planner iframe's Data Appendix
// tab (renderAppendix(), public/ai-first-scheduler/index.html lines 3873-3989,
// plus the tab's own markup at lines 718-1124). Not wired into any nav item;
// reachable only via #/releases/data-appendix-preview for local QA. See
// AI-PLANNER-HANDOFF.md and the Nov 3 2026 migration plan.
//
// Most of this tab is static historical/reference documentation (ML model
// training notes, A/B calibration snapshots, bug-debt stats, a decision-tree
// illustration, a wired-in/missing status table) with no calculation behind
// it -- that content below is copied near-verbatim from index.html, same
// approach as ArchitecturePreview.vue, since it's a capture, not a redesign.
//
// The four tables with real logic (Component Capacity, Team Capacity,
// Exclusion Breakdown, FPDoR Field Breakdown) are backed by
// computeComponentCapacityUsage()/computeTeamCapacityUsage()/
// computeExclusionBreakdown()/computeFpdorFieldBreakdown() in core.js, byte
// -faithful extractions of renderAppendix()'s four aggregations. Like
// placementCounts (stage 1b), these use the full unfiltered dataset
// (scheduledRows), matching index.html's own renderAppendix(allData) call
// (line 3550) -- not the active filter bar.

const {
  scheduledRows,
  componentCapacityUsage,
  teamCapacityUsage,
  exclusionBreakdown,
  fpdorFieldBreakdown,
  loading,
  error,
  loadFeatures
} = useFeatureScheduling()

onMounted(loadFeatures)

function statusClass(over) {
  return over ? 'text-red-700 dark:text-red-400 font-semibold' : ''
}
</script>

<template>
<div class="appendix-preview space-y-0">
  <div class="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
    <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
      Data Appendix (preview)
      <span class="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">{{ scheduledRows.length }} features loaded</span>
    </div>
  </div>

  <div v-if="error" role="alert" class="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
    {{ error }}
  </div>

  <div class="p-4" v-if="scheduledRows.length">
  <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:14px;margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;color:#0d47a1;margin-bottom:8px">📋 EA/GA Strategy — Phase Distinctions</div>
    <div style="font-size:11px;color:#1565c0;line-height:1.6">
      <strong>Early Access (EA1/EA2):</strong> Development-focused releases with strict readiness gates. Features can slip to next cycle without customer impact. Model confidence tiers are calibrated for engineering delivery probability.
      <br><br>
      <strong>General Availability (GA):</strong> Customer-facing final release with zero tolerance for slips. Strategy shifts to risk minimization. Confidence reflects real-world support impact.
      <br><br>
      <strong>Implications:</strong> Features in EA may fail readiness checks and defer; GA items require higher proof points before commit. Model trains separate prediction surfaces per phase using historical delivery rates.
    </div>
  </div>

  <div class="ap-note">Component throughput from <strong>component-team-capacity-v2 (2026-08-12)</strong> · used for confidence scoring tiers. Team-level ceilings from <strong>release-capacity-dataset (Aug 2026)</strong>: 420 features · 27 release events · 49 teams · p75 feature load per EA1/EA2/GA cycle. Values = <em>featureLoadP75</em>: 75th-percentile feature count closed when the team was active.</div>

  <div class="ap-sec">📊 Historical Delivery Rates — 3.4 &amp; 3.5</div>
  <div style="margin-bottom:6px;font-size:11px;color:#555">Actual shipped vs. slipped counts by event. Used to calibrate confidence caps and ML training labels. <strong>3.4 = all features baseline. 3.5 = properly-committed-at-freeze features only</strong> (higher rates reflect stricter gate).</div>
  <div class="tbl-wrap" style="margin-bottom:18px"><table>
    <thead><tr>
      <th>Release</th><th>Event</th><th>Committed</th><th>Shipped ✓</th><th>Slipped ✗</th><th>Delivery Rate</th><th>Note</th>
    </tr></thead>
    <tbody>
      <tr>
        <td style="font-weight:600">3.4</td><td>EA1</td><td>10</td>
        <td style="color:#2e7d32;font-weight:600">10</td><td style="color:#bbb">0</td>
        <td><span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">100%</span></td>
        <td style="font-size:10px;color:#888">All-features baseline · cap set to 75% (conservative)</td>
      </tr>
      <tr>
        <td style="font-weight:600">3.4</td><td>EA2</td><td>14</td>
        <td style="color:#f57c00;font-weight:600">9</td><td style="color:#c62828">5</td>
        <td><span style="background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">64%</span></td>
        <td style="font-size:10px;color:#888">All-features baseline · cap set to 60%</td>
      </tr>
      <tr>
        <td style="font-weight:600">3.4</td><td>GA</td><td>78</td>
        <td style="color:#c62828;font-weight:600">22</td><td style="color:#c62828">56</td>
        <td><span style="background:#ffebee;color:#c62828;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">28%</span></td>
        <td style="font-size:10px;color:#888">All-features baseline · cap set to 40%</td>
      </tr>
      <tr style="border-top:2px solid #e3f2fd">
        <td style="font-weight:600">3.5</td><td>EA2</td><td>18</td>
        <td style="color:#2e7d32;font-weight:600">15</td><td style="color:#c62828">3</td>
        <td><span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">83%</span></td>
        <td style="font-size:10px;color:#888">Committed-at-freeze only · ML training data</td>
      </tr>
      <tr>
        <td style="font-weight:600">3.5</td><td>GA</td><td>96</td>
        <td style="color:#2e7d32;font-weight:600">88</td><td style="color:#c62828">8</td>
        <td><span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">92%</span></td>
        <td style="font-size:10px;color:#888">Committed-at-freeze only · ML training data</td>
      </tr>
      <tr style="background:#f3e5f5;border-top:2px solid #ce93d8">
        <td style="font-weight:600;color:#6a1b9a">3.5 Total</td><td style="color:#6a1b9a">All</td><td style="color:#6a1b9a">115</td>
        <td style="color:#2e7d32;font-weight:600">104</td><td style="color:#c62828">11</td>
        <td><span style="background:#f3e5f5;color:#6a1b9a;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">90%</span></td>
        <td style="font-size:10px;color:#6a1b9a">🤖 Used for RF+ROS training (11 slips → oversampled to 104)</td>
      </tr>
    </tbody>
  </table></div>

  <div class="ap-sec">Input Sources (per architecture)</div>
  <div class="tbl-wrap" style="margin-bottom:18px"><table>
    <thead><tr><th>Input</th><th>Source</th><th>Status</th><th>Owner</th></tr></thead>
    <tbody>
      <tr><td>Engineering Capacity Metrics</td><td>Org Pulse / historical features delivered</td><td>Approximated</td><td>Engineering</td></tr>
      <tr><td>Priority Outcomes</td><td>RHAISTRAT Priority Outcomes page</td><td>Manual</td><td>Planning Domain</td></tr>
      <tr><td>Component Dependency Mapping</td><td>Feature children / Jira links</td><td>Partial</td><td>Engineering</td></tr>
      <tr><td>FPDoR Readiness (QG1)</td><td>QG1 labels from agentic-ci + rubric score</td><td>Live</td><td>Engineering</td></tr>
      <tr><td>Priority Score</td><td>RICE + Outcome alignment + Target Version + Jira Priority</td><td>Live</td><td>Org Pulse</td></tr>
      <tr><td style="font-weight:600;color:#2e7d32">Per-feature delivery labels (3.5)</td><td>fpdor-and-phase-labels — committedPhase/deliveredPhase/slips · 205 features · n=34 never-delivered</td><td style="color:#2e7d32;font-weight:600">Ready ✓</td><td>Planning Domain</td></tr>
      <tr><td style="font-weight:600;color:#2e7d32">FPDoR at planning freeze (3.5 + 3.6 EA1)</td><td>fpdor-dataset — all 205 3.5 features + 3.6 EA1 freeze baseline · FPDoR joined per row</td><td style="color:#2e7d32;font-weight:600">Ready ✓</td><td>Planning Domain</td></tr>
      <tr><td>Customer Support Insights</td><td>Customer Support</td><td>Future</td><td>—</td></tr>
      <tr><td>ProdSec Policies</td><td>Internal ProdSec</td><td>Future</td><td>—</td></tr>
    </tbody>
  </table></div>

  <div class="ap-sec">📊 Priority Score — How It's Calculated</div>
  <div style="font-size:11px;color:#444;line-height:1.7;margin-bottom:6px">
    The <strong>SCORE</strong> column comes from <a href="https://github.com/red-hat-data-services/rhai-org-pulse" target="_blank" style="color:#1565c0">org-pulse</a> · <code>modules/releases/server/planning/health/priority-scorer.js</code>.
    It is a composite 0–100 score computed across all features at export time:
  </div>
  <div class="tbl-wrap" style="margin-bottom:8px"><table>
    <thead><tr><th>Component</th><th>Weight</th><th>How it's computed</th></tr></thead>
    <tbody>
      <tr><td><strong>RICE score</strong></td><td style="font-weight:700;color:#1565c0">30%</td><td>Raw RICE normalized to [0,1] relative to min/max across all features in the plan. Missing RICE → median substituted.</td></tr>
      <tr><td><strong>Outcome alignment</strong></td><td style="font-weight:700;color:#1565c0">30%</td><td>0 if not aligned. If aligned: <code>max(0.3, 1.0 − (rank−1)×0.1)</code> — position 1=100, position 2=90 ... position 8+=30.</td></tr>
      <tr><td><strong>Target Version</strong></td><td style="font-weight:700;color:#1565c0">25%</td><td>Current release=100 · next release=60 · release after=20 · unrecognized TV=10 · no TV=0.</td></tr>
      <tr><td><strong>Jira Priority</strong></td><td style="font-weight:700;color:#1565c0">15%</td><td>Blocker=100 · Critical=80 · Major=60 · Normal=40 · Minor=20.</td></tr>
    </tbody>
  </table></div>
  <div style="font-size:11px;color:#555;line-height:1.6;margin-bottom:4px">
    <strong>Why this matters for explainability:</strong> Score 77 vs 76 is a tiny difference — usually a single Priority Outcome position or one Jira priority tier. Two features with similar scores can have very different delivery risk.
    The ML confidence score (this tool) adds the missing risk dimension: a feature with Score=77 but 9/17 FPDoR and a prior slip is more likely to miss than one with Score=76, 16/17 FPDoR, and no slips.
  </div>
  <div style="font-size:11px;color:#555;line-height:1.6;margin-bottom:4px">
    <strong>Potential improvement — Risk-Adjusted Score:</strong> <code>Score × (ML confidence / 100)</code>.
    Score=77, conf=78% → 60. Score=76, conf=84% → 64. Risky features would drop below ready ones in rank. Not yet wired into the sort — confidence is shown separately in the CONFIDENCE column.
  </div>
  <div style="font-size:11px;color:#555;line-height:1.6;margin-bottom:18px">
    <strong>About TYPE column:</strong> TYPE (DP/TP/GA) is read from the Jira "Release Type" field. If unset, falls back to title prefix — matches both bracket format (<code>[TP]</code> / <code>[DP]</code>) and plain-text prefixes (<code>Tech Preview -</code> / <code>Dev Preview -</code>).
  </div>

  <div class="ap-sec">Component Capacity</div>
  <div class="tbl-wrap" style="margin-bottom:18px"><table>
    <thead><tr><th>Component</th><th>EA1 Cap</th><th>EA2 Cap</th><th>GA Cap</th><th>EA1 Used</th><th>EA2 Used</th><th>GA Used</th><th>Status</th></tr></thead>
    <tbody>
      <tr v-for="row in componentCapacityUsage" :key="row.component">
        <td>{{ row.component }}</td>
        <td>{{ row.cap.EA1 }}</td><td>{{ row.cap.EA2 }}</td><td>{{ row.cap.GA }}</td>
        <td :class="row.used.EA1 > row.cap.EA1 ? statusClass(true) : ''">{{ row.used.EA1 }}</td>
        <td :class="row.used.EA2 > row.cap.EA2 ? statusClass(true) : ''">{{ row.used.EA2 }}</td>
        <td :class="row.used.GA > row.cap.GA ? statusClass(true) : ''">{{ row.used.GA }}</td>
        <td>{{ row.over ? '⚠ Over ceiling' : '✓ OK' }}</td>
      </tr>
    </tbody>
  </table></div>

  <div class="ap-sec">Team — Features In-Plan vs p75 Capacity (advisory · from release-capacity-dataset)</div>
  <div class="tbl-wrap" style="margin-bottom:18px"><table>
    <thead><tr><th>Team</th><th>EA1</th><th>EA2</th><th>GA</th><th>Total In-Plan</th><th>Note</th></tr></thead>
    <tbody>
      <tr v-if="teamCapacityUsage.length" class="bg-amber-50 dark:bg-amber-900/20">
        <td colspan="6" class="text-xs font-bold text-amber-800 dark:text-amber-300">
          ⚠ Bottleneck Teams — Dashboard &amp; Docs capacity sets the EA2 system ceiling (John Graham, Aug 24)
        </td>
      </tr>
      <tr v-for="row in teamCapacityUsage" :key="row.team" :class="row.isBottleneck ? 'bg-amber-50 dark:bg-amber-900/10' : ''">
        <td :class="row.isBottleneck ? 'font-bold' : ''">{{ row.team }}</td>
        <td>{{ row.used.EA1 }}</td><td>{{ row.used.EA2 }}</td><td>{{ row.used.GA }}</td>
        <td class="font-bold">{{ row.total }}</td>
        <td class="text-xs">
          <span v-if="row.isDoc" class="text-red-700 dark:text-red-400 font-semibold">⚠ 50% capacity EA2 — release notes only (Manuela Ansaldo, Aug 24)</span>
          <span v-else-if="row.isBottleneck" class="text-orange-700 dark:text-orange-400 font-semibold">⚠ Bottleneck team — monitor closely</span>
          <span v-else class="text-gray-400 dark:text-gray-500">No ceiling set — add Scrum/Kanban velocity to enforce</span>
        </td>
      </tr>
      <tr v-if="!teamCapacityUsage.length"><td colspan="6" class="text-center text-gray-400">No team data — Team column empty in CSV</td></tr>
    </tbody>
  </table></div>

  <div class="ap-sec">Exclusion Breakdown (No)</div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Reason</th><th>Count</th><th>% of Total</th></tr></thead>
    <tbody>
      <template v-for="group in exclusionBreakdown" :key="group.key">
        <tr class="bg-gray-50 dark:bg-gray-800/40">
          <td colspan="3" class="text-xs font-bold">
            {{ group.label }} &nbsp;<span class="bg-gray-600 text-white rounded-full px-2 text-[10px]">{{ group.rows.length }} features</span>
          </td>
        </tr>
        <tr v-for="row in group.rows.slice(0, 5)" :key="row['Key']">
          <td class="pl-5 text-xs">
            <a :href="'https://redhat.atlassian.net/browse/' + row['Key']" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 font-semibold">{{ row['Key'] }}</a>
            — {{ (row['Title'] || '').slice(0, 55) }}
          </td>
          <td class="text-[10px] text-gray-400 whitespace-nowrap">{{ row['Target Version'] || '—' }}</td>
          <td class="text-[10px] text-red-600">{{ (row._reason || '').slice(0, 60) }}</td>
        </tr>
        <tr v-if="group.rows.length > 5">
          <td colspan="3" class="pl-5 text-[10px] text-gray-400">+{{ group.rows.length - 5 }} more</td>
        </tr>
      </template>
      <tr v-if="!exclusionBreakdown.length"><td colspan="3" class="text-center text-gray-400">No features in No bucket</td></tr>
    </tbody>
  </table></div>

  <div class="ap-sec">✏️ FPDoR Field Failure Breakdown — which fields are blocking the most features</div>
  <div class="ap-note">Of the features blocked by mandatory FPDoR fields, here are the specific fields failing most. Fix these in Jira to move features into plan.</div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Field</th><th>Features blocked</th><th>Fix action</th></tr></thead>
    <tbody>
      <tr v-for="row in fpdorFieldBreakdown" :key="row.field">
        <td class="min-w-[180px]">{{ row.field }}</td>
        <td>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
              <div class="h-full bg-orange-500 rounded" :style="{ width: row.pct + '%' }"></div>
            </div>
            <span class="text-orange-600 font-bold min-w-[24px]">{{ row.count }}</span>
          </div>
        </td>
        <td class="text-xs text-gray-400">→ Fill the <strong>{{ row.field }}</strong> field in Jira</td>
      </tr>
      <tr v-if="!fpdorFieldBreakdown.length"><td colspan="3" class="text-gray-400">No mandatory FPDoR failures detected</td></tr>
    </tbody>
  </table></div>

  <div class="ap-sec">📊 Feature Risk Report — Aug 27 Snapshot (post-freeze)</div>
  <div class="ap-note">Live readiness snapshot from Aug 27 2026, after the EA2 planning freeze (Aug 26). Source: Erle's FPDoR weighted tier system applied to the committed list. CRITICAL tier failures (Child Epics, Components, Delivery Owner, Target Version, Fix Version) count toward HIGH risk.</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
    <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:#e65100;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">EA2 — 96 features committed</div>
      <div style="display:flex;gap:18px;margin-bottom:10px">
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:#2e7d32">18</div><div style="font-size:9px;color:#555;text-transform:uppercase">Plan-ready</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:#c62828">62</div><div style="font-size:9px;color:#555;text-transform:uppercase">HIGH risk</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:#f57c00">16</div><div style="font-size:9px;color:#555;text-transform:uppercase">MEDIUM risk</div></div>
      </div>
      <div style="height:10px;background:#eee;border-radius:5px;overflow:hidden;margin-bottom:8px;display:flex">
        <div style="width:18.75%;background:#2e7d32" title="18 ready (18.75%)"></div>
        <div style="width:64.58%;background:#c62828" title="62 HIGH risk (64.6%)"></div>
        <div style="width:16.67%;background:#f57c00" title="16 MEDIUM risk (16.7%)"></div>
      </div>
      <div style="font-size:10px;color:#555;margin-bottom:8px">Only <strong style="color:#c62828">18.75%</strong> of committed EA2 features are plan-ready. <strong>64.6%</strong> have at least one CRITICAL tier failure.</div>
      <table style="width:100%;font-size:10px;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5"><th style="padding:3px 5px;text-align:left;color:#555">Tier</th><th style="padding:3px 5px;text-align:left;color:#555">Top failing fields</th><th style="padding:3px 5px;text-align:right;color:#555"># features</th></tr></thead>
        <tbody>
        <tr style="border-bottom:1px solid #eee"><td style="padding:3px 5px;font-weight:600;color:#b71c1c">CRITICAL</td><td style="padding:3px 5px;color:#555">Fix Version, Components, Target Version</td><td style="padding:3px 5px;text-align:right;font-weight:700;color:#b71c1c">62</td></tr>
        <tr style="border-bottom:1px solid #eee"><td style="padding:3px 5px;font-weight:600;color:#e65100">HIGH</td><td style="padding:3px 5px;color:#555">Docs Impact, Release Type, RICE</td><td style="padding:3px 5px;text-align:right;font-weight:700;color:#e65100">~42</td></tr>
        <tr style="border-bottom:1px solid #eee"><td style="padding:3px 5px;font-weight:600;color:#f57c00">MEDIUM</td><td style="padding:3px 5px;color:#555">Feature Sign-Off, PM, Acceptance Criteria</td><td style="padding:3px 5px;text-align:right;font-weight:700;color:#f57c00">16</td></tr>
        </tbody>
      </table>
    </div>
    <div style="background:#fce4ec;border:1px solid #f48fb1;border-radius:6px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:#880e4f;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">GA — 56 features committed</div>
      <div style="display:flex;gap:18px;margin-bottom:10px">
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:#2e7d32">4</div><div style="font-size:9px;color:#555;text-transform:uppercase">Plan-ready</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:#c62828">50</div><div style="font-size:9px;color:#555;text-transform:uppercase">HIGH risk</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:#f57c00">2</div><div style="font-size:9px;color:#555;text-transform:uppercase">MEDIUM risk</div></div>
      </div>
      <div style="height:10px;background:#eee;border-radius:5px;overflow:hidden;margin-bottom:8px;display:flex">
        <div style="width:7.14%;background:#2e7d32" title="4 ready (7.1%)"></div>
        <div style="width:89.29%;background:#c62828" title="50 HIGH risk (89.3%)"></div>
        <div style="width:3.57%;background:#f57c00" title="2 MEDIUM risk (3.6%)"></div>
      </div>
      <div style="font-size:10px;color:#555;margin-bottom:8px">Only <strong style="color:#c62828">7.1%</strong> of committed GA features are plan-ready. GA pipeline is <strong>significantly earlier</strong> in the readiness cycle — expected at this stage.</div>
      <table style="width:100%;font-size:10px;border-collapse:collapse">
        <thead><tr style="background:#f5f5f5"><th style="padding:3px 5px;text-align:left;color:#555">Tier</th><th style="padding:3px 5px;text-align:left;color:#555">Top failing fields</th><th style="padding:3px 5px;text-align:right;color:#555"># features</th></tr></thead>
        <tbody>
        <tr style="border-bottom:1px solid #eee"><td style="padding:3px 5px;font-weight:600;color:#b71c1c">CRITICAL</td><td style="padding:3px 5px;color:#555">Fix Version, Child Epics, Delivery Owner</td><td style="padding:3px 5px;text-align:right;font-weight:700;color:#b71c1c">50</td></tr>
        <tr style="border-bottom:1px solid #eee"><td style="padding:3px 5px;font-weight:600;color:#e65100">HIGH</td><td style="padding:3px 5px;color:#555">Docs Impact, RICE, Priority</td><td style="padding:3px 5px;text-align:right;font-weight:700;color:#e65100">~38</td></tr>
        <tr style="border-bottom:1px solid #eee"><td style="padding:3px 5px;font-weight:600;color:#f57c00">MEDIUM</td><td style="padding:3px 5px;color:#555">PM, Feature Sign-Off</td><td style="padding:3px 5px;text-align:right;font-weight:700;color:#f57c00">2</td></tr>
        </tbody>
      </table>
    </div>
  </div>
  <div class="ap-sec">🔬 A/B Calibration — Post-Freeze Analysis</div>
  <div class="ap-note">Ground truth unlocked Sep 1: Sarah Finn (sfinn@redhat.com) shared the EA2 committed features Jira filter. We can now compare our pre-freeze ML predictions vs. what actually committed — closing the loop for the first time on RHOAI 3.6 EA2.</div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#0d47a1;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">A/B Calibration</div>
      <div style="font-size:11px;color:#222;line-height:1.6">Compare our pre-freeze ML predictions (ranked into EA2) vs. the actual committed list from Sarah's Jira filter. Every feature we predicted correctly = validation signal. Every miss = labeled training example for v10.</div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:6px"><span style="background:#2e7d32;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px">DONE</span><span style="font-size:9px;color:#555">Sep 1 — F1 39.4%</span></div>
    </div>
    <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:6px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#6a1b9a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">v10 Training</div>
      <div style="font-size:11px;color:#222;line-height:1.6">First closed-loop signal: model trained on 3.4+3.5 history, now scored against 3.6 EA2 actuals. A/B discrepancies → new labeled rows. Signals that gain weight: <code style="font-size:10px">has_qg1_pass</code>, <code style="font-size:10px">strat_signoff</code>, <code style="font-size:10px">is_draft</code>.</div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:6px"><span style="background:#2e7d32;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px">DONE</span><span style="font-size:9px;color:#555">Sep 1 — AUC 85.7%</span></div>
    </div>
    <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:14px">
      <div style="font-size:10px;font-weight:700;color:#e65100;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Sept 23 GA Freeze</div>
      <div style="font-size:11px;color:#222;line-height:1.6">With A/B results in hand, deliver a calibrated model by <strong>Sept 17</strong> — not just predictions, but confidence intervals backed by actual recall numbers. PMs/DMs consult output before the GA planning freeze.</div>
      <div style="margin-top:10px;display:flex;align-items:center;gap:6px"><span style="background:#e65100;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px">DEADLINE</span><span style="font-size:9px;color:#555">Sept 17 — 16 days</span></div>
    </div>
  </div>

  <div style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:14px;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:#333;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Results — Sep 1, 2026 (ab_calibration.py run)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div style="text-align:center;background:#f3f4f6;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#1565c0">93</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">Committed (ground truth)</div>
      </div>
      <div style="text-align:center;background:#f3f4f6;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#555">95</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">Our EA2 predictions</div>
      </div>
      <div style="text-align:center;background:#e8f5e9;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#2e7d32">37</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">True Positives ✓</div>
      </div>
      <div style="text-align:center;background:#fff8e1;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#f57c00">39.4%</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">F1 Score</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <div>
        <div style="font-size:10px;color:#555;margin-bottom:6px;font-weight:600">Precision / Recall / F1</div>
        <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span>Precision</span><span style="font-weight:700;color:#f57c00">38.9%</span></div><div style="height:7px;background:#eee;border-radius:4px"><div style="height:100%;width:38.9%;background:#f57c00;border-radius:4px"></div></div></div>
        <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span>Recall</span><span style="font-weight:700;color:#f57c00">39.8%</span></div><div style="height:7px;background:#eee;border-radius:4px"><div style="height:100%;width:39.8%;background:#f57c00;border-radius:4px"></div></div></div>
        <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span>F1 Score</span><span style="font-weight:700;color:#f57c00">39.4%</span></div><div style="height:7px;background:#eee;border-radius:4px"><div style="height:100%;width:39.4%;background:#f57c00;border-radius:4px"></div></div></div>
        <div style="font-size:9px;color:#666;margin-top:6px;line-height:1.5">v10 A/B: r=−0.348 (p&lt;0.0001). High-confidence features (avg 85.6%) were NOT committed; TP features averaged 61.6%. Model ranks readiness — PMs commit strategy.</div>
      </div>
      <div>
        <div style="font-size:10px;color:#555;margin-bottom:6px;font-weight:600">Missed features (FN=56) by our bucket</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:10px">
          <div style="background:#ffebee;border-radius:4px;padding:6px;text-align:center"><div style="font-weight:700;color:#c62828;font-size:16px">22</div><div style="font-size:9px;color:#555">Not in model<br><span style="color:#888">(post-Aug-12 adds)</span></div></div>
          <div style="background:#fff3e0;border-radius:4px;padding:6px;text-align:center"><div style="font-weight:700;color:#e65100;font-size:16px">13</div><div style="font-size:9px;color:#555">We put in GA</div></div>
          <div style="background:#fff3e0;border-radius:4px;padding:6px;text-align:center"><div style="font-weight:700;color:#e65100;font-size:16px">12</div><div style="font-size:9px;color:#555">We put in EA1</div></div>
          <div style="background:#fce4ec;border-radius:4px;padding:6px;text-align:center"><div style="font-weight:700;color:#880e4f;font-size:16px">9</div><div style="font-size:9px;color:#555">Below cut</div></div>
        </div>
        <div style="font-size:9px;color:#555;margin-top:6px;background:#e3f2fd;border-radius:4px;padding:6px;line-height:1.5"><strong>Key finding:</strong> 22/56 misses were features created after our Aug 12 CSV freeze — the model literally couldn't see them. Add <code>days_since_created</code> as a recency signal for v11.</div>
      </div>
    </div>
  </div>

  <div style="background:#fff;border:1px solid #c8e6c9;border-radius:6px;padding:14px;margin-bottom:14px">
    <div style="font-size:10px;font-weight:700;color:#2e7d32;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">EA1 Calibration — Sep 1, 2026 (59 committed features)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
      <div style="text-align:center;background:#f3f4f6;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#1565c0">59</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">Committed (ground truth)</div>
      </div>
      <div style="text-align:center;background:#f3f4f6;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#555">108</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">Our EA1 predictions</div>
      </div>
      <div style="text-align:center;background:#e8f5e9;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#2e7d32">56</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">True Positives ✓</div>
      </div>
      <div style="text-align:center;background:#e8f5e9;border-radius:6px;padding:10px">
        <div style="font-size:22px;font-weight:700;color:#2e7d32">94.9%</div>
        <div style="font-size:9px;color:#555;text-transform:uppercase;margin-top:2px">Recall</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <div style="font-size:10px;color:#555;margin-bottom:6px;font-weight:600">Precision / Recall / F1</div>
        <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span>Precision</span><span style="font-weight:700;color:#f57c00">51.9%</span></div><div style="height:7px;background:#eee;border-radius:4px"><div style="height:100%;width:51.9%;background:#f57c00;border-radius:4px"></div></div></div>
        <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span>Recall</span><span style="font-weight:700;color:#2e7d32">94.9%</span></div><div style="height:7px;background:#eee;border-radius:4px"><div style="height:100%;width:94.9%;background:#2e7d32;border-radius:4px"></div></div></div>
        <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span>F1 Score</span><span style="font-weight:700;color:#1565c0">67.1%</span></div><div style="height:7px;background:#eee;border-radius:4px"><div style="height:100%;width:67.1%;background:#1565c0;border-radius:4px"></div></div></div>
        <div style="font-size:9px;color:#666;margin-top:6px;line-height:1.5">EA1 recall 2.4× better than EA2 (94.9% vs 39.8%). Features locked into EA1 are further along in readiness — model's FPDoR signals align well with actual PM commits.</div>
      </div>
      <div>
        <div style="font-size:10px;color:#555;margin-bottom:6px;font-weight:600">3 misses (FN) — all strategic infrastructure</div>
        <div style="background:#ffebee;border-radius:4px;padding:8px;font-size:9px;line-height:1.6;color:#555">
          All 3 were put in <strong>Below cut</strong> (~42% confidence) by the model:<br>
          • <strong>RHAISTRAT-2150</strong> — Intel Gaudi Support (AIPCC EA1)<br>
          • <strong>RHAISTRAT-2170</strong> — AMD ROCm Continuous Delivery (AIPCC EA1)<br>
          • <strong>RHAISTRAT-2366</strong> — CUDA 12.9 Support<br>
          <span style="margin-top:4px;display:block;color:#c62828;font-weight:600">These were committed on hardware partnership timelines, not FPDoR readiness. Classic strategic commit — expected model blind spot. v11 signal: hardware_partnership flag.</span>
        </div>
      </div>
    </div>
  </div>

  <div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:18px">
    <div style="font-size:10px;font-weight:700;color:#333;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Next Steps</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:10px">
      <div style="display:flex;align-items:flex-start;gap:6px"><span style="color:#2e7d32;font-weight:700;flex-shrink:0">✓</span><span style="color:#888;text-decoration:line-through">Pull RHAISTRAT keys from Sarah's Jira filter (EA2 + EA1 committed lists)</span></div>
      <div style="display:flex;align-items:flex-start;gap:6px"><span style="color:#2e7d32;font-weight:700;flex-shrink:0">✓</span><span style="color:#888;text-decoration:line-through">Cross-reference against predictions — compute precision/recall per phase (EA1 94.9% recall, EA2 39.8%)</span></div>
      <div style="display:flex;align-items:flex-start;gap:6px"><span style="color:#2e7d32;font-weight:700;flex-shrink:0">✓</span><span style="color:#888;text-decoration:line-through">Label discrepancies — 262 training rows generated (EA1 + EA2)</span></div>
      <div style="display:flex;align-items:flex-start;gap:6px"><span style="color:#2e7d32;font-weight:700;flex-shrink:0">✓</span><span style="color:#888;text-decoration:line-through">Train v10 — AUC 85.7% (+2.0% vs v9)</span></div>
      <div style="display:flex;align-items:flex-start;gap:6px"><span style="color:#1565c0;font-weight:700;flex-shrink:0">⑤</span><span>Deliver calibrated schedule with confidence intervals by <strong>Sept 17</strong> for GA freeze consultation</span></div>
      <div style="display:flex;align-items:flex-start;gap:6px"><span style="color:#1565c0;font-weight:700;flex-shrink:0">⑥</span><span>Require AI Scheduler as first-draft for <strong>3.7 EA Planning Freeze Oct 23</strong> — PMs adjust inputs, not the output</span></div>
    </div>
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e0e0e0;font-size:10px;color:#555">
      <strong>📋 PM/DM feedback calls (Arjay + Yuval, this week):</strong> What data do you trust? What at a glance vs. click through? What can we drop? High-risk features with dependency count? Outcomes % complete view? Outcomes hierarchy (following up with Adam on definitions)?
    </div>
  </div>

  <div class="ap-sec">🐛 Field &amp; BU Feedback — Bug Debt by Component (Sep 1, 2026)</div>
  <div class="ap-note">283 BU/SSA issues from Org Pulse Field and BU Feedback tab (Saiesh Prabhu). Source API: team-tracker Org Pulse. Resolution rate: 47.3% · 90-day throughput: 87 closed · 81 unassigned · 45 stale (&gt;90d).</div>
  <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
    <div style="background:#fff3e0;border:1px solid #ffb74d;border-radius:6px;padding:10px 14px;text-align:center;min-width:80px">
      <div style="font-size:20px;font-weight:700;color:#e65100">149</div><div style="font-size:9px;color:#555;text-transform:uppercase">Total Open</div></div>
    <div style="background:#fce4ec;border:1px solid #f48fb1;border-radius:6px;padding:10px 14px;text-align:center;min-width:80px">
      <div style="font-size:20px;font-weight:700;color:#880e4f">101d</div><div style="font-size:9px;color:#555;text-transform:uppercase">Avg Open Age</div></div>
    <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:10px 14px;text-align:center;min-width:80px">
      <div style="font-size:20px;font-weight:700;color:#f57c00">47.3%</div><div style="font-size:9px;color:#555;text-transform:uppercase">Resolution Rate</div></div>
    <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:10px 14px;text-align:center;min-width:80px">
      <div style="font-size:20px;font-weight:700;color:#1565c0">63</div><div style="font-size:9px;color:#555;text-transform:uppercase">WIP (In Progress)</div></div>
  </div>
  <table style="width:100%;font-size:11px;border-collapse:collapse;margin-bottom:12px">
    <thead><tr style="background:#f5f5f5">
      <th style="padding:4px 6px;text-align:left;color:#555">Component</th>
      <th style="padding:4px 6px;text-align:right;color:#555">Open</th>
      <th style="padding:4px 6px;text-align:right;color:#555">Avg Age</th>
      <th style="padding:4px 6px;text-align:right;color:#555">Bug Debt (3pts×open)</th>
      <th style="padding:4px 6px;text-align:center;color:#555">Capacity Impact</th>
    </tr></thead>
    <tbody>
      <tr style="border-bottom:1px solid #eee"><td style="padding:4px 6px;font-weight:600">Model as a Service</td><td style="padding:4px 6px;text-align:right;color:#c62828;font-weight:700">33</td><td style="padding:4px 6px;text-align:right;color:#555">62.3d</td><td style="padding:4px 6px;text-align:right;font-weight:700">99 pts</td><td style="padding:4px 6px;text-align:center"><span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">HIGH</span></td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:4px 6px;font-weight:600">AI Core Dashboard</td><td style="padding:4px 6px;text-align:right;color:#c62828;font-weight:700">29</td><td style="padding:4px 6px;text-align:right;color:#e65100;font-weight:700">141.4d ⚠</td><td style="padding:4px 6px;text-align:right;font-weight:700">87 pts</td><td style="padding:4px 6px;text-align:center"><span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">HIGH</span></td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:4px 6px;font-weight:600">Documentation</td><td style="padding:4px 6px;text-align:right;color:#c62828;font-weight:700">27</td><td style="padding:4px 6px;text-align:right;color:#555">61.3d</td><td style="padding:4px 6px;text-align:right;font-weight:700">81 pts</td><td style="padding:4px 6px;text-align:center"><span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">HIGH</span></td></tr>
      <tr style="border-bottom:1px solid #eee"><td style="padding:4px 6px;font-weight:600">Serving Orchestration</td><td style="padding:4px 6px;text-align:right;color:#f57c00;font-weight:700">19</td><td style="padding:4px 6px;text-align:right;color:#e65100;font-weight:700">134.9d ⚠</td><td style="padding:4px 6px;text-align:right;font-weight:700">57 pts</td><td style="padding:4px 6px;text-align:center"><span style="background:#fff8e1;color:#f57c00;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">MEDIUM</span></td></tr>
      <tr><td style="padding:4px 6px;font-weight:600">AI Safety</td><td style="padding:4px 6px;text-align:right;color:#f57c00;font-weight:700">19</td><td style="padding:4px 6px;text-align:right;color:#555">80.8d</td><td style="padding:4px 6px;text-align:right;font-weight:700">57 pts</td><td style="padding:4px 6px;text-align:center"><span style="background:#fff8e1;color:#f57c00;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700">MEDIUM</span></td></tr>
    </tbody>
  </table>
  <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:6px;padding:10px;margin-bottom:8px;font-size:10px">
    <strong>Formula:</strong> <code>real_capacity = p75_throughput − (open_issues × 3 pts)</code><br>
    Flat estimate of 3 story points per issue (per Saiesh Prabhu). Will be replaced by Arjay's weighted prioritizer once validated.
  </div>
  <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:6px;padding:10px;margin-bottom:8px;font-size:10px">
    <strong>Arjay's weighted prioritizer (in testing):</strong> Production Down (100) &gt; SLA Risk (80) &gt; Customer Escalation (50) &gt; Focus Customer (60) &gt; SFDC/Flare (40) &gt; Severity (30). Will replace flat estimate and enable per-issue weighted capacity reduction.
  </div>
  <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:10px;margin-bottom:18px;font-size:10px">
    <strong>📈 AI Adoption signal (Tiffany's llm-d data — Org Pulse AI Adoption Report):</strong> llm-d +1733% throughput · Serving Orchestration +404% · overall AI adoption 17% → 67% (3.4 → 3.5 GA). Per-component AI adoption rates queued as <strong>v11 training signal</strong> (<code>component_ai_adoption_rate</code>) — components shipping at higher AI adoption rates carry higher baseline confidence. ⚠ llm-d TEAM_CAP p75 is stale: actual throughput is ~7× the historical estimate used in current capacity ceiling.
  </div>

  <div class="ap-sec">🤖 ML Model — Training & Performance</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
    <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:6px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:#6a1b9a;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Model Summary — v6 <span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;margin-left:4px">3.4+3.5 + FPDoR cycles</span></div>
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <tbody>
        <tr><td style="padding:3px 0;color:#555;width:45%">Algorithm</td><td style="font-weight:600;color:#222">Random Forest + MICE imputation + GridSearchCV + SMOTE + calibration</td></tr>
        <tr><td style="padding:3px 0;color:#555">Depth selection</td><td style="font-weight:600;color:#222">10-fold CV searched max_depth ∈ {3,5,7,10} · chose depth=10, min_samples_leaf=3 (AUC 85.4%) · SMOTE inside each fold · 10-fold = 32 test samples per fold</td></tr>
        <tr><td style="padding:3px 0;color:#555">Balancing</td><td style="font-weight:600;color:#222">SMOTE inside CV pipeline — 39 → 280 slipped per fold</td></tr>
        <tr><td style="padding:3px 0;color:#222;font-weight:600">Training set</td><td style="font-weight:700;color:#2e7d32">3.4 + 3.5 committed + FPDoR cycle snapshots · 319 features total</td></tr>
        <tr><td style="padding:3px 0;color:#555">Label</td><td style="font-weight:600;color:#222">Shipped as planned vs. slipped</td></tr>
        <tr><td style="padding:3px 0;color:#555">Class split</td><td style="font-weight:600;color:#222">280 shipped · 39 slipped → balanced 280/280</td></tr>
        <tr><td style="padding:3px 0;color:#555">AUC-ROC (CV tuning)</td><td style="font-weight:600;color:#2e7d32">85.4% ± 9.5% (10-fold CV — more realistic with 3× more slipped examples)</td></tr>
        <tr><td style="padding:3px 0;color:#555">Confidence caps</td><td style="font-weight:600;color:#222">🤖 real history → max 95% · ~🤖 no shipping history → max 85% minus FPDoR penalty<br><span style="font-weight:400;color:#666;font-size:10px">Why cap? Features with slip_count=0 cluster high. FPDoR penalty (0–15pts) restores differentiation: a feature at 9/17 FPDoR scores ~7pts lower than one at 16/17, even when both raw ML scores exceed 85.<br><strong>High FPDoR</strong> = a feature has completed most or all of the 17-item FPDoR readiness checklist (Feature Planning Document of Record) — covering: PM ownership, RICE priority, acceptance criteria, docs plan, release type, cross-team deps, and more. 17/17 = fully ready. The higher the FPDoR, the stronger the signal the feature is well-defined and likely to ship.</span></td></tr>
        <tr><td style="padding:3px 0;color:#555">Applied to</td><td style="font-weight:600;color:#7b1fa2">All 638 in-plan features (🤖 70 w/slip history · ~🤖 568 imputed)</td></tr>
        <tr><td style="padding:3px 0;color:#555">Top signals</td><td style="font-weight:600;color:#222">Slip history 21% · Mandatory FPDoR rate 19% · FPDoR pass rate 9% · Release type 8% · Jira priority 8% · RICE 7%</td></tr>
        </tbody>
      </table>
    </div>
    <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:14px">
      <div style="font-size:11px;font-weight:700;color:#2e7d32;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">Feature Importance (RF+SMOTE, balanced — v6)</div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Prior slip history</span><span style="font-weight:700;color:#c62828">21%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:21%;background:#c62828;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Mandatory FPDoR pass rate</span><span style="font-weight:700;color:#1565c0">19%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:19%;background:#1565c0;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">FPDoR pass rate</span><span style="font-weight:700;color:#1565c0">9%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:9%;background:#1565c0;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Release type (pass/fail)</span><span style="font-weight:700;color:#1565c0">8%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:8%;background:#1565c0;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Jira priority</span><span style="font-weight:700;color:#1565c0">8%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:8%;background:#1565c0;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">FPDoR items passed</span><span style="font-weight:700;color:#1565c0">8%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:8%;background:#1565c0;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">RICE score</span><span style="font-weight:700;color:#1565c0">7%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:7%;background:#1565c0;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">FPDoR criteria rate</span><span style="font-weight:700;color:#42a5f5">6%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:6%;background:#42a5f5;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Docs impact (pass/fail)</span><span style="font-weight:700;color:#42a5f5">5%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:5%;background:#42a5f5;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Component reliability</span><span style="font-weight:700;color:#42a5f5">4%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:4%;background:#42a5f5;border-radius:3px"></div></div></div>
      <div style="margin-bottom:5px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="color:#333">Committed phase / Has docs component</span><span style="font-weight:700;color:#bbb">3% / 2%</span></div><div style="height:6px;background:#ddd;border-radius:3px"><div style="height:100%;width:3%;background:#bbb;border-radius:3px"></div></div></div>
      <div style="font-size:9px;color:#888;margin-top:8px;line-height:1.5">v6 key change: slip_count dropped from 48% → 21% after adding 185 FPDoR-cycle features (27 new slips with slip_count=0). Model now uses FPDoR heavily — features with no prior slip history get differentiated scores instead of all clustering at 85–95%.</div>
    </div>
  </div>

  <div class="ap-sec">🌳 Example Decision Tree (one of 200 trees, depth=10 — illustrative first 3 levels)</div>
  <div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:18px;font-family:monospace;font-size:11px;line-height:2">
    <div style="color:#555;margin-bottom:8px;font-family:sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">How a single tree scores a feature — example: 12/17 mandatory FPDoR · RICE 70 · Blocker · GA · slip_count=0</div>
    <div><span style="color:#1565c0;font-weight:700">Is mandatory_pass_rate &gt; 0.75?</span> <span style="color:#888">(mandatory FPDoR items — 19% importance)</span></div>
    <div style="padding-left:20px"><span style="color:#2e7d32">└── Yes</span> → <span style="color:#1565c0;font-weight:700">Is slip_count &gt; 0?</span> <span style="color:#888">(prior release slips — 21% importance)</span></div>
    <div style="padding-left:40px"><span style="color:#2e7d32">└── No</span> → <span style="color:#1565c0;font-weight:700">Is jira_priority = Critical/High?</span> <span style="color:#888">(8% importance)</span></div>
    <div style="padding-left:60px"><span style="color:#2e7d32">└── Yes</span> → <span style="background:#e8f5e9;color:#2e7d32;padding:1px 6px;border-radius:4px;font-weight:700">SHIP</span> <span style="color:#888">→ this tree votes "will ship"</span></div>
    <div style="padding-left:60px"><span style="color:#c62828">└── No &nbsp;</span> → <span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:4px;font-weight:700">SLIP</span> <span style="color:#888">→ this tree votes "will slip"</span></div>
    <div style="padding-left:40px"><span style="color:#c62828">└── Yes</span> → <span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:4px;font-weight:700">SLIP</span> <span style="color:#888">→ prior slips = strong signal even with good FPDoR</span></div>
    <div style="padding-left:20px"><span style="color:#c62828">└── No &nbsp;</span> → <span style="color:#1565c0;font-weight:700">Is fpdor_pass_rate &gt; 0.60?</span> <span style="color:#888">(overall FPDoR — 9% importance)</span></div>
    <div style="padding-left:40px"><span style="color:#2e7d32">└── Yes</span> → <span style="background:#e8f5e9;color:#2e7d32;padding:1px 6px;border-radius:4px;font-weight:700">SHIP</span> <span style="color:#888">→ partial FPDoR still enough if mandatory items not the issue</span></div>
    <div style="padding-left:40px"><span style="color:#c62828">└── No &nbsp;</span> → <span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:4px;font-weight:700">SLIP</span> <span style="color:#888">→ low FPDoR overall = high risk</span></div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid #e0e0e0;font-family:sans-serif;color:#555;font-size:10px;line-height:1.6">
      <strong>200 trees vote independently</strong> using the same 12 features with different random splits. Real trees go 10 levels deep — this shows the first 3 for clarity.<br>
      If 87 of 200 trees vote SHIP → raw confidence = 43.5% → displayed as 43% (Low).<br>
      If 170 of 200 trees vote SHIP → raw confidence = 85% → ~🤖 cap applies → displayed as 85%.
    </div>
  </div>

  <div class="ap-sec">🔲 What's Wired In · What's Missing</div>
  <div class="tbl-wrap" style="margin-bottom:18px"><table>
    <thead><tr><th>Item</th><th>Status</th><th>Detail</th><th>Owner</th></tr></thead>
    <tbody>
      <tr><td style="color:#2e7d32;font-weight:600">AI Delivery Signal — all features</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live</span></td><td>638 features scored: 70 🤖 (real slip history) + 568 ~🤖 (slip_count=0 imputed, capped 85%).</td><td>ML Pipeline</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">FPDoR RISK column — Legacy only</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live</span></td><td>13/13 all-or-nothing gate. AI-First path shows — (uses QG1 label gate instead).</td><td>Planning Domain</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">FPDoR weighted score (w:) — Org Pulse name alignment</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Fixed Aug 20</span></td><td>The <strong>w:</strong> score is the explainability layer — it shows exactly which checklist failures are costing points (e.g. "Child epics −25, Delivery Owner −25 → w:50"). Before this fix, weight keys used internal names that didn't match Org Pulse CSV strings, so almost every failure fell back to a 3-pt default penalty instead of the intended 25/10/5/2. Keys were renamed to match Org Pulse exactly (Child Epics→Child epics, Assignee→Delivery Owner, RICE Score→RICE, Documentation→Docs impact, etc.). Removed Scope Defined (not a real Org Pulse item). Scores are now stricter and honest — fewer features show as high readiness when important items are still failing. <strong>Note: the ML confidence score (🤖) is unaffected — it uses FPDoR pass rates, not the weighted penalty.</strong></td><td>Planning Domain</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">Priority Outcomes coverage</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live</span></td><td>OKR thresholds: 70%+ Confident · 40–70% Lagging · &lt;40% At Risk. All excluded features shown (no cap).</td><td>ML Pipeline</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">Historical delivery rates</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live</span></td><td>3.4 + 3.5 actuals by event (EA1/EA2/GA). Component throughput from capacity-v2 dataset.</td><td>Planning Domain</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">Counterfactual fix lines</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live</span></td><td>"→ Fix: complete [item] to raise confidence" for any in-plan feature below 80%.</td><td>ML Pipeline</td></tr>
      <tr><td style="font-weight:600;color:#e65100">Predictive bucket assignment — legacy unversioned features</td><td><span style="background:#fff3e0;color:#e65100;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">Next Phase</span></td><td><strong>Legacy path only</strong> — on AI-First, PMs set Target Version at RFE creation (triggers STRAT-CREATOR), so no-TV features don't exist there. "No bucket" count is a proxy for remaining legacy surface area and self-resolves as AI SDLC adoption grows. Next phase: triage tool to predict which legacy backlog features are worth re-routing through STRAT-CREATOR vs. leaving out. Requires 3.4+3.5+3.6 outcome data.</td><td>Engineering</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">Extended training from FPDoR cycle snapshots</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Done Aug 19</span></td><td>Extracted 185 additional labeled features (158 shipped / 27 slipped) from 3.4+3.5 per-phase FPDoR snapshots. Total training: n=134→319, slipped: 12→39. slip_count importance: 48%→21%. FPDoR now #2 signal at 19%.</td><td>ML Pipeline</td></tr>
      <tr><td style="font-weight:600;color:#e65100">SHAP per-feature explanations</td><td><span style="background:#fff3e0;color:#e65100;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">Pending</span></td><td>TreeSHAP values per feature for top-3 factor narrative in REASON column. Needs Python→JS bridge.</td><td>ML Pipeline</td></tr>
      <tr><td style="font-weight:600;color:#aaa">FPDoR readiness rubric review</td><td><span style="background:#f5f5f5;color:#888;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">Pending</span></td><td>Rubric doc sign-off pending. Aug 13 action item.</td><td>Planning Domain</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">40/40/20 Capacity Mix panel</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live Aug 21</span></td><td>Shows current plan composition vs. 40% bugs+tech-debt / 40% features / 20% research target. Classifies features by label + Big Rock heuristic. Flags when stabilization work is absent from plan.</td><td>ML Pipeline</td></tr>
      <tr><td style="color:#2e7d32;font-weight:600">Team capacity p75 ceilings</td><td><span style="background:#e8f5e9;color:#2e7d32;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">✓ Live Aug 21</span></td><td>Team-level p75 feature load from release-capacity-dataset — 63 teams wired in (EA1/EA2/GA). Shown in Team capacity table below and used as advisory ceiling. Source: 420 features · 27 release events · 49 active teams.</td><td>Planning Domain</td></tr>
      <tr><td style="font-weight:600;color:#aaa">Customer Support Insights</td><td><span style="background:#f5f5f5;color:#888;padding:1px 7px;border-radius:8px;font-size:10px;font-weight:700">Future</span></td><td>Customer support signal — will add CS ticket volume to priority scoring.</td><td>—</td></tr>
    </tbody>
  </table></div>

  </div>
  <div v-else-if="!loading" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No features loaded</div>
</div>
</template>

<style scoped>
/* index.html lines 110-131, 218-219, trimmed to what this tab actually uses
   (drops #pm-tbl-wrap-specific rules and the sortable-header affordances,
   which don't apply to this read-only appendix). */
.tbl-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow-x:auto;box-shadow:0 1px 3px rgba(0,0,0,.05)}
table{width:100%;border-collapse:collapse;font-size:12px}
thead{background:#f8fafc}
th{padding:8px 10px;text-align:left;font-weight:600;color:#64748b;font-size:10px;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #e2e8f0;white-space:nowrap}
td{padding:7px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:last-child td{border-bottom:none}
.ap-sec{font-size:13px;font-weight:600;color:#444;margin:16px 0 8px}
.ap-note{font-size:12px;color:#666;margin-bottom:12px}
</style>
