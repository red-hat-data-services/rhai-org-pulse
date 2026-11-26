<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
          <UsersIcon :size="16" class="text-purple-600 dark:text-purple-400" />
        </div>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">Repository Access</span>
      </div>
      <span v-if="formattedUpdatedAt" class="text-xs text-gray-400 dark:text-gray-500 shrink-0">
        As of {{ formattedUpdatedAt }}
      </span>
    </div>

    <div class="flex items-center gap-6">
      <div>
        <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ access.write ?? 0 }}</span>
        <span class="text-sm text-gray-500 dark:text-gray-400 ml-1">/ {{ access.total ?? 0 }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Write</p>
      </div>
      <div class="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
      <div>
        <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ access.triage ?? 0 }}</span>
        <span class="text-sm text-gray-500 dark:text-gray-400 ml-1">/ {{ access.total ?? 0 }}</span>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Triage</p>
      </div>
    </div>

    <div v-if="groups.length" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/60 space-y-4">
      <div v-for="group in groups" :key="group.role">
        <div class="flex items-center justify-between mb-1">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ group.label }}
          </h4>
          <span class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{{ group.members.length }}</span>
        </div>
        <ul :aria-label="group.label" class="space-y-0.5">
          <li
            v-for="(member, index) in visibleMembers(group)"
            :key="memberKey(member, index)"
            class="flex items-center gap-2 py-1.5"
          >
            <span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center text-[11px] font-semibold shrink-0">
              {{ initial(member) }}
            </span>
            <span class="text-sm text-gray-700 dark:text-gray-300 truncate">{{ displayName(member) }}</span>
          </li>
        </ul>
        <button
          v-if="group.members.length > memberLimit"
          type="button"
          class="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          :aria-expanded="expanded[group.role]"
          @click="toggle(group.role)"
        >
          {{ expanded[group.role] ? 'Show less' : `Show all ${group.members.length}` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { Users as UsersIcon } from 'lucide-vue-next'

const props = defineProps({
  access: {
    type: Object,
    required: true,
  },
})

const memberLimit = 5
const expanded = reactive({ write: false, triage: false })

const groups = computed(() => {
  const members = props.access?.members
  if (!members) return []
  return [
    { role: 'write', label: 'Write access (owners)', members: members.write || [] },
    { role: 'triage', label: 'Triage access', members: members.triage || [] },
  ].filter(group => group.members.length > 0)
})

const formattedUpdatedAt = computed(() => {
  const value = props.access?.updatedAt
  if (!value || typeof value !== 'string') return ''
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
})

function displayName(member) {
  if (typeof member === 'string') return member
  return member?.name || member?.githubUsername || 'Unknown'
}

function initial(member) {
  return displayName(member).charAt(0).toUpperCase()
}

function memberKey(member, index) {
  const value = typeof member === 'string'
    ? member
    : member?.githubUsername || member?.name || 'member'
  return `${value}-${index}`
}

function visibleMembers(group) {
  return expanded[group.role] ? group.members : group.members.slice(0, memberLimit)
}

function toggle(role) {
  expanded[role] = !expanded[role]
}
</script>
