<script setup>
import { ref, onMounted, computed } from 'vue'
import MermaidDiagram from '../components/MermaidDiagram.vue'
import {
  GLOSSARY,
  UNSTUCK_QUICK_REF,
  PHASE_SUMMARY,
  MERMAID_PIPELINE,
  MERMAID_DECISION
} from '../content/glossary.js'
import { fetchResources } from '../services/api.js'

const resources = ref([])
const resourceSearch = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await fetchResources()
    resources.value = data.resources || []
  } catch {
    resources.value = []
  } finally {
    loading.value = false
  }
})

const filteredResources = computed(() => {
  const q = resourceSearch.value.trim().toLowerCase()
  if (!q) return resources.value
  return resources.value.filter(r =>
    r.label.toLowerCase().includes(q) ||
    (r.description || '').toLowerCase().includes(q) ||
    r.category.toLowerCase().includes(q)
  )
})

const resourcesByCategory = computed(() => {
  const map = new Map()
  for (const r of filteredResources.value) {
    const cat = r.category || 'other'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(r)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

const categoryLabels = {
  confluence: 'Confluence',
  repo: 'GitHub repositories',
  'org-pulse': 'Org Pulse',
  dashboard: 'Dashboards',
  doc: 'Documentation'
}
</script>

<template>
  <main class="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
    <div>
      <h2 class="text-lg font-semibold text-gray-900">Learn the pipeline</h2>
      <p class="text-sm text-gray-500 mt-1">
        Diagrams, label glossary, and links to Confluence, repos, and Org Pulse
      </p>
    </div>

    <!-- Phase summary -->
    <section class="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <h3 class="text-sm font-semibold text-gray-800 px-4 py-3 border-b border-gray-100">
        Pipeline at a glance
      </h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left">
            <tr>
              <th class="px-4 py-2 font-medium text-gray-600">Phase</th>
              <th class="px-4 py-2 font-medium text-gray-600">System</th>
              <th class="px-4 py-2 font-medium text-gray-600">Exit signal</th>
              <th class="px-4 py-2 font-medium text-gray-600">Owner</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in PHASE_SUMMARY" :key="row.phase" class="border-t border-gray-100">
              <td class="px-4 py-2 font-medium">{{ row.phase }}</td>
              <td class="px-4 py-2">{{ row.system }}</td>
              <td class="px-4 py-2 font-mono text-xs">{{ row.exit }}</td>
              <td class="px-4 py-2">{{ row.owner }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Diagrams -->
    <section class="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-8">
      <MermaidDiagram title="End-to-end pipeline" :chart="MERMAID_PIPELINE" />
      <MermaidDiagram title="Where is my feature? (decision tree)" :chart="MERMAID_DECISION" />
    </section>

    <!-- Glossary -->
    <section class="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
      <h3 class="text-sm font-semibold text-gray-800 mb-4">Label glossary</h3>
      <div class="space-y-6">
        <div v-for="group in GLOSSARY" :key="group.phase">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{{ group.phase }}</h4>
          <div class="overflow-x-auto rounded-lg border border-gray-100">
            <table class="w-full text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-3 py-2 text-left font-medium text-gray-600">Label</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-600">Meaning</th>
                  <th class="px-3 py-2 text-left font-medium text-gray-600">Next step</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in group.rows" :key="row.label" class="border-t border-gray-100">
                  <td class="px-3 py-2 font-mono text-xs whitespace-nowrap">{{ row.label }}</td>
                  <td class="px-3 py-2">{{ row.meaning }}</td>
                  <td class="px-3 py-2 text-gray-600">{{ row.next }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Unstuck quick ref -->
    <section class="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
      <h3 class="text-sm font-semibold text-gray-800 mb-3">Unstuck quick reference</h3>
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-3 py-2 text-left font-medium text-gray-600 w-16">§</th>
            <th class="px-3 py-2 text-left font-medium text-gray-600">Symptom</th>
            <th class="px-3 py-2 text-left font-medium text-gray-600">Who acts</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in UNSTUCK_QUICK_REF" :key="row.section" class="border-t border-gray-100">
            <td class="px-3 py-2 font-medium">{{ row.section }}</td>
            <td class="px-3 py-2">{{ row.symptom }}</td>
            <td class="px-3 py-2">{{ row.owner }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Resource library -->
    <section class="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
      <h3 class="text-sm font-semibold text-gray-800 mb-3">Resource library</h3>
      <input
        v-model="resourceSearch"
        type="search"
        placeholder="Search resources…"
        class="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm mb-4"
      />
      <p v-if="loading" class="text-sm text-gray-500">Loading links…</p>
      <div v-else class="space-y-6">
        <div v-for="[cat, items] in resourcesByCategory" :key="cat">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {{ categoryLabels[cat] || cat }}
          </h4>
          <ul class="space-y-2">
            <li v-for="link in items" :key="link.id" class="border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
              <a
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm font-medium text-blue-600 hover:underline"
              >{{ link.label }} ↗</a>
              <p v-if="link.description" class="text-xs text-gray-500 mt-1">{{ link.description }}</p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </main>
</template>
