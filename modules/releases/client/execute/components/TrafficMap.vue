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
    const comps = epic.components && epic.components.length > 0 ? epic.components : ['General']
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

function healthFromPct(pct, total) {
  if (total === 0) return 'gray'
  if (pct >= 50) return 'green'
  if (pct > 0) return 'yellow'
  return 'gray'
}

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

  if (props.repos.length > 0) {
    for (const repo of props.repos) {
      const total = repo.totalIssues || repo.issueCount || 0
      const done = repo.doneIssues || 0
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      const comps = repo.components || []
      const repoOrg = repoOrgName(repo.url)
      // Find epics that share components with this repo
      const compSet = new Set(comps.map(comp => comp.toLowerCase()))
      const matchedEpics = props.epics.filter(e =>
        (e.components || []).some(comp => compSet.has(comp.toLowerCase()))
      )
      const node = {
        name: repoName(repo.url),
        epics: matchedEpics,
        totalIssues: total,
        doneIssues: done,
        pct,
        health: healthFromPct(pct, total),
        components: comps,
        subtitle: comps.length > 0 ? comps.slice(0, 2).join(', ') + (comps.length > 2 ? ' +' + (comps.length - 2) : '') : repoOrg
      }
      const lane = repo.lane || classifyRepoLane(repo.url)
      if (lane === 'destination') dest.push(node)
      else if (lane === 'upstream') upstream.push(node)
      else midstream.push(node)
    }
  }

  if (nodes.value.length > 0 && props.repos.length === 0) {
    for (const node of nodes.value) {
      const lane = classifyLane(node.name)
      if (lane === 'dest') dest.push(node)
      else if (lane === 'upstream') upstream.push(node)
      else midstream.push(node)
    }
  }

  if (dest.length === 0 && midstream.length > 1) {
    midstream.sort((a, b) => b.totalIssues - a.totalIssues)
    dest.push(midstream.shift())
  }
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

function repoOrgName(url) {
  if (!url) return ''
  const parts = url.replace(/^https?:\/\//, '').split('/')
  if (parts.length >= 3) return parts[1] + '/' + parts[2]
  return parts.join('/')
}

// Layout constants
const SVG_W = 1000
// Zone boundaries as fractions — header grid and SVG dividers use same values
const ZONE_FRAC_LEFT = 0.22
const ZONE_FRAC_RIGHT = 0.78
const ZONE_LEFT = Math.round(SVG_W * ZONE_FRAC_LEFT)
const ZONE_RIGHT = Math.round(SVG_W * ZONE_FRAC_RIGHT)
const UPSTREAM_CX = Math.round(ZONE_LEFT / 2)
const DEST_CX = Math.round((SVG_W + ZONE_RIGHT) / 2)

// Node sizes
const NODE_W = 158
const NODE_H = 100
const MID_NODE_W = 173
const MID_NODE_H = 105

const SVG_H = computed(() => {
  const maxNodes = Math.max(
    lanes.value.upstream.length,
    lanes.value.midstream.length,
    lanes.value.dest.length,
    1
  )
  return Math.max(220, maxNodes * 115 + 70)
})

const hasData = computed(() => nodes.value.length > 0 || props.repos.length > 0)

function nodeX(lane) {
  if (lane === 'upstream') return UPSTREAM_CX
  if (lane === 'dest') return DEST_CX
  return SVG_W / 2
}

function nodeY(index, total) {
  const h = SVG_H.value
  if (total <= 1) return h / 2
  const spacing = Math.min(150, (h - 100) / Math.max(total - 1, 1))
  const startY = (h - (total - 1) * spacing) / 2
  return startY + index * spacing
}

function midstreamX(index, total) {
  if (total <= 1) return SVG_W / 2
  const pad = MID_NODE_W / 2 + 20
  const startX = ZONE_LEFT + pad
  const endX = ZONE_RIGHT - pad
  const spacing = (endX - startX) / Math.max(total - 1, 1)
  return startX + index * spacing
}

// Text wrapping for long repo names
function wrapText(text, maxChars) {
  if (!text || text.length <= maxChars) return [text || '']
  // Try splitting at hyphens or slashes
  const breaks = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '-' || text[i] === '/' || text[i] === '_') breaks.push(i + 1)
  }
  if (breaks.length > 0) {
    // Find the best break point closest to the middle
    const mid = text.length / 2
    let best = breaks[0]
    for (const b of breaks) {
      if (Math.abs(b - mid) < Math.abs(best - mid)) best = b
    }
    return [text.substring(0, best), text.substring(best)]
  }
  // Hard split
  return [text.substring(0, maxChars), text.substring(maxChars)]
}

// Road connections
const roads = computed(() => {
  const result = []
  const { upstream, midstream, dest } = lanes.value
  const upEdge = NODE_W / 2
  const midEdge = MID_NODE_W / 2

  if (upstream.length > 0 && midstream.length > 0) {
    for (let i = 0; i < upstream.length; i++) {
      result.push({
        fromX: nodeX('upstream') + upEdge, fromY: nodeY(i, upstream.length),
        toX: midstreamX(0, midstream.length) - midEdge, toY: nodeY(0, midstream.length),
        health: upstream[i].health, fromNode: upstream[i], toNode: midstream[0]
      })
    }
  }
  if (midstream.length > 1) {
    for (let i = 0; i < midstream.length - 1; i++) {
      result.push({
        fromX: midstreamX(i, midstream.length) + midEdge, fromY: nodeY(i, midstream.length),
        toX: midstreamX(i + 1, midstream.length) - midEdge, toY: nodeY(i + 1, midstream.length),
        health: midstream[i].health, fromNode: midstream[i], toNode: midstream[i + 1]
      })
    }
  }
  if (midstream.length > 0 && dest.length > 0) {
    const lastMid = midstream.length - 1
    for (let i = 0; i < dest.length; i++) {
      result.push({
        fromX: midstreamX(lastMid, midstream.length) + midEdge, fromY: nodeY(lastMid, midstream.length),
        toX: nodeX('dest') - upEdge, toY: nodeY(i, dest.length),
        health: midstream[lastMid].health, fromNode: midstream[lastMid], toNode: dest[i]
      })
    }
  }
  if (midstream.length === 0 && upstream.length > 0 && dest.length > 0) {
    for (let i = 0; i < upstream.length; i++) {
      result.push({
        fromX: nodeX('upstream') + upEdge, fromY: nodeY(i, upstream.length),
        toX: nodeX('dest') - upEdge, toY: nodeY(0, dest.length),
        health: upstream[i].health, fromNode: upstream[i], toNode: dest[0]
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
  if (h === 'red') return c.value.red
  if (h === 'gray') return c.value.muted
  return c.value.yellow
}

function statusText(node) {
  if (node.pct >= 100) return 'Complete ✓'
  if (node.totalIssues > 0 && node.doneIssues > 0) {
    return node.doneIssues + '/' + node.totalIssues + ' done (' + node.pct + '%)'
  }
  if (node.pct > 0) return node.pct + '% done'
  if (node.health === 'yellow') return 'In Progress'
  return 'Not Started'
}

// Milestone keywords to detect in epic summaries (case-insensitive)
const MILESTONE_PATTERNS = [
  { pattern: /konflux\s*onboard/i, done: 'Konflux onboarded ✓', active: 'Konflux onboarding' },
  { pattern: /\bEA\s*1\b/i, done: 'EA1 delivered', active: 'EA1 in progress' },
  { pattern: /\bEA\s*2\b/i, done: 'EA2 delivered', active: 'EA2 in progress' },
  { pattern: /\bGA\b/i, done: 'GA delivered', active: 'GA in progress' },
  { pattern: /\bfoundation\b/i, done: 'Foundation done', active: null },
  { pattern: /\bdeployment\b/i, done: 'Deployment done', active: null },
  { pattern: /\bMVP\b/i, done: 'MVP delivered', active: 'MVP in progress' },
  { pattern: /\btech[\s-]*preview\b/i, done: 'Tech Preview delivered', active: 'Tech Preview' },
  { pattern: /\bdev[\s-]*preview\b/i, done: 'Dev Preview delivered', active: 'Dev Preview' },
  { pattern: /\bbeta\b/i, done: 'Beta delivered', active: 'Beta in progress' }
]

function narrativeLines(node, maxChars) {
  const text = narrativeRaw(node)
  if (text.length <= maxChars) return [text]
  // Split at · separator first
  if (text.includes(' · ')) {
    const parts = text.split(' · ')
    return parts.slice(0, 2)
  }
  // Split at natural break points
  return wrapText(text, maxChars)
}

function narrativeRaw(node) {
  const epics = node.epics || []
  if (epics.length === 0) return statusText(node)

  const nuggets = []

  // Check for milestone epics
  for (const mp of MILESTONE_PATTERNS) {
    for (const epic of epics) {
      if (mp.pattern.test(epic.summary || '')) {
        if (epic.statusCategory === 'Done' && mp.done) {
          nuggets.push(mp.done)
        } else if (epic.statusCategory === 'In Progress' && mp.active) {
          nuggets.push(mp.active)
        }
        break // one match per pattern
      }
    }
  }

  // Add completion context if we have milestone nuggets
  if (nuggets.length > 0) {
    if (node.pct > 0 && node.pct < 100) {
      nuggets.unshift(node.pct + '% done')
    } else if (node.pct >= 100) {
      nuggets.unshift('Complete ✓')
    }
    return nuggets.slice(0, 2).join(' · ')
  }

  // No milestones found — fall back to summarizing done epic names
  const doneEpics = epics.filter(e => e.statusCategory === 'Done')
  if (doneEpics.length > 0 && doneEpics.length === epics.length) {
    const names = doneEpics.slice(0, 2).map(e => shortEpicName(e.summary))
    return names.join(' + ') + ' done'
  }

  return statusText(node)
}

function shortEpicName(summary) {
  if (!summary) return ''
  const stripped = summary.replace(/^[\w\s]+\s*[—–-]\s*/, '')
  if (stripped.length > 20) return stripped.substring(0, 18) + '…'
  return stripped
}

function roadLabel(road) {
  const from = road.fromNode
  if (!from) return ''
  if (from.pct > 0 && from.pct < 100) return from.name + ' (' + from.pct + '%)'
  if (from.name) return from.name
  return ''
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <template v-if="hasData">
      <!-- Zone headers — fractions match SVG zone dividers exactly -->
      <div
        class="border-b border-gray-200 dark:border-gray-700"
        :style="'display:grid; grid-template-columns:' + (ZONE_FRAC_LEFT * 100) + '% ' + ((ZONE_FRAC_RIGHT - ZONE_FRAC_LEFT) * 100) + '% ' + ((1 - ZONE_FRAC_RIGHT) * 100) + '%'"
      >
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

      <!-- SVG traffic map — no padding so it aligns with header grid -->
      <svg :viewBox="'0 0 ' + SVG_W + ' ' + SVG_H" class="w-full block" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="node-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- Zone dividers -->
        <line :x1="ZONE_LEFT" y1="0" :x2="ZONE_LEFT" :y2="SVG_H" :stroke="c.border" stroke-width="1" stroke-dasharray="4,4" />
        <line :x1="ZONE_RIGHT" y1="0" :x2="ZONE_RIGHT" :y2="SVG_H" :stroke="c.border" stroke-width="1" stroke-dasharray="4,4" />

        <!-- Roads -->
        <template v-for="(road, i) in roads" :key="'road-' + i">
          <path :d="roadPath(road)" fill="none" :stroke="c.roadBg" stroke-width="16" stroke-linecap="round" />
          <path :d="roadPath(road)" fill="none" :stroke="healthColor(road.health)" stroke-width="5" stroke-dasharray="12,7" opacity="0.8">
            <animate attributeName="stroke-dashoffset" from="38" to="0" dur="2s" repeatCount="indefinite" />
          </path>
          <text
            v-if="roadLabel(road)"
            :x="(road.fromX + road.toX) / 2"
            :y="(road.fromY + road.toY) / 2 - 16"
            text-anchor="middle"
            font-size="10"
            :fill="healthColor(road.health)"
          >{{ roadLabel(road) }}</text>
        </template>

        <!-- Upstream nodes -->
        <g v-for="(node, i) in lanes.upstream" :key="'up-' + i"
           :transform="'translate(' + nodeX('upstream') + ',' + nodeY(i, lanes.upstream.length) + ')'">
          <rect :x="-NODE_W/2" :y="-NODE_H/2" :width="NODE_W" :height="NODE_H" rx="10"
                :fill="c.nodeFill" :stroke="healthColor(node.health)" stroke-width="2" opacity="0.9" />
          <circle :cx="-NODE_W/2 + 10" :cy="-NODE_H/2 + 10" r="5" :fill="healthColor(node.health)" />
          <text x="0" y="-18" text-anchor="middle" font-size="10" :fill="c.muted">{{ node.subtitle || (node.epics?.length || 0) + ' epics' }}</text>
          <template v-if="wrapText(node.name, 18).length === 1">
            <text x="0" y="0" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ node.name }}</text>
          </template>
          <template v-else>
            <text x="0" y="-6" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ wrapText(node.name, 18)[0] }}</text>
            <text x="0" y="10" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ wrapText(node.name, 18)[1] }}</text>
          </template>
          <rect :x="-NODE_W/2 + 16" y="16" :width="NODE_W - 32" height="5" rx="2" :fill="c.surface" />
          <rect v-if="node.pct > 0" :x="-NODE_W/2 + 16" y="16" :width="Math.round((NODE_W - 32) * node.pct / 100)" height="5" rx="2" :fill="healthColor(node.health)" />
          <template v-if="narrativeLines(node, 20).length === 1">
            <text x="0" y="32" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 20)[0] }}</text>
          </template>
          <template v-else>
            <text x="0" y="29" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 20)[0] }}</text>
            <text x="0" y="41" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 20)[1] }}</text>
          </template>
        </g>

        <!-- Midstream nodes -->
        <g v-for="(node, i) in lanes.midstream" :key="'mid-' + i"
           :transform="'translate(' + midstreamX(i, lanes.midstream.length) + ',' + nodeY(i, lanes.midstream.length) + ')'"
           :class="{ 'node-active': node.health === 'yellow' }">
          <rect :x="-MID_NODE_W/2" :y="-MID_NODE_H/2" :width="MID_NODE_W" :height="MID_NODE_H" rx="10"
                :fill="c.nodeFill" :stroke="healthColor(node.health)" stroke-width="2"
                :filter="node.health !== 'gray' ? 'url(#node-glow)' : ''"
                opacity="0.9" />
          <circle :cx="-MID_NODE_W/2 + 10" :cy="-MID_NODE_H/2 + 10" r="5" :fill="healthColor(node.health)"
                  :class="{ 'node-active': node.health === 'yellow' }" />
          <text x="0" y="-20" text-anchor="middle" font-size="10" :fill="c.muted">{{ node.subtitle || (node.epics?.length || 0) + ' epics' }}</text>
          <template v-if="wrapText(node.name, 20).length === 1">
            <text x="0" y="0" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ node.name }}</text>
          </template>
          <template v-else>
            <text x="0" y="-6" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ wrapText(node.name, 20)[0] }}</text>
            <text x="0" y="10" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ wrapText(node.name, 20)[1] }}</text>
          </template>
          <rect :x="-MID_NODE_W/2 + 16" y="18" :width="MID_NODE_W - 32" height="5" rx="2" :fill="c.surface" />
          <rect v-if="node.pct > 0" :x="-MID_NODE_W/2 + 16" y="18" :width="Math.round((MID_NODE_W - 32) * node.pct / 100)" height="5" rx="2" :fill="healthColor(node.health)" />
          <template v-if="narrativeLines(node, 22).length === 1">
            <text x="0" y="34" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 22)[0] }}</text>
          </template>
          <template v-else>
            <text x="0" y="31" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 22)[0] }}</text>
            <text x="0" y="43" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 22)[1] }}</text>
          </template>
        </g>

        <!-- Destination nodes -->
        <g v-for="(node, i) in lanes.dest" :key="'dest-' + i"
           :transform="'translate(' + nodeX('dest') + ',' + nodeY(i, lanes.dest.length) + ')'"
           :class="{ 'node-active': node.health !== 'gray' }">
          <rect :x="-NODE_W/2" :y="-NODE_H/2" :width="NODE_W" :height="NODE_H" rx="12"
                :fill="isDark ? '#0d1f38' : '#eff6ff'" :stroke="healthColor(node.health)" stroke-width="2.5"
                :class="{ 'node-active': node.health !== 'gray' }"
                opacity="0.95" />
          <circle :cx="-NODE_W/2 + 10" :cy="-NODE_H/2 + 10" r="5" :fill="healthColor(node.health)"
                  :class="{ 'node-active': node.health !== 'gray' }" />
          <text x="0" y="-18" text-anchor="middle" font-size="10" :fill="c.muted">{{ node.subtitle || (node.epics?.length || 0) + ' epics' }}</text>
          <template v-if="wrapText(node.name, 18).length === 1">
            <text x="0" y="0" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ node.name }}</text>
          </template>
          <template v-else>
            <text x="0" y="-6" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ wrapText(node.name, 18)[0] }}</text>
            <text x="0" y="10" text-anchor="middle" font-size="13" font-weight="600" :fill="c.text">{{ wrapText(node.name, 18)[1] }}</text>
          </template>
          <rect :x="-NODE_W/2 + 16" y="16" :width="NODE_W - 32" height="5" rx="2" :fill="c.surface" />
          <rect v-if="node.pct > 0" :x="-NODE_W/2 + 16" y="16" :width="Math.round((NODE_W - 32) * node.pct / 100)" height="5" rx="2" :fill="healthColor(node.health)" />
          <template v-if="narrativeLines(node, 20).length === 1">
            <text x="0" y="32" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 20)[0] }}</text>
          </template>
          <template v-else>
            <text x="0" y="29" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 20)[0] }}</text>
            <text x="0" y="41" text-anchor="middle" font-size="10" :fill="healthColor(node.health)">{{ narrativeLines(node, 20)[1] }}</text>
          </template>
        </g>

        <!-- Empty lane placeholders -->
        <text v-if="lanes.upstream.length === 0" :x="UPSTREAM_CX" :y="SVG_H / 2" text-anchor="middle" font-size="13" :fill="c.muted" opacity="0.5">No external deps</text>
      </svg>
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
