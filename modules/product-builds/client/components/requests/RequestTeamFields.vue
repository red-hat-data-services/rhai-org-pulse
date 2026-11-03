<script setup>
import { TEAM_PROJECTS } from '../../composables/useRequestTeams'

const project = defineModel('project', { type: String, required: true })
const team = defineModel('team', { type: String, required: true })

defineProps({
  idPrefix: { type: String, required: true },
  teams: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  loadError: { type: String, default: '' },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

defineEmits(['retry'])
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div>
      <label :for="`${idPrefix}-team-project`" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team's Jira project</label>
      <select
        :id="`${idPrefix}-team-project`"
        v-model="project"
        :disabled="disabled"
        :aria-describedby="`${idPrefix}-team-project-hint`"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option v-for="option in TEAM_PROJECTS" :key="option" :value="option">{{ option }}</option>
      </select>
      <p :id="`${idPrefix}-team-project-hint`" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Choose the project your team belongs to.
        <template v-if="project === 'RHAISTRAT'">RHAISTRAT has no Epic type, so the request is filed in RHAI.</template>
        <template v-else>The request is filed in {{ project }}.</template>
      </p>
    </div>

    <div>
      <label :for="`${idPrefix}-team`" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Team <span class="text-red-500" aria-hidden="true">*</span>
      </label>
      <select
        :id="`${idPrefix}-team`"
        v-model="team"
        required
        :disabled="loading || !!loadError || !teams.length || disabled"
        aria-required="true"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${idPrefix}-team-error` : `${idPrefix}-team-status`"
        class="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
        :class="error ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'"
      >
        <option value="" disabled>{{ loading ? 'Loading teams...' : 'Select a team' }}</option>
        <option v-for="option in teams" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
      <div :id="`${idPrefix}-team-status`" class="mt-1 text-xs" aria-live="polite">
        <p v-if="loadError" class="text-red-600 dark:text-red-400">{{ loadError }}</p>
        <p v-else-if="!loading && !teams.length" class="text-gray-500 dark:text-gray-400">No teams are available for this project.</p>
        <button
          v-if="loadError || (!loading && !teams.length)"
          type="button"
          class="mt-1 text-primary-600 dark:text-primary-400 underline"
          @click="$emit('retry')"
        >Retry loading teams</button>
      </div>
      <p v-if="error" :id="`${idPrefix}-team-error`" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
  </div>
</template>
