<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  repos: { type: Array, default: () => [] },
  epics: { type: Array, default: () => [] },
  health: { type: String, default: 'YELLOW' }
})

// Detect dark mode
const isDark = ref(false)
let observer = null

function checkDarkMode() {
  isDark.value = document.documentElement.classList.contains('dark')
}

onMounted(() => {
  checkDarkMode()
  observer = new MutationObserver(checkDarkMode)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
})

const c = computed(() => isDark.value ? {
  bg: '#161b22', surface: '#21262d', border: '#30363d',
  text: '#e6edf3', muted: '#8b949e',
  green: '#3fb950', yellow: '#d29922', red: '#f85149', blue: '#58a6ff',
  nodeFill: '#161b22', roadBg: '#30363d'
} : {
  bg: '#ffffff', surface: '#f9fafb', border: '#e5e7eb',
  text: '#1f2937', muted: '#6b7280',
  green: '#16a34a', yellow: '#b45309', red: '#dc2626', blue: '#2563eb',
  nodeFill: '#ffffff', roadBg: '#d1d5db'
})

// Build component nodes from epics
const nodes = computed(() => {
  const compMap = {}

  for (const epic of props.epics) {
    const comps = epic.components && epic.components.length > 0
      ? epic.components
      : ['General']

    const issues = epic.issues || []
    const done = issues.filter(i => i.statusCategory === 'Done').length
    const total = issues.length

    for (const comp of comps) {
      if (!compMap[comp]) {
        compMap[comp] = { name: comp, epics: [], totalIssues: 0, doneIssues: 0, statuses: new Set() }
      }
      compMap[comp].epics.push(epic)
      compMap[comp].totalIssues += total
      compMap[comp].doneIssues += done
      compMap[comp].statuses.add(epic.statusCategory)
    }
  }

  return Object.values(compMap).map(n => ({
    ...n,
    pct: n.totalIssues > 0 ? Math.round((n.doneIssues / n.totalIssues) * 100) : (n.statuses.has('Done') ? 100 : 0),
    health: getHealth(n)
  }))
})

function getHealth(n) {
  if (n.totalIssues > 0 && n.doneIssues === n.totalIssues) return 'green'
  if (n.statuses.has('Done') && !n.statuses.has('In Progress') && !n.statuses.has('To Do')) return 'green'
  if (n.statuses.has('In Progress')) return 'yellow'
  return 'gray'
}

// Classify into lanes: upstream (external/docs), midstream (main work), destination (dashboard/platform)
function classifyLane(name) {
  const lower = name.toLowerCase()
  if (lower.includes('dashboard') || lower.includes('platform') || lower.includes('destination')) return 'dest'
  if (lower.includes('doc') || lower.includes('ux') || lower.includes('design') || lower.includes('external')) return 'upstream'
  return 'midstream'
}

function classifyRepoLane(url) {
  const u = (url || '').toLowerCase()
  if (u.includes('odh-dashboard')) return 'destination'
  if (u.includes('red-hat-data-services') || u.includes('opendatahub-io')) return 'midstream'
  return 'upstream'
}

const lanes = computed(() => {
  const upstream = []
  const midstream = []
  const dest = []

  // If we have repos with URLs, use those
  if (props.repos.length > 0) {
    for (const repo of props.repos) {
      const total = repo.totalIssues || repo.issueCount || 0
      const done = repo.doneIssues || 0
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      const node = {
        name: repoName(repo.url),
        epics: [],
        totalIssues: total,
        doneIssues: done,
        pct,
        health: pct >= 100 ? 'green' : total > 0 ? 'yellow' : 'gray',
        components: repo.components || [],
        subtitle: (repo.components || []).join(', ')
      }
      // Use lane field from enriched data, fall back to URL classification
      const lane = repo.lane || classifyRepoLane(repo.url)
      if (lane === 'destination') dest.push(node)
      else if (lane === 'upstream') upstream.push(node)
      else midstream.push(node)
    }
  }

  // Use component-derived nodes
  if (nodes.value.length > 0 && props.repos.length === 0) {
    for (const node of nodes.value) {
      const lane = classifyLane(node.name)
      if (lane === 'dest') dest.push(node)
      else if (lane === 'upstream') upstream.push(node)
      else midstream.push(node)
    }
  }

  // If midstream has everything and dest is empty, move the largest node to dest
  if (dest.length === 0 && midstream.length > 1) {
    midstream.sort((a, b) => b.totalIssues - a.totalIssues)
    dest.push(midstream.shift())
  }
  // If there's only one node total, put it in midstream
  if (upstream.length === 0 && midstream.length === 0 && dest.length === 1) {
    midstream.push(dest.pop())
  }

  return { upstream, midstream, dest }
})

function repoName(url) {
  if (!url) return ''
  const parts = url.split('/')
  return parts[parts.length - 1] || url
}

// SVG layout calculations
const SVG_W = 900
const SVG_H = computed(() => {
  const maxNodes = Math.max(
    lanes.value.upstream.length,
    lanes.value.midstream.length,
    lanes.value.dest.length,
    1
  )
  return Math.max(200, maxNodes * 90 + 60)
})

const hasData = computed(() => nodes.value.length > 0 || props.repos.length > 0)

// Node positions
function nodeX(lane) {
  if (lane === 'upstream') return 90
  if (lane === 'dest') return SVG_W - 90
  // Midstream nodes spread across middle
  return SVG_W / 2
}

function nodeY(index, total) {
  const h = SVG_H.value
  if (total <= 1) return h / 2
  const spacing = Math.min(85, (h - 80) / Math.max(total - 1, 1))
  const startY = (h - (total - 1) * spacing) / 2
  return startY + index * spacing
}

function midstreamX(index, total) {
  if (total <= 1) return SVG_W / 2
  const startX = 280
  const endX = 620
  const spacing = (endX - startX) / Math.max(total - 1, 1)
  return startX + index * spacing
}

// Road connections
const roads = computed(() => {
  const result = []
  const { upstream, midstream, dest } = lanes.value

  // Upstream → first midstream node
  if (upstream.length > 0 && midstream.length > 0) {
    for (let i = 0; i < upstream.length; i++) {
      const fromX = nodeX('upstream') + 70
      const fromY = nodeY(i, upstream.length)
      const toX = midstreamX(0, midstream.length) - 80
      const toY = nodeY(0, midstream.length)
      result.push({ fromX, fromY, toX, toY, health: upstream[i].health })
    }
  }

  // Between midstream nodes
  if (midstream.length > 1) {
    for (let i = 0; i < midstream.length - 1; i++) {
      const fromX = midstreamX(i, midstream.length) + 70
      const fromY = nodeY(i, midstream.length)
      const toX = midstreamX(i + 1, midstream.length) - 80
      const toY = nodeY(i + 1, midstream.length)
      result.push({ fromX, fromY, toX, toY, health: midstream[i].health })
    }
  }

  // Last midstream → destination
  if (midstream.length > 0 && dest.length > 0) {
    const lastMid = midstream.length - 1
    for (let i = 0; i < dest.length; i++) {
      const fromX = midstreamX(lastMid, midstream.length) + 70
      const fromY = nodeY(lastMid, midstream.length)
      const toX = nodeX('dest') - 70
      const toY = nodeY(i, dest.length)
      result.push({ fromX, fromY, toX, toY, health: midstream[lastMid].health })
    }
  }

  // If no midstream, upstream → dest
  if (midstream.length === 0 && upstream.length > 0 && dest.length > 0) {
    for (let i = 0; i < upstream.length; i++) {
      result.push({
        fromX: nodeX('upstream') + 70,
        fromY: nodeY(i, upstream.length),
        toX: nodeX('dest') - 70,
        toY: nodeY(0, dest.length),
        health: upstream[i].health
      })
    }
  }

  return result
})

function roadPath(road) {
  const mx = (road.fromX + road.toX) / 2
  return `M ${road.fromX} ${road.fromY} C ${mx} ${road.fromY} ${mx} ${road.toY} ${road.toX} ${road.toY}`
}

function healthColor(h) {
  if (h === 'green') return c.value.green
  if (h === 'yellow') return c.value.yellow
  if (h === 'gray') return c.value.muted
  return c.value.yellow
}

function statusText(node) {
  if (node.pct >= 100) return 'Complete ✓'
  if (node.pct > 0) return node.pct + '% done'
  if (node.health === 'yellow') return 'In Progress'
  return 'Not Started'
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <template v-if="hasData">
      <!-- Zone headers -->
      <div class="grid grid-cols-[20%_60%_20%] border-b border-gray-200 dark:border-gray-700">
        <div class="text-center py-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Upstream / External
        </div>
        <div class="text-center py-2 text-[11px] font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
          Midstream / Red Hat
        </div>
        <div class="text-center py-2 text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
          Final Destination
        </div>
      </div>

      <!-- SVG traffic map -->
      <div class="p-2">
        <svg :width="SVG_W" :height="SVG_H" :viewBox="'0 0 ' + SVG_W + ' ' + SVG_H" class="w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="node-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <!-- Zone dividers -->
          <line x1="180" y1="0" x2="180" :y2="SVG_H" :stroke="c.border" stroke-width="1" stroke-dasharray="4,4" />
          <line x1="720" y1="0" x2="720" :y2="SVG_H" :stroke="c.border" stroke-width="1" stroke-dasharray="4,4" />

          <!-- Roads -->
          <template v-for="(road, i) in roads" :key="'road-' + i">
            <!-- Road background -->
            <path :d="roadPath(road)" fill="none" :stroke="c.roadBg" stroke-width="14" stroke-linecap="round" />
            <!-- Animated flow -->
            <path :d="roadPath(road)" fill="none" :stroke="healthColor(road.health)" stroke-width="4" stroke-dasharray="10,6" opacity="0.8">
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="2s" repeatCount="indefinite" />
            </path>
          </template>

          <!-- Upstream nodes -->
          <g v-for="(node, i) in lanes.upstream" :key="'up-' + i"
             :transform="'translate(' + nodeX('upstream') + ',' + nodeY(i, lanes.upstream.length) + ')'">
            <rect x="-68" y="-36" width="136" height="72" rx="10"
                  :fill="c.nodeFill" :stroke="healthColor(node.health)" stroke-width="1.5" opacity="0.9" />
            <circle cx="-52" cy="-20" r="5" :fill="healthColor(node.health)" />
            <text x="0" y="-18" text-anchor="middle" font-size="9" :fill="c.muted">{{ node.subtitle || (node.epics?.length || 0) + ' epics' }}</text>
            <text x="0" y="-4" text-anchor="middle" font-size="11" font-weight="600" :fill="c.text">{{ node.name }}</text>
            <!-- Progress bar -->
            <rect x="-50" y="6" width="100" height="4" rx="2" :fill="c.surface" />
            <rect v-if="node.pct > 0" x="-50" y="6" :width="node.pct" height="4" rx="2" :fill="healthColor(node.health)" />
            <text x="0" y="22" text-anchor="middle" font-size="9" :fill="healthColor(node.health)">{{ statusText(node) }}</text>
          </g>

          <!-- Midstream nodes -->
          <g v-for="(node, i) in lanes.midstream" :key="'mid-' + i"
             :transform="'translate(' + midstreamX(i, lanes.midstream.length) + ',' + nodeY(i, lanes.midstream.length) + ')'"
             :class="{ 'node-active': node.health === 'yellow' }">
            <rect x="-72" y="-38" width="144" height="76" rx="10"
                  :fill="c.nodeFill" :stroke="healthColor(node.health)" stroke-width="1.5"
                  :filter="node.health === 'yellow' ? 'url(#node-glow)' : ''"
                  opacity="0.9" />
            <circle cx="-56" cy="-22" r="5" :fill="healthColor(node.health)"
                    :class="{ 'node-active': node.health === 'yellow' }" />
            <text x="0" y="-18" text-anchor="middle" font-size="9" :fill="c.muted">{{ node.subtitle || (node.epics?.length || 0) + ' epics' }}</text>
            <text x="0" y="-4" text-anchor="middle" font-size="11" font-weight="600" :fill="c.text">{{ node.name }}</text>
            <!-- Progress bar -->
            <rect x="-54" y="10" width="108" height="5" rx="2" :fill="c.surface" />
            <rect v-if="node.pct > 0" x="-54" y="10" :width="Math.round(108 * node.pct / 100)" height="5" rx="2" :fill="healthColor(node.health)" />
            <text x="0" y="28" text-anchor="middle" font-size="9" :fill="healthColor(node.health)">{{ statusText(node) }}</text>
          </g>

          <!-- Destination nodes -->
          <g v-for="(node, i) in lanes.dest" :key="'dest-' + i"
             :transform="'translate(' + nodeX('dest') + ',' + nodeY(i, lanes.dest.length) + ')'"
             :class="{ 'node-active': node.health !== 'gray' }">
            <rect x="-68" y="-36" width="136" height="72" rx="12"
                  :fill="isDark ? '#0d1f38' : '#eff6ff'" :stroke="healthColor(node.health)" stroke-width="2"
                  :class="{ 'node-active': node.health !== 'gray' }"
                  opacity="0.95" />
            <circle cx="-52" cy="-20" r="5" :fill="healthColor(node.health)"
                    :class="{ 'node-active': node.health !== 'gray' }" />
            <text x="0" y="-18" text-anchor="middle" font-size="9" :fill="c.muted">{{ node.subtitle || (node.epics?.length || 0) + ' epics' }}</text>
            <text x="0" y="-4" text-anchor="middle" font-size="11" font-weight="600" :fill="c.text">{{ node.name }}</text>
            <!-- Progress bar -->
            <rect x="-50" y="6" width="100" height="4" rx="2" :fill="c.surface" />
            <rect v-if="node.pct > 0" x="-50" y="6" :width="node.pct" height="4" rx="2" :fill="healthColor(node.health)" />
            <text x="0" y="22" text-anchor="middle" font-size="9" :fill="healthColor(node.health)">{{ statusText(node) }}</text>
          </g>

          <!-- Empty lane placeholders -->
          <text v-if="lanes.upstream.length === 0" x="90" :y="SVG_H / 2" text-anchor="middle" font-size="10" :fill="c.muted" opacity="0.5">No external deps</text>
        </svg>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      No component or repository data available for this feature.
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse-glow {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
.node-active {
  animation: pulse-glow 2.8s ease-in-out infinite;
}
</style>
