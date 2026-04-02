<script setup>
import { computed } from 'vue'

const props = defineProps({
  repos: { type: Array, default: () => [] },
  epics: { type: Array, default: () => [] },
  health: { type: String, default: 'YELLOW' }
})

const LANE_COLORS = {
  upstream: '#58a6ff',
  midstream: '#d29922',
  destination: '#3fb950'
}

const healthColors = {
  GREEN: '#3fb950',
  YELLOW: '#d29922',
  RED: '#f85149'
}

// Classify repos into lanes
const lanes = computed(() => {
  const upstream = []
  const midstream = []
  const destination = []

  for (const repo of props.repos) {
    const url = repo.url.toLowerCase()
    if (url.includes('opendatahub-io/odh-dashboard')) {
      destination.push(repo)
    } else if (url.includes('red-hat-data-services') || url.includes('opendatahub-io')) {
      midstream.push(repo)
    } else {
      upstream.push(repo)
    }
  }

  return { upstream, midstream, destination }
})

// SVG layout
const SVG_WIDTH = 800
const SVG_HEIGHT = computed(() => {
  const maxNodes = Math.max(
    lanes.value.upstream.length,
    lanes.value.midstream.length,
    lanes.value.destination.length,
    1
  )
  return Math.max(300, maxNodes * 80 + 100)
})

const LANE_WIDTH = SVG_WIDTH / 3

function repoName(url) {
  const parts = url.split('/')
  return parts[parts.length - 1] || url
}

function nodeX(laneIndex) {
  return laneIndex * LANE_WIDTH + LANE_WIDTH / 2
}

function nodeY(index, total) {
  const spacing = Math.min(70, (SVG_HEIGHT.value - 100) / Math.max(total, 1))
  const startY = (SVG_HEIGHT.value - total * spacing) / 2 + 30
  return startY + index * spacing
}
</script>

<template>
  <div class="bg-surface rounded-lg border border-gray-700 p-4 overflow-x-auto">
    <svg :width="SVG_WIDTH" :height="SVG_HEIGHT" class="mx-auto">
      <defs>
        <!-- Glow filter for active nodes -->
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Lane headers -->
      <text :x="nodeX(0)" y="20" text-anchor="middle" fill="#8b949e" font-size="12" font-weight="bold">
        Upstream / External
      </text>
      <text :x="nodeX(1)" y="20" text-anchor="middle" fill="#8b949e" font-size="12" font-weight="bold">
        Midstream / Red Hat
      </text>
      <text :x="nodeX(2)" y="20" text-anchor="middle" fill="#8b949e" font-size="12" font-weight="bold">
        Final Destination
      </text>

      <!-- Lane dividers -->
      <line :x1="LANE_WIDTH" y1="30" :x2="LANE_WIDTH" :y2="SVG_HEIGHT - 10" stroke="#30363d" stroke-width="1" stroke-dasharray="4,4" />
      <line :x1="LANE_WIDTH * 2" y1="30" :x2="LANE_WIDTH * 2" :y2="SVG_HEIGHT - 10" stroke="#30363d" stroke-width="1" stroke-dasharray="4,4" />

      <!-- Connection paths: upstream -> midstream -->
      <line
        v-for="(repo, i) in lanes.upstream"
        :key="'conn-up-' + i"
        :x1="nodeX(0) + 60"
        :y1="nodeY(i, lanes.upstream.length)"
        :x2="nodeX(1) - 60"
        :y2="nodeY(Math.min(i, lanes.midstream.length - 1), Math.max(lanes.midstream.length, 1))"
        stroke="#30363d"
        stroke-width="2"
        stroke-dasharray="6,4"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="2s" repeatCount="indefinite" />
      </line>

      <!-- Connection paths: midstream -> destination -->
      <line
        v-for="(repo, i) in lanes.midstream"
        :key="'conn-mid-' + i"
        :x1="nodeX(1) + 60"
        :y1="nodeY(i, lanes.midstream.length)"
        :x2="nodeX(2) - 60"
        :y2="nodeY(0, Math.max(lanes.destination.length, 1))"
        stroke="#30363d"
        stroke-width="2"
        stroke-dasharray="6,4"
      >
        <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="2s" repeatCount="indefinite" />
      </line>

      <!-- Upstream nodes -->
      <g v-for="(repo, i) in lanes.upstream" :key="'up-' + i">
        <rect
          :x="nodeX(0) - 55"
          :y="nodeY(i, lanes.upstream.length) - 15"
          width="110"
          height="30"
          rx="6"
          fill="#161b22"
          :stroke="LANE_COLORS.upstream"
          stroke-width="1.5"
        />
        <circle
          :cx="nodeX(0) - 45"
          :cy="nodeY(i, lanes.upstream.length)"
          r="4"
          :fill="repo.issueCount > 0 ? healthColors[health] : '#484f58'"
        />
        <text
          :x="nodeX(0) - 35"
          :y="nodeY(i, lanes.upstream.length) + 4"
          fill="#c9d1d9"
          font-size="10"
        >{{ repoName(repo.url) }}</text>
        <text
          :x="nodeX(0) + 45"
          :y="nodeY(i, lanes.upstream.length) + 4"
          fill="#8b949e"
          font-size="9"
          text-anchor="end"
        >{{ repo.issueCount }}</text>
      </g>

      <!-- Midstream nodes -->
      <g v-for="(repo, i) in lanes.midstream" :key="'mid-' + i">
        <rect
          :x="nodeX(1) - 55"
          :y="nodeY(i, lanes.midstream.length) - 15"
          width="110"
          height="30"
          rx="6"
          fill="#161b22"
          :stroke="LANE_COLORS.midstream"
          stroke-width="1.5"
          :filter="repo.issueCount > 0 ? 'url(#glow)' : ''"
        />
        <circle
          :cx="nodeX(1) - 45"
          :cy="nodeY(i, lanes.midstream.length)"
          r="4"
          :fill="repo.issueCount > 0 ? healthColors[health] : '#484f58'"
        />
        <text
          :x="nodeX(1) - 35"
          :y="nodeY(i, lanes.midstream.length) + 4"
          fill="#c9d1d9"
          font-size="10"
        >{{ repoName(repo.url) }}</text>
        <text
          :x="nodeX(1) + 45"
          :y="nodeY(i, lanes.midstream.length) + 4"
          fill="#8b949e"
          font-size="9"
          text-anchor="end"
        >{{ repo.issueCount }}</text>
      </g>

      <!-- Destination nodes -->
      <g v-for="(repo, i) in lanes.destination" :key="'dest-' + i">
        <rect
          :x="nodeX(2) - 55"
          :y="nodeY(i, lanes.destination.length) - 15"
          width="110"
          height="30"
          rx="6"
          fill="#161b22"
          :stroke="LANE_COLORS.destination"
          stroke-width="2"
          filter="url(#glow)"
        />
        <circle
          :cx="nodeX(2) - 45"
          :cy="nodeY(i, lanes.destination.length)"
          r="4"
          :fill="healthColors[health]"
        />
        <text
          :x="nodeX(2) - 35"
          :y="nodeY(i, lanes.destination.length) + 4"
          fill="#c9d1d9"
          font-size="10"
        >{{ repoName(repo.url) }}</text>
        <text
          :x="nodeX(2) + 45"
          :y="nodeY(i, lanes.destination.length) + 4"
          fill="#8b949e"
          font-size="9"
          text-anchor="end"
        >{{ repo.issueCount }}</text>
      </g>

      <!-- Empty state -->
      <text
        v-if="repos.length === 0"
        :x="SVG_WIDTH / 2"
        :y="SVG_HEIGHT / 2"
        text-anchor="middle"
        fill="#8b949e"
        font-size="14"
      >No repository data available</text>
    </svg>
  </div>
</template>
