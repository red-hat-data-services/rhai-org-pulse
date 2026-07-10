<script setup>
import { ref, onMounted } from 'vue'
import { fetchPmRoster } from '../services/api.js'

defineProps({
  pmDisplayName: { type: String, default: '' },
  viewAsPm: { type: String, default: '' },
  release: { type: String, default: '3.5' },
  loading: { type: Boolean, default: false },
  user: { type: Object, default: null }
})

const emit = defineEmits(['update:pmDisplayName', 'update:viewAsPm', 'update:release', 'load'])

const releases = ['3.5', '3.6']
const showViewAs = ref(false)
const roster = ref([])

onMounted(async () => {
  try {
    const data = await fetchPmRoster()
    roster.value = data.roster || []
  } catch {
    roster.value = []
  }
})
</script>

<template>
  <header class="bg-primary-900 text-white px-4 py-4 sm:px-6">
    <div class="max-w-6xl mx-auto space-y-3">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">PM Pipeline</h1>
          <p class="text-sm text-white/75 mt-0.5">Planning prep — where your work is and what to do next</p>
          <p v-if="user" class="text-xs text-white/60 mt-1">{{ user.email }}</p>
        </div>
      </div>

      <form
        class="flex flex-col gap-2"
        @submit.prevent="emit('load')"
      >
        <div class="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
          <label class="sr-only" for="pm-name">Jira display name</label>
          <input
            id="pm-name"
            :value="pmDisplayName"
            type="text"
            placeholder="Your Jira display name"
            class="rounded-md border-0 px-3 py-2 text-sm text-gray-900 min-w-[200px] flex-1 sm:flex-none sm:min-w-[220px]"
            @input="emit('update:pmDisplayName', $event.target.value)"
          />
          <select
            :value="release"
            class="rounded-md border-0 px-3 py-2 text-sm text-gray-900"
            @change="emit('update:release', $event.target.value)"
          >
            <option v-for="r in releases" :key="r" :value="r">Release {{ r }}</option>
          </select>
          <button
            type="submit"
            class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="loading || (!pmDisplayName.trim() && !viewAsPm.trim())"
          >
            {{ loading ? 'Loading…' : 'Load pipeline' }}
          </button>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
          <label class="inline-flex items-center gap-2 text-white/80 cursor-pointer">
            <input v-model="showViewAs" type="checkbox" class="rounded border-gray-300" />
            View another PM's pipeline
          </label>
          <div v-if="showViewAs" class="flex-1 sm:max-w-xs">
            <input
              :value="viewAsPm"
              list="pm-roster-list"
              type="text"
              placeholder="PM display name (e.g. Adam Bellusci)"
              class="w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900"
              @input="emit('update:viewAsPm', $event.target.value)"
            />
            <datalist id="pm-roster-list">
              <option v-for="name in roster" :key="name" :value="name" />
            </datalist>
          </div>
        </div>
      </form>
    </div>
  </header>
</template>
