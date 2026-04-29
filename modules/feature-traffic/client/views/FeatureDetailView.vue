<script setup>
import { onMounted, inject, computed } from 'vue'
import { useFeatureDetail } from '../composables/useFeatureTraffic'
import StatusBadge from '../components/StatusBadge.vue'
import TrafficMap from '../components/TrafficMap.vue'
import EpicBreakdown from '../components/EpicBreakdown.vue'

const nav = inject('moduleNav')
const { feature, loading, error, loadFeature } = useFeatureDetail()

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

/** Set `true` to show the Delivery Pipeline (`TrafficMap`) section again. */
const SHOW_DELIVERY_PIPELINE = false

// Render ADF (Atlassian Document Format) to HTML
function renderAdf(node) {
  if (!node) return ''
  if (typeof node === 'string') return escHtml(node)

  if (node.type === 'text') {
    let html = escHtml(node.text || '')
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'strong') html = `<strong>${html}</strong>`
        else if (mark.type === 'em') html = `<em>${html}</em>`
        else if (mark.type === 'underline') html = `<u>${html}</u>`
        else if (mark.type === 'code') html = `<code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono">${html}</code>`
        else if (mark.type === 'link' && mark.attrs?.href && isSafeUrl(mark.attrs.href)) html = `<a href="${escAttr(mark.attrs.href)}" target="_blank" class="text-primary-600 dark:text-blue-400 hover:underline">${html}</a>`
        else if (mark.type === 'textColor') html = `<span style="color:${escAttr(mark.attrs?.color || '')}">${html}</span>`
      }
    }
    return html
  }

  const children = (node.content || []).map(renderAdf).join('')

  switch (node.type) {
    case 'doc': return children
    case 'paragraph': return `<p class="mb-1 last:mb-0">${children || '&nbsp;'}</p>`
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 3))
      const cls = level <= 2 ? 'text-base font-semibold mb-1' : 'text-sm font-semibold mb-1'
      return `<h${level} class="${cls}">${children}</h${level}>`
    }
    // NOTE: list-inside + block children (e.g. <p>) can render the bullet on its own line.
    case 'bulletList': return `<ul class="list-disc list-outside pl-5 mb-2 space-y-0.5">${children}</ul>`
    case 'listItem': return `<li class="[&>p]:inline [&>p]:m-0">${children}</li>`
    case 'hardBreak': return '<br/>'
    case 'emoji': return escHtml(node.attrs?.text || node.attrs?.shortName || '')
    case 'mention': return `<span class="text-primary-600 dark:text-blue-400 font-medium">@${escHtml(node.attrs?.text || node.attrs?.id || '')}</span>`
    case 'date': {
      const ts = node.attrs?.timestamp
      if (ts) { try { return new Date(Number(ts)).toLocaleDateString() } catch { return escHtml(String(ts)) } }
      return ''
    }
    case 'inlineCard': {
      const url = node.attrs?.url || ''
      const label = url.includes('/browse/') ? url.split('/browse/')[1] : url
      return url && isSafeUrl(url) ? `<a href="${escAttr(url)}" target="_blank" class="text-primary-600 dark:text-blue-400 hover:underline">${escHtml(label)}</a>` : escHtml(label)
    }
    default: return children
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function escAttr(s) {
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function isSafeUrl(url) {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol) }
  catch { return false }
}

function renderStatusNotes(notes) {
  if (!notes) return ''
  if (typeof notes === 'string') return escHtml(notes)
  if (typeof notes === 'object' && notes.type === 'doc') return renderAdf(notes)
  return escHtml(String(notes))
}

const ownerStatusColor = computed(() => feature.value?.ownerStatusColor || null)

const featureKey = computed(() => nav.params.value.key)

const validationErrors = computed(() => feature.value?.topology?.validationErrors || [])

const unknownFeatureComponents = computed(
  () => feature.value?.topology?.unknownFeatureComponents || []
)

const deliveryIntegration = computed(() => feature.value?.topology?.integration || null)

const hasDeliveryInsight = computed(() => {
  const t = feature.value?.topology?.integration
  if (!t) return false
  if (t.dashboardConsumesBackend || t.notebookIntegration) return true
  return Array.isArray(t.stages) && t.stages.length > 0
})

function goBack() {
  nav.navigateTo('overview')
}

const trafficSignals = computed(() => feature.value?.trafficSignals || null)

function formatSignalTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function issueHref(key) {
  return key ? JIRA_BASE + key : '#'
}

/** Split text so PROJECT-123 tokens become link parts (Jira keys). */
function splitIssueLinkParts(text) {
  const s = String(text ?? '')
  const re = /\b([A-Z][A-Z0-9]+-\d+)\b/g
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: s.slice(last, m.index) })
    parts.push({ kind: 'key', key: m[1] })
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push({ kind: 'text', text: s.slice(last) })
  return parts.length ? parts : [{ kind: 'text', text: s }]
}

function trafficIssueChipClass(variant) {
  const map = {
    blocker:
      'border-red-300/70 dark:border-red-500/35 text-red-800 dark:text-red-300 bg-white/90 dark:bg-red-950/40 hover:bg-red-100/80 dark:hover:bg-red-900/50',
    warning:
      'border-amber-300/70 dark:border-amber-500/35 text-amber-900 dark:text-amber-200 bg-white/90 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/40',
    flowing:
      'border-green-300/70 dark:border-green-500/35 text-green-900 dark:text-green-200 bg-white/90 dark:bg-green-950/30 hover:bg-green-100/80 dark:hover:bg-green-900/40'
  }
  return map[variant] || map.warning
}

/** Matches feature-traffic `compute-metrics` / `traffic-signals` stale rule (7 days, status category In Progress). */
const STALE_ISSUE_DAYS = 7

function computeStaleIssueKeysFromFeature(feat) {
  if (!feat?.epics) return []
  const now = Date.now()
  const keys = []
  for (const epic of feat.epics) {
    for (const issue of epic.issues || []) {
      if (issue.statusCategory !== 'In Progress') continue
      const t = new Date(issue.updated).getTime()
      if (Number.isNaN(t)) continue
      const days = (now - t) / (1000 * 60 * 60 * 24)
      if (days > STALE_ISSUE_DAYS) keys.push(issue.key)
    }
  }
  return [...new Set(keys.filter(Boolean))]
}

const STALE_SIGNAL_TITLE_RE = /^\d+\s+stale in-progress issue/i

/**
 * Prefer `issueKeys` from JSON. Older artifacts may list stale counts with an empty `issueKeys` array;
 * derive keys from the embedded epic/issue tree so Jira links still render.
 */
function signalIssueKeys(item) {
  const raw = item.issueKeys
  if (Array.isArray(raw) && raw.length > 0) return raw
  if (STALE_SIGNAL_TITLE_RE.test(String(item.title || ''))) {
    return computeStaleIssueKeysFromFeature(feature.value)
  }
  return []
}

const metricsData = computed(() => {
  const m = feature.value?.metrics
  if (!m) return null
  const byCategory = m.issuesByCategory || {}
  return {
    totalEpics: m.totalEpics || 0,
    totalIssues: m.totalIssues || 0,
    done: byCategory['Done'] || 0,
    inProgress: byCategory['In Progress'] || 0,
    backlog: byCategory['To Do'] || 0,
    blockers: m.blockerCount || 0,
    stale: m.staleCount || 0,
    storyPoints: m.totalStoryPoints || 0,
    storyPointsDone: m.storyPointsDone || 0,
    completionPct: m.completionPct || 0,
    health: m.health || 'YELLOW'
  }
})

function donutArc(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 2 * Math.PI) {
    return `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`
  }
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function ageDays(isoDate) {
  if (!isoDate) return null
  return Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24))
}

function formatDate(iso) {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString()
}

onMounted(() => {
  if (featureKey.value) {
    loadFeature(featureKey.value)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button
      class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
      @click="goBack"
    >
      &larr; Back to Overview
    </button>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading feature details...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Feature detail -->
    <template v-else-if="feature">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <a
                :href="JIRA_BASE + feature.key"
                class="text-primary-600 dark:text-blue-400 hover:underline font-mono text-sm"
                target="_blank"
              >{{ feature.key }}</a>
              <StatusBadge :status="feature.status" />
              <StatusBadge v-if="ownerStatusColor" :health="ownerStatusColor">{{ ownerStatusColor }}</StatusBadge>
              <StatusBadge v-else status="Status color missing" />
            </div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ feature.summary }}</h1>
            <div class="flex flex-wrap gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="feature.assignee">Owner: <span class="text-gray-700 dark:text-gray-300">{{ feature.assignee.displayName }}</span></span>
              <span v-if="feature.pm">PM: <span class="text-gray-700 dark:text-gray-300">{{ feature.pm.displayName }}</span></span>
              <span v-if="feature.releaseType">Release type: <span class="text-gray-700 dark:text-gray-300">{{ feature.releaseType }}</span></span>
              <span>Created: {{ formatDate(feature.created) }}</span>
              <span>Updated: {{ formatDate(feature.updated) }}</span>
              <span
                v-for="v in (feature.fixVersions || [])"
                :key="v"
                class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >{{ v }}</span>
            </div>
          </div>
        </div>

        <!-- Status notes banner -->
        <div
          v-if="feature.statusNotes"
          class="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg"
        >
          <div class="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Status Notes</div>
          <div class="text-sm text-gray-700 dark:text-gray-300" v-html="renderStatusNotes(feature.statusNotes)"></div>
        </div>
      </div>

      <!-- Progress Summary -->
      <div v-if="metricsData" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
          <!-- Donut chart -->
          <div class="flex-shrink-0">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <!-- Background ring -->
              <circle cx="65" cy="65" r="48" fill="none" stroke-width="16" class="stroke-gray-200 dark:stroke-gray-700" />
              <!-- Done arc (green) -->
              <path
                v-if="metricsData.done > 0"
                :d="donutArc(65, 65, 48, -Math.PI / 2, -Math.PI / 2 + (metricsData.done / Math.max(metricsData.totalIssues, 1)) * 2 * Math.PI)"
                fill="none" stroke-width="16" stroke-linecap="round"
                class="stroke-green-500"
              />
              <!-- In Progress arc (blue) -->
              <path
                v-if="metricsData.inProgress > 0"
                :d="donutArc(65, 65, 48,
                  -Math.PI / 2 + (metricsData.done / Math.max(metricsData.totalIssues, 1)) * 2 * Math.PI,
                  -Math.PI / 2 + ((metricsData.done + metricsData.inProgress) / Math.max(metricsData.totalIssues, 1)) * 2 * Math.PI)"
                fill="none" stroke-width="16" stroke-linecap="round"
                class="stroke-blue-500"
              />
              <!-- Center text -->
              <text x="65" y="60" text-anchor="middle" class="fill-gray-900 dark:fill-gray-100" font-size="24" font-weight="bold">{{ metricsData.completionPct }}%</text>
              <text x="65" y="78" text-anchor="middle" class="fill-gray-500 dark:fill-gray-400" font-size="10">complete</text>
            </svg>
          </div>

          <!-- Stat cards -->
          <div class="flex-1 flex flex-wrap items-stretch gap-3 w-full">
            <!-- Epics -->
            <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 min-w-[80px] flex flex-col justify-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metricsData.totalEpics }}</div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Epics</div>
            </div>

            <!-- Story Points -->
            <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 min-w-[80px] flex flex-col justify-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {{ metricsData.storyPointsDone }}<span class="text-gray-400 dark:text-gray-500 text-lg">/{{ metricsData.storyPoints }}</span>
              </div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Story Pts</div>
            </div>

            <!-- Issues group -->
            <div class="flex flex-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <!-- Total issues with blockers/stale footer -->
              <div class="flex-1 text-center px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700">
                <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metricsData.totalIssues }}</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Issues</div>
                <div class="flex items-center justify-center gap-3 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                  <span class="text-[10px] font-semibold" :class="metricsData.blockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'">{{ metricsData.blockers }} <span class="font-normal">blockers</span></span>
                  <span class="text-gray-300 dark:text-gray-600 text-[10px]">&middot;</span>
                  <span class="text-[10px] font-semibold" :class="metricsData.stale > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'">{{ metricsData.stale }} <span class="font-normal">stale</span></span>
                </div>
              </div>
              <!-- Done -->
              <div class="flex-1 text-center px-5 py-3 bg-green-50 dark:bg-green-500/10 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ metricsData.done }}</div>
                <div class="text-[10px] text-green-600 dark:text-green-400 mt-0.5 uppercase tracking-wide">Done</div>
              </div>
              <!-- Active -->
              <div class="flex-1 text-center px-5 py-3 bg-blue-50 dark:bg-blue-500/10 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ metricsData.inProgress }}</div>
                <div class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 uppercase tracking-wide">Active</div>
              </div>
              <!-- Backlog -->
              <div class="flex-1 text-center px-5 py-3 bg-gray-50 dark:bg-gray-900/50 flex flex-col justify-center">
                <div class="text-2xl font-bold text-gray-500 dark:text-gray-400">{{ metricsData.backlog }}</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Backlog</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Days active -->
        <div v-if="feature.created" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
          {{ ageDays(feature.created) }} days active
        </div>
      </div>

      <!-- Traffic Signals (blockers / warnings / flowing) -->
      <div
        v-if="trafficSignals"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Traffic Signals</h2>
          <span
            v-if="trafficSignals.generatedAt"
            class="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums"
          >
            Derived {{ formatSignalTime(trafficSignals.generatedAt) }}
            <span v-if="trafficSignals.source" class="text-gray-400"> · {{ trafficSignals.source }}</span>
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
          <!-- Blockers / risks -->
          <div class="p-4 bg-red-50/80 dark:bg-red-500/5">
            <div class="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-3">
              <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-200/80 dark:bg-red-900/40 text-xs" aria-hidden="true">!</span>
              Blockers / risks
            </div>
            <ul v-if="(trafficSignals.blockers || []).length" class="space-y-3">
              <li v-for="(item, idx) in trafficSignals.blockers" :key="'b-' + idx" class="space-y-1">
                <div class="text-sm font-medium text-red-800 dark:text-red-300">
                  <template v-for="(part, pi) in splitIssueLinkParts(item.title)" :key="'bt-' + idx + '-' + pi">
                    <a
                      v-if="part.kind === 'key'"
                      :href="issueHref(part.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                    >{{ part.key }}</a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </div>
                <p class="text-xs text-red-900/80 dark:text-red-200/80 mt-0.5 leading-relaxed">
                  <template v-for="(part, pi) in splitIssueLinkParts(item.detail)" :key="'bd-' + idx + '-' + pi">
                    <a
                      v-if="part.kind === 'key'"
                      :href="issueHref(part.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                    >{{ part.key }}</a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </p>
                <div v-if="signalIssueKeys(item).length" class="flex flex-wrap gap-1 mt-1">
                  <a
                    v-for="ik in signalIssueKeys(item)"
                    :key="ik"
                    :href="issueHref(ik)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none transition-colors"
                    :class="trafficIssueChipClass('blocker')"
                  >{{ ik }}</a>
                </div>
              </li>
            </ul>
            <p v-else class="text-xs text-red-600/70 dark:text-red-400/60 italic">No blockers identified from ticket data.</p>
          </div>
          <!-- Warnings -->
          <div class="p-4 bg-amber-50/80 dark:bg-amber-500/5">
            <div class="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-semibold text-sm mb-3">
              <span class="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-200/80 dark:bg-amber-900/40 text-xs" aria-hidden="true">▲</span>
              Warnings
            </div>
            <ul v-if="(trafficSignals.warnings || []).length" class="space-y-3">
              <li v-for="(item, idx) in trafficSignals.warnings" :key="'w-' + idx" class="space-y-1">
                <div class="text-sm font-medium text-amber-900 dark:text-amber-300">
                  <template v-for="(part, pi) in splitIssueLinkParts(item.title)" :key="'wt-' + idx + '-' + pi">
                    <a
                      v-if="part.kind === 'key'"
                      :href="issueHref(part.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                    >{{ part.key }}</a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </div>
                <p class="text-xs text-amber-900/80 dark:text-amber-100/80 mt-0.5 leading-relaxed">
                  <template v-for="(part, pi) in splitIssueLinkParts(item.detail)" :key="'wd-' + idx + '-' + pi">
                    <a
                      v-if="part.kind === 'key'"
                      :href="issueHref(part.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                    >{{ part.key }}</a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </p>
                <div v-if="signalIssueKeys(item).length" class="flex flex-wrap gap-1 mt-1">
                  <a
                    v-for="ik in signalIssueKeys(item)"
                    :key="ik"
                    :href="issueHref(ik)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none transition-colors"
                    :class="trafficIssueChipClass('warning')"
                  >{{ ik }}</a>
                </div>
              </li>
            </ul>
            <p v-else class="text-xs text-amber-700/70 dark:text-amber-400/60 italic">No warnings identified from ticket data.</p>
          </div>
          <!-- Flowing well -->
          <div class="p-4 bg-green-50/80 dark:bg-green-500/5">
            <div class="flex items-center gap-2 text-green-800 dark:text-green-400 font-semibold text-sm mb-3">
              <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-200/80 dark:bg-green-900/40 text-xs" aria-hidden="true">✓</span>
              Flowing well
            </div>
            <ul v-if="(trafficSignals.flowing || []).length" class="space-y-3">
              <li v-for="(item, idx) in trafficSignals.flowing" :key="'f-' + idx" class="space-y-1">
                <div class="text-sm font-medium text-green-900 dark:text-green-300">
                  <template v-for="(part, pi) in splitIssueLinkParts(item.title)" :key="'ft-' + idx + '-' + pi">
                    <a
                      v-if="part.kind === 'key'"
                      :href="issueHref(part.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                    >{{ part.key }}</a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </div>
                <p class="text-xs text-green-900/80 dark:text-green-100/80 mt-0.5 leading-relaxed">
                  <template v-for="(part, pi) in splitIssueLinkParts(item.detail)" :key="'fd-' + idx + '-' + pi">
                    <a
                      v-if="part.kind === 'key'"
                      :href="issueHref(part.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                    >{{ part.key }}</a>
                    <span v-else>{{ part.text }}</span>
                  </template>
                </p>
                <div v-if="signalIssueKeys(item).length" class="flex flex-wrap gap-1 mt-1">
                  <a
                    v-for="ik in signalIssueKeys(item)"
                    :key="ik"
                    :href="issueHref(ik)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none transition-colors"
                    :class="trafficIssueChipClass('flowing')"
                  >{{ ik }}</a>
                </div>
              </li>
            </ul>
            <p v-else class="text-xs text-green-700/70 dark:text-green-400/60 italic">Nothing highlighted yet.</p>
          </div>
        </div>
      </div>

      <div
        v-if="validationErrors.length"
        class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4"
      >
        <div class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
          Component hygiene (epic not on feature)
        </div>
        <p class="text-xs text-amber-900/80 dark:text-amber-100/80 mb-2">
          Repos are derived from the feature's Jira components only. Epics that list a component
          the feature does not include should be fixed in Jira.
        </p>
        <ul class="list-disc list-inside text-sm text-amber-900 dark:text-amber-100 space-y-1">
          <li v-for="(err, idx) in validationErrors" :key="idx">
            <span class="font-mono">{{ err.epicKey }}</span> — <span class="font-medium">{{ err.component }}</span>
          </li>
        </ul>
      </div>

      <div
        v-if="unknownFeatureComponents.length"
        class="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg p-4"
      >
        <div class="text-sm font-semibold text-rose-800 dark:text-rose-200 mb-1">Unmapped Jira components</div>
        <p class="text-xs text-rose-900/80 dark:text-rose-100/80">
          Add these to
          <code class="px-1 rounded bg-rose-100/80 dark:bg-rose-900/40">feature-traffic/context/rhoai-components.yaml</code> or fix the feature in Jira:
        </p>
        <p class="text-sm mt-1 font-mono text-rose-800 dark:text-rose-200">{{ unknownFeatureComponents.join(', ') }}</p>
      </div>

      <div
        v-if="hasDeliveryInsight"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delivery view (heuristic)</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Dashboard &amp; backend integration is inferred from component roles, not from every API surface.
        </p>
        <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li v-if="deliveryIntegration?.dashboardConsumesBackend">
            Dashboard is treated as consumer of feature backend APIs.
          </li>
          <li v-if="deliveryIntegration?.notebookIntegration">Notebook / workbench integration (parallel to dashboard when applicable).</li>
          <li v-if="deliveryIntegration?.stages?.length">
            Stages: {{ (deliveryIntegration.stages || []).join(' → ') }}
          </li>
        </ul>
      </div>

      <!-- Traffic map — hidden via SHOW_DELIVERY_PIPELINE; markup kept for easy restore -->
      <div v-if="SHOW_DELIVERY_PIPELINE">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Delivery Pipeline</h2>
        <TrafficMap
          :repos="feature.topology?.repos || []"
          :epics="feature.epics || []"
          :health="feature.metrics?.health || 'YELLOW'"
        />
      </div>

      <!-- Epic breakdown -->
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Epic Breakdown
          <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({{ (feature.epics || []).length }} epics)</span>
        </h2>
        <EpicBreakdown :epics="feature.epics || []" />
      </div>

      <!-- Repo breakdown -->
      <div v-if="(feature.topology?.repos || []).length > 0">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Repository Breakdown</h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Repository</th>
                <th class="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Components</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="repo in feature.topology.repos"
                :key="repo.url"
                class="border-b border-gray-100 dark:border-gray-800"
              >
                <td class="px-4 py-2">
                  <a
                    :href="'https://' + repo.url"
                    class="text-primary-600 dark:text-blue-400 hover:underline text-xs"
                    target="_blank"
                  >{{ repo.url }}</a>
                </td>
                <td class="px-4 py-2">
                  <span
                    v-for="c in (repo.components || [])"
                    :key="c"
                    class="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs mr-1 mb-1"
                  >{{ c }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- No feature key -->
    <div v-else class="text-center py-12 text-gray-500">
      No feature key provided. Go back to the overview and select a feature.
    </div>
  </div>
</template>
