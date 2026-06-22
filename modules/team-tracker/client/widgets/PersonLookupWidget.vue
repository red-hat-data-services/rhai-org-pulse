<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoster } from '@shared/client/composables/useRoster.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { Search } from 'lucide-vue-next'

defineProps({
  size: { type: String, default: 'half' }
})

const { navigateTo: crossNavigate } = useModuleLink()
const { rosterData, loading, loadRoster } = useRoster()

onMounted(() => {
  loadRoster()
})

// Flatten all people from all orgs/teams into a searchable list
const allPeople = computed(() => {
  if (!rosterData.value?.orgs) return []
  const seen = new Set()
  const people = []
  for (const org of rosterData.value.orgs) {
    if (!org.teams) continue
    for (const [teamName, team] of Object.entries(org.teams)) {
      for (const member of team.members) {
        const key = member.uid || member.name
        if (seen.has(key)) continue
        seen.add(key)
        people.push({
          uid: member.uid,
          name: member.name || member.jiraDisplayName || key,
          title: member.title || '',
          teamName: team.displayName || teamName
        })
      }
    }
  }
  return people.sort((a, b) => a.name.localeCompare(b.name))
})

const searchText = ref('')
const isOpen = ref(false)
const highlightedIndex = ref(-1)
const rootEl = ref(null)

const filteredPeople = computed(() => {
  if (!searchText.value.trim()) return []
  const term = searchText.value.toLowerCase()
  return allPeople.value
    .filter(p => p.name.toLowerCase().includes(term) || p.title.toLowerCase().includes(term))
    .slice(0, 8)
})

function onInput() {
  isOpen.value = true
  highlightedIndex.value = -1
}

function onFocus() {
  if (searchText.value.trim()) {
    isOpen.value = true
  }
}

function selectPerson(person) {
  isOpen.value = false
  searchText.value = ''
  if (person.uid) {
    crossNavigate('team-tracker', 'person-detail', { uid: person.uid, from: 'sotu' })
  }
}

function onKeydown(event) {
  const total = filteredPeople.value.length
  if (!total) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, total - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (highlightedIndex.value >= 0 && highlightedIndex.value < total) {
      selectPerson(filteredPeople.value[highlightedIndex.value])
    }
  } else if (event.key === 'Escape') {
    isOpen.value = false
  }
}

function onClickOutside(e) {
  if (rootEl.value && !rootEl.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Person Lookup</h3>

    <div ref="rootEl" class="relative">
      <div class="relative">
        <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <input
          v-model="searchText"
          type="text"
          role="combobox"
          :aria-expanded="isOpen && filteredPeople.length > 0"
          aria-autocomplete="list"
          :aria-activedescendant="highlightedIndex >= 0 ? `plw-opt-${highlightedIndex}` : undefined"
          class="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Search by name or title..."
          @input="onInput"
          @focus="onFocus"
          @keydown="onKeydown"
        />
      </div>

      <!-- Results dropdown -->
      <ul
        v-if="isOpen && filteredPeople.length > 0"
        role="listbox"
        class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto"
      >
        <li
          v-for="(person, idx) in filteredPeople"
          :key="person.uid || person.name"
          :id="`plw-opt-${idx}`"
          role="option"
          :aria-selected="highlightedIndex === idx"
          class="px-3 py-2.5 cursor-pointer transition-colors"
          :class="highlightedIndex === idx
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
          @mousedown.prevent="selectPerson(person)"
        >
          <div class="text-sm font-medium">{{ person.name }}</div>
          <div class="flex items-center gap-2 mt-0.5">
            <span v-if="person.title" class="text-xs text-gray-400 dark:text-gray-500">{{ person.title }}</span>
            <span v-if="person.title && person.teamName" class="text-xs text-gray-300 dark:text-gray-600">&middot;</span>
            <span v-if="person.teamName" class="text-xs text-gray-400 dark:text-gray-500">{{ person.teamName }}</span>
          </div>
        </li>
      </ul>

      <!-- No results -->
      <div
        v-if="isOpen && searchText.trim() && filteredPeople.length === 0 && !loading"
        class="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-500 dark:text-gray-400"
      >
        No people found matching "{{ searchText }}"
      </div>
    </div>
  </div>
</template>
