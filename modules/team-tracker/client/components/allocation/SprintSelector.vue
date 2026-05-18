<template>
  <select
    :value="selectedSprintId"
    @change="$emit('select-sprint', Number($event.target.value))"
    class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
  >
    <optgroup v-if="activeSprints.length" label="Active">
      <option v-for="sprint in activeSprints" :key="sprint.id" :value="sprint.id">
        {{ sprint.name }}
      </option>
    </optgroup>
    <optgroup v-if="futureSprints.length" label="Future">
      <option v-for="sprint in futureSprints" :key="sprint.id" :value="sprint.id">
        {{ sprint.name }}
      </option>
    </optgroup>
    <optgroup v-if="closedSprints.length" label="Closed">
      <option v-for="sprint in closedSprints" :key="sprint.id" :value="sprint.id">
        {{ sprint.name }}
      </option>
    </optgroup>
  </select>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sprints: {
    type: Array,
    required: true
  },
  selectedSprintId: {
    type: Number,
    default: null
  }
})

defineEmits(['select-sprint'])

const activeSprints = computed(() =>
  props.sprints.filter(s => s.state === 'active')
)

const futureSprints = computed(() =>
  props.sprints.filter(s => s.state === 'future')
)

const closedSprints = computed(() =>
  props.sprints
    .filter(s => s.state === 'closed')
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
)
</script>
