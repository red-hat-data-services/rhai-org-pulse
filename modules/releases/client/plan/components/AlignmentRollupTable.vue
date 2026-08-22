<script setup>
import { computed } from 'vue'
import { alignmentCategoryLabel } from '../utils/tv-fv-alignment-display.js'

var props = defineProps({
  rollup: { type: Object, default: null }
})

var emit = defineEmits(['select-scope', 'select-milestone', 'select-product', 'select-category'])

var showHierarchy = computed(function() {
  var r = props.rollup
  if (!r || !r.cycles) return false
  var versionCount = (r.scope && r.scope.versionNames && r.scope.versionNames.length) || 0
  return versionCount > 1
})

function pctClass(pct) {
  if (pct < 50) return 'text-red-600 dark:text-red-400'
  if (pct < 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function onCategory(event, category) {
  event.stopPropagation()
  emit('select-category', category)
}

function afterRequestedCell(counts) {
  var c = counts || {}
  return {
    yellow: c.after_requested || 0,
    green: c.aligned_late || 0
  }
}
</script>

<template>
  <div v-if="rollup && rollup.scope" class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <table class="min-w-full text-left">
      <caption class="sr-only">TV/FV Align roll-up for the current filters. Unique issue keys. Early or as requested and green After requested count as aligned.</caption>
      <thead>
        <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
          <th scope="col" class="px-3 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Release</th>
          <th scope="col" class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
          <th scope="col" class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ alignmentCategoryLabel('aligned_on_time') }}</th>
          <th
            scope="col"
            class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            title="Yellow until the committed version freeze, then green"
          >After requested</th>
          <th scope="col" class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ alignmentCategoryLabel('tv_only') }}</th>
          <th scope="col" class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ alignmentCategoryLabel('fv_only') }}</th>
          <th scope="col" class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ alignmentCategoryLabel('misaligned') }}</th>
          <th scope="col" class="px-3 py-2 text-right text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Align %</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
        <tr
          class="bg-gray-50 dark:bg-gray-900/60 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
          @click="emit('select-scope')"
        >
          <th scope="row" class="px-3 py-2 text-xs font-semibold text-gray-800 dark:text-gray-100">{{ rollup.scope.label }}</th>
          <td class="px-3 py-2 text-right text-xs font-semibold tabular-nums">{{ rollup.scope.counts.total }}</td>
          <td class="px-3 py-2 text-right text-xs tabular-nums text-emerald-700 dark:text-emerald-400 cursor-pointer" @click="onCategory($event, 'aligned_on_time')">{{ rollup.scope.counts.aligned_on_time }}</td>
          <td class="px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap">
            <span class="text-amber-700 dark:text-amber-400 cursor-pointer" @click="onCategory($event, 'after_requested')">{{ afterRequestedCell(rollup.scope.counts).yellow }}</span>
            <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
            <span class="text-emerald-700 dark:text-emerald-400 cursor-pointer" @click="onCategory($event, 'aligned_late')">{{ afterRequestedCell(rollup.scope.counts).green }}</span>
          </td>
          <td class="px-3 py-2 text-right text-xs tabular-nums text-blue-700 dark:text-blue-400 cursor-pointer" @click="onCategory($event, 'tv_only')">{{ rollup.scope.counts.tv_only }}</td>
          <td class="px-3 py-2 text-right text-xs tabular-nums text-violet-700 dark:text-violet-400 cursor-pointer" @click="onCategory($event, 'fv_only')">{{ rollup.scope.counts.fv_only }}</td>
          <td class="px-3 py-2 text-right text-xs tabular-nums text-orange-700 dark:text-orange-400 cursor-pointer" @click="onCategory($event, 'misaligned')">{{ rollup.scope.counts.misaligned }}</td>
          <td class="px-3 py-2 text-right text-xs font-semibold tabular-nums" :class="pctClass(rollup.scope.counts.alignment_pct)">{{ rollup.scope.counts.alignment_pct }}%</td>
        </tr>
        <template v-if="showHierarchy">
          <template v-for="cycle in rollup.cycles" :key="cycle.key">
            <template v-for="ms in cycle.milestones" :key="ms.key">
              <tr
                class="cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-900/20"
                @click="emit('select-milestone', ms)"
              >
                <th scope="row" class="px-3 py-2 pl-6 text-xs font-medium text-gray-700 dark:text-gray-200">{{ ms.label }}</th>
                <td class="px-3 py-2 text-right text-xs tabular-nums">{{ ms.counts.total }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-emerald-700 dark:text-emerald-400 cursor-pointer" @click="onCategory($event, 'aligned_on_time')">{{ ms.counts.aligned_on_time }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap">
                  <span class="text-amber-700 dark:text-amber-400 cursor-pointer" @click="onCategory($event, 'after_requested')">{{ afterRequestedCell(ms.counts).yellow }}</span>
                  <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
                  <span class="text-emerald-700 dark:text-emerald-400 cursor-pointer" @click="onCategory($event, 'aligned_late')">{{ afterRequestedCell(ms.counts).green }}</span>
                </td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-blue-700 dark:text-blue-400 cursor-pointer" @click="onCategory($event, 'tv_only')">{{ ms.counts.tv_only }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-violet-700 dark:text-violet-400 cursor-pointer" @click="onCategory($event, 'fv_only')">{{ ms.counts.fv_only }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-orange-700 dark:text-orange-400 cursor-pointer" @click="onCategory($event, 'misaligned')">{{ ms.counts.misaligned }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums" :class="pctClass(ms.counts.alignment_pct)">{{ ms.counts.alignment_pct }}%</td>
              </tr>
              <tr
                v-for="row in ms.rows"
                :key="row.key"
                class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
                @click="emit('select-product', row)"
              >
                <th scope="row" class="px-3 py-2 pl-10 font-mono text-xs font-medium text-gray-600 dark:text-gray-300">{{ row.label }}</th>
                <td class="px-3 py-2 text-right text-xs tabular-nums">{{ row.counts.total }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-emerald-700 dark:text-emerald-400 cursor-pointer" @click="onCategory($event, 'aligned_on_time')">{{ row.counts.aligned_on_time }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap">
                  <span class="text-amber-700 dark:text-amber-400 cursor-pointer" @click="onCategory($event, 'after_requested')">{{ afterRequestedCell(row.counts).yellow }}</span>
                  <span class="text-gray-400 dark:text-gray-500 mx-0.5">/</span>
                  <span class="text-emerald-700 dark:text-emerald-400 cursor-pointer" @click="onCategory($event, 'aligned_late')">{{ afterRequestedCell(row.counts).green }}</span>
                </td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-blue-700 dark:text-blue-400 cursor-pointer" @click="onCategory($event, 'tv_only')">{{ row.counts.tv_only }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-violet-700 dark:text-violet-400 cursor-pointer" @click="onCategory($event, 'fv_only')">{{ row.counts.fv_only }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums text-orange-700 dark:text-orange-400 cursor-pointer" @click="onCategory($event, 'misaligned')">{{ row.counts.misaligned }}</td>
                <td class="px-3 py-2 text-right text-xs tabular-nums" :class="pctClass(row.counts.alignment_pct)">{{ row.counts.alignment_pct }}%</td>
              </tr>
            </template>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>
