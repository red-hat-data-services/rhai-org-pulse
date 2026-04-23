<script setup>
defineProps({
  phases: {
    type: Array,
    required: true
  },
  workflows: {
    type: Array,
    default: () => []
  },
  selectedPhase: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select'])
</script>

<template>
  <aside class="w-60 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Impact</h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Delivery Pipeline</p>
    </div>

    <nav class="p-2 flex-1 overflow-y-auto">
      <div class="text-xs font-medium text-gray-400 dark:text-gray-500 px-3 py-2 uppercase tracking-wide">Phases</div>
      <button
        v-for="phase in phases"
        :key="phase.id"
        :disabled="phase.status === 'coming-soon'"
        @click="phase.status === 'active' && emit('select', phase.id)"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors"
        :class="{
          'text-gray-300 dark:text-gray-600 cursor-not-allowed': phase.status === 'coming-soon',
          'bg-primary-600 text-white': selectedPhase === phase.id && phase.status === 'active',
          'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700': selectedPhase !== phase.id && phase.status === 'active'
        }"
      >
        <span
          class="w-6 h-6 rounded flex items-center justify-center text-xs font-medium"
          :class="{
            'bg-white/20': selectedPhase === phase.id,
            'bg-gray-100 dark:bg-gray-700': selectedPhase !== phase.id
          }"
        >
          <template v-if="phase.status === 'coming-soon'">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </template>
          <template v-else>{{ phase.order }}</template>
        </span>
        <span class="flex-1 text-left truncate">{{ phase.name }}</span>
        <span
          v-if="phase.status === 'active' && selectedPhase === phase.id"
          class="w-2 h-2 rounded-full bg-green-400"
        />
      </button>

      <template v-if="workflows.length > 0">
        <div class="border-t border-gray-200 dark:border-gray-700 my-3" />
        <div class="text-xs font-medium text-gray-400 dark:text-gray-500 px-3 py-2 uppercase tracking-wide">AI Workflows</div>
        <button
          v-for="wf in workflows"
          :key="wf.id"
          :disabled="wf.status === 'coming-soon'"
          @click="wf.status === 'active' && emit('select', wf.id)"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors"
          :class="{
            'text-gray-300 dark:text-gray-600 cursor-not-allowed': wf.status === 'coming-soon',
            'bg-primary-600 text-white': selectedPhase === wf.id && wf.status === 'active',
            'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700': selectedPhase !== wf.id && wf.status === 'active'
          }"
        >
          <span
            class="w-6 h-6 rounded flex items-center justify-center"
            :class="{
              'bg-white/20': selectedPhase === wf.id,
              'bg-gray-100 dark:bg-gray-700': selectedPhase !== wf.id
            }"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <span class="flex-1 text-left truncate">{{ wf.name }}</span>
          <span
            v-if="wf.status === 'active' && selectedPhase === wf.id"
            class="w-2 h-2 rounded-full bg-green-400"
          />
        </button>
      </template>
    </nav>
  </aside>
</template>
