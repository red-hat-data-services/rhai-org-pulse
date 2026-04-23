<template>
  <div class="overflow-x-auto">
    <!-- Search -->
    <div class="relative mb-4">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name, manager, role, component, location..."
        class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>

    <!-- Filter by role -->
    <div v-if="uniqueRoles.length > 1" class="mb-4 flex flex-wrap gap-2">
      <button
        @click="roleFilter = null"
        class="px-3 py-1 rounded text-xs font-medium transition-colors border"
        :class="!roleFilter
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'"
      >
        All roles
      </button>
      <button
        v-for="role in uniqueRoles"
        :key="role"
        @click="roleFilter = role"
        class="px-3 py-1 rounded text-xs font-medium transition-colors border"
        :class="roleFilter === role
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'"
      >
        {{ role }}
      </button>
    </div>

    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
            @click="toggleSort(col.key)"
          >
            {{ col.label }}
            <span v-if="sortKey === col.key" class="ml-1">{{ sortAsc ? '↑' : '↓' }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        <tr
          v-for="member in sortedMembers"
          :key="member.name"
          class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
          :class="{ 'opacity-50': getStatus(member) === 'Not Confirmed' }"
        >
          <td class="px-4 py-3 text-sm whitespace-nowrap">
            <a
              :href="personLink(member)"
              class="text-primary-600 hover:underline"
              @click.stop
            >
              {{ member.name }}
            </a>
            <span
              v-if="getStatus(member) === 'Not Confirmed'"
              class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400"
            >
              Unconfirmed
            </span>
          </td>
          <td class="px-4 py-3 text-sm whitespace-nowrap">
            <a
              v-if="managerLink(member)"
              :href="managerLink(member)"
              class="text-primary-600 hover:underline"
              @click.stop
            >{{ getManagerName(member) }}</a>
            <span v-else class="text-gray-600 dark:text-gray-400">{{ getManagerName(member) }}</span>
          </td>
          <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ getSpecialty(member) }}</td>
          <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{{ getComponent(member) }}</td>
          <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ member.geo || member.region || '—' }}</td>
          <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ getLocation(member) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="sortedMembers.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      {{ searchQuery ? `No members match "${searchQuery}"` : 'No members found.' }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink'
import { useRoster } from '@shared/client/composables/useRoster'

const { linkTo } = useModuleLink()
const { teams: allTeams } = useRoster()

const props = defineProps({
  members: { type: Array, required: true },
  teamKey: { type: String, default: null }
})

const uidToMember = computed(() => {
  const map = new Map()
  for (const t of allTeams.value) {
    for (const m of t.members) {
      if (m.uid) map.set(m.uid, m)
    }
  }
  return map
})

function getManagerName(member) {
  const uid = member.managerUid || member.manager
  if (!uid) return '—'
  const mgr = uidToMember.value.get(uid)
  return mgr?.name || uid
}

function managerLink(member) {
  const uid = member.managerUid || member.manager
  if (!uid) return null
  const mgr = uidToMember.value.get(uid)
  if (mgr?.uid) return linkTo('team-tracker', 'person-detail', { uid: mgr.uid })
  return null
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'manager', label: 'Manager' },
  { key: 'specialty', label: 'Role' },
  { key: 'component', label: 'Component' },
  { key: 'geo', label: 'Region' },
  { key: 'location', label: 'Location' },
]

function personLink(member) {
  if (member.uid) {
    return linkTo('team-tracker', 'person-detail', { uid: member.uid, ...(props.teamKey && { teamKey: props.teamKey }) })
  }
  return linkTo('team-tracker', 'person-detail', { person: member.name, ...(props.teamKey && { teamKey: props.teamKey }) })
}

function getSpecialty(member) {
  return member.engineeringSpeciality || member.specialty || member.title || '—'
}

function getStatus(member) {
  return member.status || member.customFields?.status || 'Confirmed'
}

function getComponent(member) {
  return member.customFields?.component || member.component || '—'
}

function getLocation(member) {
  const city = member.city
  const country = member.country
  if (city && country) return `${city}, ${country}`
  return city || country || '—'
}

const sortKey = ref('name')
const sortAsc = ref(true)
const roleFilter = ref(null)
const searchQuery = ref('')

function toggleSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

const uniqueRoles = computed(() => {
  const roles = new Set()
  for (const m of props.members) {
    const spec = getSpecialty(m)
    if (spec && spec !== '—') roles.add(spec)
  }
  return [...roles].sort()
})

const sortedMembers = computed(() => {
  let result = props.members
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      getManagerName(m).toLowerCase().includes(q) ||
      getSpecialty(m).toLowerCase().includes(q) ||
      getComponent(m).toLowerCase().includes(q) ||
      (m.geo || m.region || '').toLowerCase().includes(q) ||
      getLocation(m).toLowerCase().includes(q)
    )
  }
  if (roleFilter.value) {
    result = result.filter(m => getSpecialty(m) === roleFilter.value)
  }

  return [...result].sort((a, b) => {
    let aVal, bVal
    if (sortKey.value === 'specialty') {
      aVal = getSpecialty(a)
      bVal = getSpecialty(b)
    } else if (sortKey.value === 'component') {
      aVal = getComponent(a)
      bVal = getComponent(b)
    } else if (sortKey.value === 'manager') {
      aVal = getManagerName(a)
      bVal = getManagerName(b)
    } else if (sortKey.value === 'geo') {
      aVal = a.geo || a.region
      bVal = b.geo || b.region
    } else if (sortKey.value === 'location') {
      aVal = getLocation(a)
      bVal = getLocation(b)
    } else {
      aVal = a[sortKey.value]
      bVal = b[sortKey.value]
    }
    aVal = (aVal || '').toString().toLowerCase()
    bVal = (bVal || '').toString().toLowerCase()
    const cmp = aVal.localeCompare(bVal)
    return sortAsc.value ? cmp : -cmp
  })
})
</script>
