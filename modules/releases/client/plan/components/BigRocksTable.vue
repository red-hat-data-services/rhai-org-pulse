<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
import BigRockRow from './BigRockRow.vue'
import BigRockExpandedRow from './BigRockExpandedRow.vue'

const props = defineProps({
  bigRocks: { type: Array, default: () => [] },
  jiraBaseUrl: { type: String, default: '' },
  canEdit: { type: Boolean, default: false },
  rockHealth: { type: Object, default: () => ({}) },
  rockFeatures: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  healthLoading: { type: Boolean, default: false },
  releasePhaseMode: { type: String, default: 'unknown' }
})

const hasHealth = computed(function() {
  return Object.keys(props.rockHealth).length > 0
})

const emit = defineEmits(['editRock', 'addRock', 'deleteRock', 'reorder'])

// Expansion state — plain object for reliable Vue reactivity
var expandedRocks = reactive({})

function toggleExpand(rockName) {
  if (expandedRocks[rockName]) {
    delete expandedRocks[rockName]
  } else {
    expandedRocks[rockName] = true
  }
}

function isExpanded(rockName) {
  return !!expandedRocks[rockName]
}

// Escape key closes all expanded rows
function handleEscape(event) {
  if (event.key === 'Escape' && Object.keys(expandedRocks).length > 0) {
    Object.keys(expandedRocks).forEach(function(k) { delete expandedRocks[k] })
  }
}

onMounted(function() {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('mouseup', resetDragHandle)
})

onUnmounted(function() {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('mouseup', resetDragHandle)
})

// Local copy for drag reordering
const localRocks = ref([...props.bigRocks])
watch(() => props.bigRocks, function(newRocks) {
  localRocks.value = [...newRocks]
})

// Native drag-and-drop state
const dragIndex = ref(-1)
const dropIndex = ref(-1)
var dragHandleActive = false

function onHandleMouseDown() {
  dragHandleActive = true
}

function resetDragHandle() {
  dragHandleActive = false
}

function onDragStart(event, index) {
  if (!dragHandleActive) {
    event.preventDefault()
    return
  }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
  dragIndex.value = index
  // Collapse all expanded rows during drag
  Object.keys(expandedRocks).forEach(function(k) { delete expandedRocks[k] })
}

function onDragOver(event, index) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  if (index === dragIndex.value) {
    dropIndex.value = -1
    return
  }
  var rect = event.currentTarget.getBoundingClientRect()
  var midY = rect.top + rect.height / 2
  dropIndex.value = event.clientY < midY ? index : index + 1
}

function onDrop(event) {
  event.preventDefault()
  var from = dragIndex.value
  var to = dropIndex.value
  if (from < 0 || to < 0 || from === to) {
    dragIndex.value = -1
    dropIndex.value = -1
    return
  }
  var arr = localRocks.value.slice()
  var item = arr.splice(from, 1)[0]
  var insertAt = to > from ? to - 1 : to
  arr.splice(insertAt, 0, item)
  localRocks.value = arr
  dragIndex.value = -1
  dropIndex.value = -1
  var orderedNames = arr.map(function(r) { return r.name })
  emit('reorder', orderedNames)
}

function onDragEnd() {
  dragIndex.value = -1
  dropIndex.value = -1
  dragHandleActive = false
}

function handleDeleteClick(event, rock) {
  event.stopPropagation()
  emit('deleteRock', rock)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
    <!-- Toolbar -->
    <div v-if="canEdit" class="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
      <span class="text-xs text-gray-500 dark:text-gray-400">Drag to reorder.</span>
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
        <caption class="sr-only">Big Rocks for this release, ordered by priority</caption>
        <thead>
          <tr>
            <th v-if="canEdit" scope="col" class="px-2 py-2 w-8 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80"><span class="sr-only">Drag</span></th>
            <th scope="col" class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide w-8 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Priority</th>
            <th scope="col" class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Pillar</th>
            <th scope="col" class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Big Rock</th>
            <th scope="col" class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Outcome(s)</th>
            <th v-if="hasHealth" scope="col" class="px-3 py-2 text-center text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Health</th>
            <th scope="col" class="px-3 py-2 text-left text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Owners</th>
            <th v-if="hasHealth" scope="col" class="px-3 py-2 text-center text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Versions</th>
            <th scope="col" class="px-3 py-2 text-center text-gray-700 dark:text-gray-200 font-semibold uppercase text-xs tracking-wide border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80">Features / RFEs</th>
            <th v-if="canEdit" scope="col" class="px-2 py-2 w-8 border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/80"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody v-if="canEdit">
          <template v-for="(rock, index) in localRocks" :key="rock.name">
            <tr
              draggable="true"
              :class="[
                'hover:bg-gray-50 dark:hover:bg-gray-700/50',
                dragIndex === index ? 'opacity-40' : '',
                dropIndex === index ? 'border-t-2 border-t-primary-500' : '',
                dropIndex === localRocks.length && index === localRocks.length - 1 ? 'border-b-2 border-b-primary-500' : ''
              ]"
              @dragstart="onDragStart($event, index)"
              @dragover="onDragOver($event, index)"
              @drop="onDrop($event)"
              @dragend="onDragEnd"
            >
              <td class="px-2 py-2 text-center border border-gray-300 dark:border-gray-600">
                <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 select-none" aria-label="Drag to reorder" role="img" @mousedown="onHandleMouseDown" @click.stop>
                  &#x2807;
                </span>
              </td>
              <BigRockRow :rock="rock" :jiraBaseUrl="jiraBaseUrl" :health="rockHealth[rock.name]" :hasHealth="hasHealth" :rockFeatures="rockFeatures[rock.name] || []" :canEdit="true" :expanded="isExpanded(rock.name)" :releasePhaseMode="releasePhaseMode" @toggle-expand="toggleExpand(rock.name)" />
              <td class="px-2 py-2 text-center border border-gray-300 dark:border-gray-600">
                <div class="flex items-center justify-center gap-1">
                  <button
                    @click.stop="emit('editRock', rock)"
                    class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                    :aria-label="'Edit ' + rock.name"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    @click="handleDeleteClick($event, rock)"
                    class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded"
                    :aria-label="'Delete ' + rock.name"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="isExpanded(rock.name)" :key="rock.name + '-edit-expanded'" @dragover.prevent>
              <BigRockExpandedRow
                :features="rockFeatures[rock.name] || []"
                :colspan="hasHealth ? 10 : 8"
                :loading="healthLoading"
                :rockName="rock.name"
                :releasePhaseMode="releasePhaseMode"
              />
            </tr>
          </template>
        </tbody>
        <tbody v-if="!canEdit">
          <!-- Skeleton loading rows -->
          <template v-if="loading">
            <tr v-for="n in 3" :key="'skeleton-' + n">
              <td :colspan="hasHealth ? 8 : 6" class="px-3 py-4 border border-gray-300 dark:border-gray-600">
                <div class="animate-pulse flex items-center gap-4">
                  <div class="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div class="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div class="h-4 flex-1 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </td>
            </tr>
          </template>
          <!-- Data rows -->
          <template v-else-if="bigRocks && bigRocks.length > 0">
            <template v-for="rock in bigRocks" :key="rock.name">
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <BigRockRow
                  :rock="rock"
                  :jiraBaseUrl="jiraBaseUrl"
                  :health="rockHealth[rock.name]"
                  :hasHealth="hasHealth"
                  :rockFeatures="rockFeatures[rock.name] || []"
                  :canEdit="false"
                  :expanded="isExpanded(rock.name)"
                  :releasePhaseMode="releasePhaseMode"
                  @toggle-expand="toggleExpand(rock.name)"
                />
              </tr>
              <tr v-if="isExpanded(rock.name)" :key="rock.name + '-expanded'">
                <BigRockExpandedRow
                  :features="rockFeatures[rock.name] || []"
                  :colspan="hasHealth ? 8 : 6"
                  :loading="healthLoading"
                  :rockName="rock.name"
                  :releasePhaseMode="releasePhaseMode"
                />
              </tr>
            </template>
          </template>
          <!-- Empty state -->
          <tr v-else>
            <td :colspan="hasHealth ? 8 : 6" class="px-3 py-8 text-center text-gray-500 border border-gray-300 dark:border-gray-600">
              No Big Rocks configured.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
