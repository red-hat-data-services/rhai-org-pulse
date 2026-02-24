<template>
  <div v-if="sprintData" class="space-y-4">
    <!-- Completion summary banner (closed sprints) -->
    <div
      v-if="isClosed"
      :class="[
        'rounded-lg border p-5 flex items-center justify-between',
        reliabilityBannerClass
      ]"
    >
      <div>
        <p class="text-sm font-medium opacity-80">Sprint Completion</p>
        <p class="text-3xl font-bold mt-1">{{ sprintData.metrics.commitmentReliabilityPoints }}%</p>
        <p class="text-sm mt-1 opacity-70">
          {{ sprintData.delivered.totalPoints }} of {{ sprintData.committed.totalPoints }} committed points delivered
        </p>
      </div>
      <div class="text-right space-y-2">
        <div class="text-sm">
          <span class="opacity-70">Velocity</span>
          <span class="ml-2 font-semibold text-lg">{{ sprintData.metrics.velocityPoints }} pts</span>
        </div>
        <div class="text-sm">
          <span class="opacity-70">Issues</span>
          <span class="ml-2 font-semibold">{{ sprintData.delivered.issues.length }} / {{ sprintData.committed.issues.length }}</span>
          <span class="ml-1 opacity-70">({{ sprintData.metrics.commitmentReliabilityCount }}%)</span>
        </div>
      </div>
    </div>

    <!-- Committed vs Delivered bars -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Points bar -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Points</span>
          <MethodologyInfo text="Committed = issues present when sprint was activated. Delivered = issues completed by sprint end. Unestimated issues default to 1 point." />
        </div>
        <div class="space-y-2">
          <div>
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span class="cursor-pointer hover:text-primary-600" @click="$emit('drill-down', 'committed')">
                Committed: {{ sprintData.committed.totalPoints }} pts ({{ sprintData.committed.issues.length }} issues)
              </span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3">
              <div class="bg-primary-400 h-3 rounded-full" :style="{ width: '100%' }"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span class="cursor-pointer hover:text-primary-600" @click="$emit('drill-down', 'delivered')">
                Delivered: {{ sprintData.delivered.totalPoints }} pts ({{ sprintData.delivered.issues.length }} issues)
              </span>
              <span class="font-medium" :class="reliabilityColorClass">{{ sprintData.metrics.commitmentReliabilityPoints }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3">
              <div class="bg-green-500 h-3 rounded-full" :style="{ width: deliveredWidthPoints }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Count bar -->
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-gray-700">Issues</span>
        </div>
        <div class="space-y-2">
          <div>
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>Committed: {{ sprintData.committed.issues.length }} issues</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3">
              <div class="bg-primary-400 h-3 rounded-full" :style="{ width: '100%' }"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>Delivered: {{ sprintData.delivered.issues.length }} issues</span>
              <span class="font-medium" :class="reliabilityCountColorClass">{{ sprintData.metrics.commitmentReliabilityCount }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3">
              <div class="bg-green-500 h-3 rounded-full" :style="{ width: deliveredWidthCount }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scope change + unestimated row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        label="Added Mid-Sprint"
        :value="sprintData.addedMidSprint.issues.length"
        subtitle="issues added after sprint started"
        tooltip="Issues that were not in the sprint backlog when it was activated, but were added during the sprint"
        @click="$emit('drill-down', 'addedMidSprint')"
      />
      <MetricCard
        label="Removed"
        :value="sprintData.removed.issues.length"
        subtitle="issues punted from sprint"
        tooltip="Issues that were removed from the sprint before completion (punted to backlog or another sprint)"
        @click="$emit('drill-down', 'removed')"
      />
      <MetricCard
        label="Incomplete"
        :value="sprintData.incomplete.issues.length"
        :subtitle="`${sprintData.incomplete.totalPoints} pts remaining`"
        tooltip="Issues that were in the sprint but not completed by sprint end"
        @click="$emit('drill-down', 'incomplete')"
      />
    </div>

    <!-- Unestimated callout -->
    <div
      v-if="totalUnestimated > 0"
      class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3"
    >
      <svg class="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-medium text-amber-800">
          {{ totalUnestimated }} unestimated issue{{ totalUnestimated !== 1 ? 's' : '' }} ({{ totalDefaultedPoints }} defaulted pt{{ totalDefaultedPoints !== 1 ? 's' : ''}})
        </p>
        <p class="text-xs text-amber-600 mt-1">
          Unestimated issues are counted as 1 point each. This affects velocity and reliability calculations.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MetricCard from './MetricCard.vue'
import MethodologyInfo from './MethodologyInfo.vue'

const props = defineProps({
  sprintData: { type: Object, default: null }
})

defineEmits(['drill-down'])

const isClosed = computed(() => {
  const state = props.sprintData?.sprint?.state
  return state === 'closed' || state === 'CLOSED'
})

const reliabilityBannerClass = computed(() => {
  const val = props.sprintData?.metrics?.commitmentReliabilityPoints
  if (val == null) return 'bg-gray-50 border-gray-200 text-gray-800'
  if (val >= 80) return 'bg-green-50 border-green-200 text-green-900'
  if (val >= 60) return 'bg-amber-50 border-amber-200 text-amber-900'
  return 'bg-red-50 border-red-200 text-red-900'
})

const deliveredWidthPoints = computed(() => {
  if (!props.sprintData || props.sprintData.committed.totalPoints === 0) return '0%'
  const pct = Math.min(100, (props.sprintData.delivered.totalPoints / props.sprintData.committed.totalPoints) * 100)
  return `${pct}%`
})

const deliveredWidthCount = computed(() => {
  if (!props.sprintData || props.sprintData.committed.issues.length === 0) return '0%'
  const pct = Math.min(100, (props.sprintData.delivered.issues.length / props.sprintData.committed.issues.length) * 100)
  return `${pct}%`
})

const reliabilityColorClass = computed(() => {
  const val = props.sprintData?.metrics?.commitmentReliabilityPoints
  if (val == null) return 'text-gray-600'
  if (val >= 80) return 'text-green-600'
  if (val >= 60) return 'text-amber-600'
  return 'text-red-600'
})

const reliabilityCountColorClass = computed(() => {
  const val = props.sprintData?.metrics?.commitmentReliabilityCount
  if (val == null) return 'text-gray-600'
  if (val >= 80) return 'text-green-600'
  if (val >= 60) return 'text-amber-600'
  return 'text-red-600'
})

const totalUnestimated = computed(() => {
  if (!props.sprintData) return 0
  return props.sprintData.committed.unestimatedCount + props.sprintData.addedMidSprint.unestimatedCount
})

const totalDefaultedPoints = computed(() => {
  if (!props.sprintData) return 0
  return props.sprintData.committed.defaultedPoints + props.sprintData.addedMidSprint.defaultedPoints
})
</script>
