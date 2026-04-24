<script setup>
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import BigRockRow from './BigRockRow.vue'

const props = defineProps({
  bigRocks: { type: Array, default: () => [] },
  jiraBaseUrl: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['editRock', 'addRock', 'deleteRock', 'reorder'])

// Local copy for draggable to mutate
const localRocks = ref([...props.bigRocks])
watch(() => props.bigRocks, function(newRocks) {
  localRocks.value = [...newRocks]
})

function handleRowClick(rock) {
  if (props.canEdit) {
    emit('editRock', rock)
  }
}

function handleDeleteClick(event, rock) {
  event.stopPropagation()
  emit('deleteRock', rock)
}

function onDragEnd() {
  var orderedNames = localRocks.value.map(function(r) { return r.name })
  emit('reorder', orderedNames)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
    <!-- Toolbar -->
    <div v-if="canEdit" class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
      <span class="text-xs text-gray-500 dark:text-gray-400">Click a row to edit. Drag to reorder.</span>
      <button
        @click="emit('addRock')"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Big Rock
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th v-if="canEdit" class="px-2 py-2 w-8 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80"></th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide w-8 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Priority</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Pillar</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Big Rock</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Outcome(s)</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Owner</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Architect</th>
            <th class="px-3 py-2 text-center text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Features</th>
            <th class="px-3 py-2 text-center text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">RFEs</th>
            <th class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Notes</th>
            <th v-if="canEdit" class="px-2 py-2 w-8 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80"></th>
          </tr>
        </thead>
        <draggable
          v-if="canEdit"
          v-model="localRocks"
          tag="tbody"
          item-key="name"
          handle=".drag-handle"
          @end="onDragEnd"
        >
          <template #item="{ element: rock }">
            <tr
              class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              @click="handleRowClick(rock)"
            >
              <td class="px-2 py-2 text-center border border-gray-300 dark:border-gray-600">
                <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none" @click.stop>
                  &#x2807;
                </span>
              </td>
              <BigRockRow :rock="rock" :jiraBaseUrl="jiraBaseUrl" />
              <td class="px-2 py-2 text-center border border-gray-300 dark:border-gray-600">
                <button
                  @click="handleDeleteClick($event, rock)"
                  class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"
                  title="Delete Big Rock"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          </template>
        </draggable>
        <tbody v-else>
          <tr
            v-for="rock in bigRocks"
            :key="rock.name"
            class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <BigRockRow :rock="rock" :jiraBaseUrl="jiraBaseUrl" />
          </tr>
          <tr v-if="!bigRocks || bigRocks.length === 0">
            <td colspan="9" class="px-3 py-8 text-center text-gray-500 border border-gray-300 dark:border-gray-600">
              No Big Rocks configured.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
