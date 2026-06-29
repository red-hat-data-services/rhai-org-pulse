<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div class="h-8 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div class="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>

    <!-- Not found -->
    <div v-else-if="!entry" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Entry not found.</p>
      <button
        class="mt-4 text-primary-600 dark:text-primary-400 hover:underline text-sm"
        @click="nav.goBack()"
      >
        Back to catalog
      </button>
    </div>

    <!-- Entry detail -->
    <template v-else>
      <!-- Back button -->
      <button
        class="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
        @click="nav.goBack()"
      >
        <component :is="ArrowLeftIcon" :size="14" />
        Back to catalog
      </button>

      <!-- Title + summary -->
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{{ entry.title }}</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">{{ entry.shortSummary }}</p>

      <!-- Demo video -->
      <div v-if="entry.demoVideoUrl" class="mb-8">
        <div v-if="embedUrl" class="aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            :src="embedUrl"
            class="w-full h-full"
            frameborder="0"
            sandbox="allow-scripts allow-same-origin allow-popups"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </div>
        <div v-else-if="isDirectVideo" class="aspect-video rounded-xl overflow-hidden bg-black">
          <video :src="entry.demoVideoUrl" controls class="w-full h-full" />
        </div>
        <a
          v-else
          :href="entry.demoVideoUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20"
        >
          <component :is="PlayCircleIcon" :size="16" />
          Open demo
        </a>
      </div>

      <!-- Problem + Solution panels -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Customer Problem</h2>
          <p class="text-gray-700 dark:text-gray-300 text-sm">{{ entry.customerProblem }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Solution</h2>
          <p class="text-gray-700 dark:text-gray-300 text-sm">{{ entry.solutionSummary }}</p>
        </div>
      </div>

      <!-- Lineage stories -->
      <div v-if="entry.openshiftStory || entry.openSourceStory" class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div v-if="entry.openshiftStory" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">OpenShift Story</h2>
          <p class="text-gray-700 dark:text-gray-300 text-sm">{{ entry.openshiftStory }}</p>
        </div>
        <div v-if="entry.openSourceStory" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5">
          <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Open Source Story</h2>
          <p class="text-gray-700 dark:text-gray-300 text-sm">{{ entry.openSourceStory }}</p>
        </div>
      </div>

      <!-- Sales notes -->
      <div v-if="entry.salesNotes" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5 mb-6">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Sales Notes</h2>
        <p class="text-gray-700 dark:text-gray-300 text-sm">{{ entry.salesNotes }}</p>
      </div>

      <!-- Known good with -->
      <div v-if="entry.knownGoodWith && entry.knownGoodWith.length" class="mb-6">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Known Good With</h2>
        <div class="flex flex-wrap gap-2">
          <PillBadge v-for="item in entry.knownGoodWith" :key="item" :label="item" variant="default" />
        </div>
      </div>

      <!-- Architecture diagram -->
      <div v-if="entry.mermaidSource" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5 mb-6">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Architecture</h2>
        <div class="overflow-x-auto">
          <div v-if="mermaidSvg" v-html="mermaidSvg" />
          <pre v-else class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 rounded-lg p-3">{{ entry.mermaidSource }}</pre>
        </div>
      </div>

      <!-- Tags -->
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Tags</h2>
        <div class="flex flex-wrap gap-2">
          <PillBadge v-if="pillar" :label="pillar.title" variant="strategy" />
          <PillBadge v-if="lineageLabel" :label="lineageLabel" variant="lineage" />
          <PillBadge v-for="tag in entry.customerNeedTags" :key="'n-' + tag" :label="tag" variant="need" />
          <PillBadge v-for="tag in entry.capabilityTags" :key="'c-' + tag" :label="tag" variant="capability" />
        </div>
      </div>

      <!-- Resources -->
      <div v-if="hasResources" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 p-5">
        <h2 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Resources</h2>
        <div class="space-y-2">
          <ResourceLink v-for="link in resourceLinks" :key="link.url" :label="link.label" :url="link.url" :icon="link.icon" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, nextTick, h } from 'vue'
import {
  ArrowLeft as ArrowLeftIcon,
  PlayCircle as PlayCircleIcon,
  Github as GithubIcon,
  ExternalLink as ExternalLinkIcon,
  BookOpen as BookOpenIcon,
  Package as PackageIcon,
} from 'lucide-vue-next'
import { useShowcase } from '../composables/useShowcase.js'
import PillBadge from '../components/PillBadge.vue'

const nav = inject('moduleNav')
const slug = computed(() => nav.params.value?.slug || '')
const { loadEntryDetail } = useShowcase()

const entry = ref(null)
const pillar = ref(null)
const loading = ref(true)
const mermaidSvg = ref(null)

const lineageLabels = {
  'pure-open-source': 'Open Source',
  'openshift-oriented': 'OpenShift',
  both: 'Open Source + OpenShift',
}

const lineageLabel = computed(() => entry.value ? lineageLabels[entry.value.lineage] || '' : '')

const embedUrl = computed(() => {
  const url = entry.value?.demoVideoUrl
  if (!url) return null
  try {
    if (url.includes('youtube.com/watch')) {
      const id = new URL(url).searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1]?.split('?')[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      return match ? `https://drive.google.com/file/d/${match[1]}/preview` : null
    }
  } catch {
    return null
  }
  return null
})

const isDirectVideo = computed(() => {
  const url = entry.value?.demoVideoUrl || ''
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url)
})

function parseUrls(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  return String(value).split('|').map(s => s.trim()).filter(Boolean)
}

const resourceLinks = computed(() => {
  if (!entry.value) return []
  const links = []
  for (const url of parseUrls(entry.value.githubUrl)) {
    links.push({ label: 'GitHub', url, icon: 'github' })
  }
  for (const url of parseUrls(entry.value.quayUrl)) {
    links.push({ label: 'Quay', url, icon: 'package' })
  }
  if (entry.value.blogUrl) {
    links.push({ label: 'Blog', url: entry.value.blogUrl, icon: 'book' })
  }
  if (entry.value.orgPulseUrl) {
    links.push({ label: 'Org Pulse', url: entry.value.orgPulseUrl, icon: 'external' })
  }
  for (const url of parseUrls(entry.value.otherResourceUrls)) {
    links.push({ label: 'Resource', url, icon: 'external' })
  }
  return links
})

const hasResources = computed(() => resourceLinks.value.length > 0)

const ResourceLink = {
  props: { label: String, url: String, icon: String },
  setup(props) {
    const icons = {
      github: GithubIcon,
      package: PackageIcon,
      book: BookOpenIcon,
      external: ExternalLinkIcon,
    }
    return () => h('a', {
      href: props.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:underline',
    }, [
      h(icons[props.icon] || ExternalLinkIcon, { size: 14 }),
      props.label,
      h('span', { class: 'text-gray-400 dark:text-gray-500 truncate max-w-xs text-xs' }, props.url),
    ])
  },
}

async function renderMermaid() {
  if (!entry.value?.mermaidSource) return
  try {
    const mermaid = await import('mermaid')
    mermaid.default.initialize({ startOnLoad: false, theme: 'neutral' })
    const { svg } = await mermaid.default.render(
      'mermaid-' + (entry.value.slug || 'diagram'),
      entry.value.mermaidSource
    )
    mermaidSvg.value = svg
  } catch {
    mermaidSvg.value = null
  }
}

async function loadDetail() {
  if (!slug.value) return
  loading.value = true
  mermaidSvg.value = null
  const data = await loadEntryDetail(slug.value)
  entry.value = data?.entry || null
  pillar.value = data?.pillar || null
  loading.value = false

  if (entry.value?.mermaidSource) {
    await nextTick()
    renderMermaid()
  }
}

watch(slug, loadDetail, { immediate: true })
</script>
