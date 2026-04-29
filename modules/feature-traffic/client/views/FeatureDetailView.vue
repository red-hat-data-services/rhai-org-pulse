<script setup>
import { onMounted, inject, computed } from 'vue'
import { useFeatureDetail } from '../composables/useFeatureTraffic'
import StatusBadge from '../components/StatusBadge.vue'
import TrafficMap from '../components/TrafficMap.vue'
import EpicBreakdown from '../components/EpicBreakdown.vue'

const nav = inject('moduleNav')
const { feature, loading, error, loadFeature } = useFeatureDetail()

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

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

function goBack() {
  nav.navigateTo('overview')
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

      <!-- Traffic map -->
      <div>
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
