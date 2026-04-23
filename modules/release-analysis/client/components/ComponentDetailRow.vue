<template>
  <div>
    <button
      class="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors"
      :class="variant === 'risk'
        ? 'hover:bg-red-100/40 dark:hover:bg-red-900/20'
        : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/30'"
      @click="toggleExpand"
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-wrap">
        <span
          class="transition-transform text-[10px]"
          :class="[
            isExpanded ? 'rotate-90' : '',
            variant === 'risk' ? 'text-red-400 dark:text-red-500' : 'text-gray-400 dark:text-gray-500'
          ]"
        >&#9654;</span>
        <span class="font-medium text-gray-700 dark:text-gray-200 text-sm">{{ comp.name }}</span>
        <span class="text-xs text-gray-400 dark:text-gray-500">{{ total }} issue{{ total !== 1 ? 's' : '' }}</span>
        <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="confidenceBadgeClass(comp.forecast.level)">
          <span class="h-1.5 w-1.5 rounded-full" :class="confidenceDotClass(comp.forecast.level)" />
          {{ comp.forecast.paceStatus }}
        </span>
        <span
          v-for="proj in comp.projects"
          :key="proj"
          class="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200/70 dark:border-indigo-700/50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300"
        >{{ proj }}</span>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div class="grid grid-cols-3 gap-1.5 text-[10px]">
          <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />{{ fmtCount(comp.issues_done) }}</span>
          <span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" />{{ fmtCount(comp.issues_doing) }}</span>
          <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><span class="h-1.5 w-1.5 rounded-full bg-gray-400" />{{ fmtCount(comp.issues_to_do) }}</span>
        </div>
        <div class="flex h-2 w-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60">
          <div class="h-full bg-emerald-500" :style="{ width: pct(comp.issues_done, total) }" />
          <div class="h-full bg-blue-500" :style="{ width: pct(comp.issues_doing, total) }" />
          <div class="h-full bg-gray-400" :style="{ width: pct(comp.issues_to_do, total) }" />
        </div>
      </div>
    </button>

    <!-- Expanded detail -->
    <div v-if="isExpanded" class="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50">
      <!-- Capacity strip -->
      <div class="px-4 py-2.5 bg-gray-50/40 dark:bg-gray-800/20 border-b border-gray-100 dark:border-gray-800">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-[11px]">
          <div>
            <span class="text-gray-400 dark:text-gray-500">Feature Velocity (V) — 6mo avg</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.velocity }} <span class="font-normal text-gray-400 dark:text-gray-500">issues / 14d</span></p>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Remaining Issues (RI)</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.remaining }} <span class="font-normal text-gray-400 dark:text-gray-500">not done</span></p>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Sprint (14d window) Remaining (W)</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.windowsRemaining }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ comp.forecast.T }}d ÷ 14)</span></p>
          </div>
          <div>
            <span class="text-gray-400 dark:text-gray-500">Capacity (C = V x W)</span>
            <p class="font-semibold text-gray-700 dark:text-gray-300">{{ comp.forecast.totalCapacity }} <span class="font-normal text-gray-400 dark:text-gray-500">projected</span></p>
          </div>
        </div>
        <div class="mt-2 flex items-center gap-3 text-xs flex-wrap">
          <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold" :class="confidenceBadgeClass(comp.forecast.level)">
            <span class="h-2 w-2 rounded-full" :class="confidenceDotClass(comp.forecast.level)" />
            {{ comp.forecast.paceStatus }}
          </span>
          <span v-if="comp.forecast.remaining > 0" class="text-gray-500 dark:text-gray-400">
            Needs {{ comp.forecast.remaining }}; Projected {{ comp.forecast.totalCapacity }}
            <span class="font-semibold" :class="comp.forecast.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
              ({{ comp.forecast.delta >= 0 ? '+' : '' }}{{ comp.forecast.delta }})
            </span>
          </span>
          <span v-else class="text-emerald-600 dark:text-emerald-400 font-medium">All issues resolved</span>
        </div>
      </div>

      <!-- Strategic items -->
      <div
        v-for="si in comp.strategicItems"
        :key="si.key"
        class="border-b border-gray-100/60 dark:border-gray-800/60 last:border-b-0"
      >
        <button
          class="w-full flex items-center justify-between gap-3 px-4 py-2 pl-8 text-left hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors"
          @click.stop="toggleStrategic(si.key)"
        >
          <div class="flex items-center gap-2 min-w-0 flex-wrap">
            <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isStrategicExpanded(si.key) }">&#9654;</span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider" :class="issueTypePillClass(si.issueType)">{{ si.issueType }}</span>
            <a :href="si.link" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline text-xs font-medium" @click.stop>{{ si.key }}</a>
            <span class="text-xs text-gray-700 dark:text-gray-300 truncate">{{ si.summary }}</span>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" :class="statusBadgeClass(si.statusBucket)">
              <span class="h-1.5 w-1.5 rounded-full" :class="statusDotClass(si.statusBucket)" />
              {{ si.status }}
            </span>
            <span class="text-xs font-medium tabular-nums" :class="childProgressColor(si.childCounts)">
              {{ si.childCounts.done }}/{{ si.children.length }} Done
            </span>
          </div>
        </button>

        <!-- Children table -->
        <div v-if="isStrategicExpanded(si.key) && si.children.length" class="px-4 pb-2 pl-14">
          <div class="overflow-x-auto rounded-lg border border-gray-200/80 dark:border-gray-700/80">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800/60 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th class="px-3 py-1.5 font-medium">Key</th>
                  <th class="px-3 py-1.5 font-medium">Summary</th>
                  <th class="px-3 py-1.5 font-medium">Status</th>
                  <th class="px-3 py-1.5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="child in si.children" :key="child.key" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                  <td class="px-3 py-1.5 whitespace-nowrap">
                    <a :href="child.link" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs">{{ child.key }}</a>
                  </td>
                  <td class="px-3 py-1.5 max-w-xs"><span class="line-clamp-1 text-xs text-gray-700 dark:text-gray-300">{{ child.summary }}</span></td>
                  <td class="px-3 py-1.5 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusBadgeClass(child.statusBucket)">
                      <span class="h-1 w-1 rounded-full" :class="statusDotClass(child.statusBucket)" />
                      {{ child.status }}
                    </span>
                  </td>
                  <td class="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ child.issueType || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else-if="isStrategicExpanded(si.key) && !si.children.length" class="px-4 pb-2 pl-14">
          <p class="text-[10px] text-gray-400 dark:text-gray-500 italic">No child issues in this release.</p>
        </div>
      </div>

      <!-- Other items -->
      <div v-if="comp.otherItems.length" class="border-t border-gray-100/60 dark:border-gray-800/60">
        <button
          class="w-full flex items-center justify-between gap-3 px-4 py-2 pl-8 text-left hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors"
          @click.stop="toggleStrategic('__other__')"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-gray-400 dark:text-gray-500 transition-transform text-[10px]" :class="{ 'rotate-90': isStrategicExpanded('__other__') }">&#9654;</span>
            <span class="font-medium text-gray-500 dark:text-gray-400 text-xs italic">Other items</span>
            <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ comp.otherItems.length }}</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 text-[10px] shrink-0">
            <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><span class="h-1 w-1 rounded-full bg-emerald-500" />{{ comp.otherCounts.done }}</span>
            <span class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"><span class="h-1 w-1 rounded-full bg-blue-500" />{{ comp.otherCounts.doing }}</span>
            <span class="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400"><span class="h-1 w-1 rounded-full bg-gray-400" />{{ comp.otherCounts.to_do }}</span>
          </div>
        </button>

        <div v-if="isStrategicExpanded('__other__')" class="px-4 pb-2 pl-14">
          <div class="overflow-x-auto rounded-lg border border-gray-200/80 dark:border-gray-700/80">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800/60 text-left text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <tr>
                  <th class="px-3 py-1.5 font-medium">Key</th>
                  <th class="px-3 py-1.5 font-medium">Summary</th>
                  <th class="px-3 py-1.5 font-medium">Status</th>
                  <th class="px-3 py-1.5 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="issue in comp.otherItems" :key="issue.key" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                  <td class="px-3 py-1.5 whitespace-nowrap">
                    <a :href="issue.link" target="_blank" rel="noopener" class="text-blue-600 dark:text-blue-400 hover:underline font-medium text-xs">{{ issue.key }}</a>
                  </td>
                  <td class="px-3 py-1.5 max-w-xs"><span class="line-clamp-1 text-xs text-gray-700 dark:text-gray-300">{{ issue.summary }}</span></td>
                  <td class="px-3 py-1.5 whitespace-nowrap">
                    <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="statusBadgeClass(issue.statusBucket)">
                      <span class="h-1 w-1 rounded-full" :class="statusDotClass(issue.statusBucket)" />
                      {{ issue.status }}
                    </span>
                  </td>
                  <td class="px-3 py-1.5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ issue.issueType || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'

const props = defineProps({
  comp: { type: Object, required: true },
  variant: { type: String, default: 'default' }
})

const expandedSelf = reactive({ open: false })
const expandedStrategic = reactive(new Set())

const isExpanded = computed(() => expandedSelf.open)

function toggleExpand() {
  expandedSelf.open = !expandedSelf.open
  if (!expandedSelf.open) expandedStrategic.clear()
}

function toggleStrategic(key) {
  if (expandedStrategic.has(key)) expandedStrategic.delete(key)
  else expandedStrategic.add(key)
}

function isStrategicExpanded(key) {
  return expandedStrategic.has(key)
}

const total = computed(() =>
  (props.comp.issues_to_do || 0) + (props.comp.issues_doing || 0) + (props.comp.issues_done || 0)
)

function pct(part, whole) {
  if (!whole || part <= 0) return '0%'
  return `${Math.min(100, (part / whole) * 100)}%`
}

function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0'
  return String(Math.round(Number(n)))
}

function normalizeType(t) { return (t || '').toLowerCase().trim() }

function confidenceBadgeClass(level) {
  if (level === 'High') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
  return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
}

function confidenceDotClass(level) {
  if (level === 'High') return 'bg-emerald-500'
  return 'bg-red-500'
}

function issueTypePillClass(type) {
  const t = normalizeType(type)
  if (t === 'feature') return 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
  if (t === 'initiative') return 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
  if (t === 'spike') return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

function statusBadgeClass(bucket) {
  if (bucket === 'done') return 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
  if (bucket === 'doing') return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
  return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

function statusDotClass(bucket) {
  if (bucket === 'done') return 'bg-emerald-500'
  if (bucket === 'doing') return 'bg-blue-500'
  return 'bg-gray-400'
}

function childProgressColor(counts) {
  const total = counts.done + counts.doing + counts.to_do
  if (total === 0) return 'text-gray-400 dark:text-gray-500'
  if (counts.done === total) return 'text-emerald-600 dark:text-emerald-400'
  if (counts.done / total > 0.5) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-500 dark:text-gray-400'
}
</script>
