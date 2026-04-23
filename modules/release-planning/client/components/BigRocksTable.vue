<script setup>
import { ref, toRef, watch } from 'vue'
import draggable from 'vuedraggable'
import { useRockColors } from '../composables/useRockColors'

const props = defineProps({
  bigRocks: { type: Array, default: () => [] },
  jiraBaseUrl: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['editRock', 'addRock', 'deleteRock', 'reorder'])

const { rockRowClass } = useRockColors(toRef(props, 'bigRocks'))

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
            <th v-if="canEdit" class="px-2 py-2 w-8 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50"></th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium w-8 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">#</th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">Pillar</th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">Big Rock</th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">Outcome(s)</th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">State</th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">Owner</th>
            <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">Features</th>
            <th class="px-3 py-2 text-center text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">RFEs</th>
            <th class="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-medium border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">Notes</th>
            <th v-if="canEdit" class="px-2 py-2 w-8 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50"></th>
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
              :class="[rockRowClass(rock.name).bg, 'cursor-pointer hover:ring-2 hover:ring-primary-400 hover:ring-inset']"
              @click="handleRowClick(rock)"
            >
              <td class="px-2 py-2 text-center border border-gray-300 dark:border-gray-600">
                <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none" @click.stop>
                  &#x2807;
                </span>
              </td>
              <td class="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs border border-gray-300 dark:border-gray-600">{{ rock.priority }}</td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {{ rock.pillar }}
                </span>
              </td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
                <div class="text-gray-900 dark:text-gray-100 font-medium">{{ rock.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ rock.fullName }}</div>
              </td>
              <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
                <div v-for="key in rock.outcomeKeys" :key="key" class="mb-0.5">
                  <a
                    :href="`${jiraBaseUrl}/${key}`"
                    target="_blank"
                    rel="noopener"
                    class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                    @click.stop
                  >{{ key }}</a>
                  <span v-if="rock.outcomeDescriptions && rock.outcomeDescriptions[key]" class="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    - {{ rock.outcomeDescriptions[key] }}
                  </span>
                </div>
                <span v-if="!rock.outcomeKeys || rock.outcomeKeys.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic">TBD</span>
              </td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ rock.state }}</td>
              <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ rock.owner || '-' }}</td>
              <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
                <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.featureCount }}</span>
              </td>
              <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
                <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.rfeCount }}</span>
              </td>
              <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate border border-gray-300 dark:border-gray-600">{{ rock.notes }}</td>
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
            :class="[rockRowClass(rock.name).bg]"
          >
            <td class="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs border border-gray-300 dark:border-gray-600">{{ rock.priority }}</td>
            <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
              <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {{ rock.pillar }}
              </span>
            </td>
            <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
              <div class="text-gray-900 dark:text-gray-100 font-medium">{{ rock.name }}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ rock.fullName }}</div>
            </td>
            <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
              <div v-for="key in rock.outcomeKeys" :key="key" class="mb-0.5">
                <a
                  :href="`${jiraBaseUrl}/${key}`"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                  @click.stop
                >{{ key }}</a>
                <span v-if="rock.outcomeDescriptions && rock.outcomeDescriptions[key]" class="text-xs text-gray-500 dark:text-gray-400 ml-1">
                  - {{ rock.outcomeDescriptions[key] }}
                </span>
              </div>
              <span v-if="!rock.outcomeKeys || rock.outcomeKeys.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic">TBD</span>
            </td>
            <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ rock.state }}</td>
            <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ rock.owner || '-' }}</td>
            <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.featureCount }}</span>
            </td>
            <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.rfeCount }}</span>
            </td>
            <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate border border-gray-300 dark:border-gray-600">{{ rock.notes }}</td>
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
