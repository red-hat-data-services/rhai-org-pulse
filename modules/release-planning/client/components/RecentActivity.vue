<script setup>
import { ref, computed, watch, inject } from 'vue'
import { useAuditLog } from '../composables/useAuditLog'

var props = defineProps({
  version: { type: String, default: '' }
})

var moduleNav = inject('moduleNav')
var { entries, loading, loadAuditLog } = useAuditLog()
var collapsed = ref(false)

var ACTION_META = {
  create_rock: { icon: 'plus', label: 'Created', color: 'text-green-600 dark:text-green-400' },
  update_rock: { icon: 'pencil', label: 'Updated', color: 'text-blue-600 dark:text-blue-400' },
  delete_rock: { icon: 'trash', label: 'Deleted', color: 'text-red-600 dark:text-red-400' },
  reorder_rocks: { icon: 'arrows', label: 'Reordered', color: 'text-purple-600 dark:text-purple-400' },
  create_release: { icon: 'plus', label: 'Created', color: 'text-green-600 dark:text-green-400' },
  clone_release: { icon: 'copy', label: 'Cloned', color: 'text-indigo-600 dark:text-indigo-400' },
  delete_release: { icon: 'trash', label: 'Deleted', color: 'text-red-600 dark:text-red-400' },
  import_doc: { icon: 'upload', label: 'Imported', color: 'text-amber-600 dark:text-amber-400' },
  add_pm: { icon: 'user-plus', label: 'Added PM', color: 'text-green-600 dark:text-green-400' },
  remove_pm: { icon: 'user-minus', label: 'Removed PM', color: 'text-red-600 dark:text-red-400' },
  seed: { icon: 'database', label: 'Seeded', color: 'text-amber-600 dark:text-amber-400' }
}

function actionMeta(action) {
  return ACTION_META[action] || { icon: 'dot', label: action, color: 'text-gray-500' }
}

function formatRelativeTime(iso) {
  var now = Date.now()
  var then = new Date(iso).getTime()
  var diff = now - then
  var minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return minutes + 'm ago'
  var hours = Math.floor(minutes / 60)
  if (hours < 24) return hours + 'h ago'
  var days = Math.floor(hours / 24)
  if (days < 7) return days + 'd ago'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortUser(email) {
  if (!email) return 'System'
  var at = email.indexOf('@')
  return at > 0 ? email.substring(0, at) : email
}

var recentEntries = computed(function() {
  return entries.value.slice(0, 5)
})

var hasEntries = computed(function() {
  return entries.value.length > 0
})

var activitySummary = computed(function() {
  var count = entries.value.length
  if (count === 0) return ''
  var recent = entries.value[0]
  var age = formatRelativeTime(recent.timestamp)
  return count + ' change' + (count !== 1 ? 's' : '') + ' · latest ' + age
})

function viewAll() {
  if (moduleNav) {
    moduleNav.navigateTo('audit-log', { version: props.version })
  }
}

watch(function() { return props.version }, function(v) {
  if (v) loadAuditLog({ version: v, limit: 5 })
}, { immediate: true })
</script>

<template>
  <div v-if="hasEntries" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-2 cursor-pointer select-none"
      @click="collapsed = !collapsed"
    >
      <div class="flex items-center gap-2 min-w-0">
        <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Recent Activity</span>
        <span v-if="collapsed" class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ activitySummary }}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="!collapsed"
          @click.stop="viewAll"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >View all</button>
        <svg
          class="w-3.5 h-3.5 text-gray-400 transition-transform"
          :class="collapsed ? '' : 'rotate-180'"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Entries -->
    <div v-if="!collapsed" class="border-t border-gray-100 dark:border-gray-700">
      <div v-if="loading" class="px-4 py-3 text-xs text-gray-400">Loading...</div>
      <div v-else>
        <div
          v-for="entry in recentEntries"
          :key="entry.id"
          class="px-4 py-1.5 flex items-center gap-2 text-xs"
        >
          <!-- Action icon -->
          <span class="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            <!-- Plus -->
            <svg v-if="actionMeta(entry.action).icon === 'plus'" :class="actionMeta(entry.action).color" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <!-- Pencil -->
            <svg v-else-if="actionMeta(entry.action).icon === 'pencil'" :class="actionMeta(entry.action).color" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <!-- Trash -->
            <svg v-else-if="actionMeta(entry.action).icon === 'trash'" :class="actionMeta(entry.action).color" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <!-- Arrows (reorder) -->
            <svg v-else-if="actionMeta(entry.action).icon === 'arrows'" :class="actionMeta(entry.action).color" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <!-- Upload -->
            <svg v-else-if="actionMeta(entry.action).icon === 'upload'" :class="actionMeta(entry.action).color" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <!-- Default dot -->
            <svg v-else :class="actionMeta(entry.action).color" class="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
              <circle cx="4" cy="4" r="4" />
            </svg>
          </span>

          <!-- Summary -->
          <span class="text-gray-700 dark:text-gray-300 truncate flex-1">{{ entry.summary }}</span>

          <!-- User -->
          <span class="text-gray-400 dark:text-gray-500 flex-shrink-0">{{ shortUser(entry.user) }}</span>

          <!-- Time -->
          <span class="text-gray-400 dark:text-gray-500 flex-shrink-0 w-16 text-right">{{ formatRelativeTime(entry.timestamp) }}</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-gray-100 dark:border-gray-700 px-4 py-1.5 flex justify-end">
        <button
          @click="viewAll"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >View full history</button>
      </div>
    </div>
  </div>
</template>
