<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  notes: { type: String, default: '' },
  featureKey: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['toggleItem', 'updateNotes'])

var localNotes = ref(props.notes || '')

watch(function() { return props.notes }, function(val) {
  localNotes.value = val || ''
})

var checkedCount = computed(function() {
  var count = 0
  for (var i = 0; i < props.items.length; i++) {
    if (props.items[i].checked) count++
  }
  return count
})

var totalCount = computed(function() {
  return props.items.length
})

var completionPct = computed(function() {
  if (totalCount.value === 0) return 0
  return Math.round((checkedCount.value / totalCount.value) * 100)
})

function handleToggle(item) {
  if (item.type !== 'manual' || !props.canEdit) return
  emit('toggleItem', item.id, !item.checked)
}

function handleNotesInput(event) {
  localNotes.value = event.target.value
  emit('updateNotes', event.target.value)
}

function itemStatusClass(item) {
  if (item.checked) return 'text-green-600 dark:text-green-400'
  return 'text-gray-400 dark:text-gray-500'
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header with completion -->
    <div class="flex items-center justify-between">
      <div class="text-xs font-semibold text-gray-700 dark:text-gray-300">
        Definition of Ready
        <span class="ml-1 font-normal text-gray-500 dark:text-gray-400">({{ checkedCount }}/{{ totalCount }})</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
          <div
            class="h-1.5 rounded-full transition-all"
            :class="completionPct >= 80 ? 'bg-green-500' : completionPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'"
            :style="{ width: Math.min(completionPct, 100) + '%' }"
          ></div>
        </div>
        <span class="text-[10px] font-medium text-gray-500 dark:text-gray-400">{{ completionPct }}%</span>
      </div>
    </div>

    <!-- Checklist items -->
    <div class="space-y-1">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-start gap-2 py-1 px-2 rounded text-xs"
        :class="item.type === 'manual' && canEdit ? 'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer' : ''"
        @click="handleToggle(item)"
      >
        <!-- Checkbox / Lock icon -->
        <div class="flex-shrink-0 mt-0.5">
          <template v-if="item.type === 'automated'">
            <!-- Lock icon for automated items -->
            <svg
              class="w-3.5 h-3.5"
              :class="itemStatusClass(item)"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </template>
          <template v-else>
            <!-- Checkbox for manual items -->
            <input
              type="checkbox"
              :checked="item.checked"
              :disabled="!canEdit"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              @click.stop="handleToggle(item)"
              @change.stop
            />
          </template>
        </div>

        <!-- Label -->
        <div class="flex-1 min-w-0">
          <span
            class="text-gray-700 dark:text-gray-300"
            :class="item.checked ? '' : 'opacity-80'"
          >{{ item.label }}</span>
          <span
            class="ml-1 text-[10px] text-gray-400 dark:text-gray-500"
          >({{ item.type === 'automated' ? 'auto' : 'manual' }})</span>
        </div>

        <!-- Status indicator -->
        <div class="flex-shrink-0">
          <svg
            v-if="item.checked"
            class="w-3.5 h-3.5 text-green-500 dark:text-green-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg
            v-else
            class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
      <label class="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</label>
      <textarea
        v-if="canEdit"
        :value="localNotes"
        @input="handleNotesInput"
        rows="2"
        maxlength="2000"
        placeholder="Add readiness notes..."
        class="mt-1 w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 resize-none"
      ></textarea>
      <p v-else-if="localNotes" class="mt-1 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{{ localNotes }}</p>
      <p v-else class="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">No notes</p>
    </div>
  </div>
</template>
