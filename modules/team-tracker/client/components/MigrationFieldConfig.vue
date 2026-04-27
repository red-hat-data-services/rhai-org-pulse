<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('cancel')">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Configure Field Types</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose how each field should be stored after migration. {{ preview.totalPeople }} active people will be migrated.
        </p>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div v-if="loading" class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>

        <div v-else-if="preview.fields.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
          No custom fields to migrate.
        </div>

        <div
          v-for="field in preview.fields"
          :key="field.key"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div class="flex items-start justify-between gap-4 mb-3">
            <div>
              <h4 class="font-medium text-gray-900 dark:text-gray-100">{{ field.label }}</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {{ field.populatedCount }} people have values · {{ field.uniqueCount }} unique values
              </p>
            </div>
          </div>

          <!-- Type selector -->
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <label class="text-sm text-gray-600 dark:text-gray-400">Type:</label>
            <select
              :value="overrides[field.key].type"
              @change="overrides[field.key].type = $event.target.value"
              class="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="free-text">Free Text</option>
              <option value="constrained">Constrained (dropdown)</option>
              <option value="person-reference-linked">Person Reference</option>
            </select>

            <label class="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 ml-2">
              <input
                type="checkbox"
                :checked="overrides[field.key].multiValue"
                @change="overrides[field.key].multiValue = $event.target.checked"
                class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              Multi-value
            </label>
          </div>

          <!-- Info badges -->
          <div class="flex flex-wrap gap-2 mb-2">
            <span v-if="field.hasCommas" class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              Comma-separated values detected
            </span>
            <span v-if="field.personMatchRate > 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs"
              :class="field.personMatchRate >= 50
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
            >
              {{ field.personMatchRate }}% match roster names
            </span>
          </div>

          <!-- Constrained: preview allowed values -->
          <div v-if="overrides[field.key].type === 'constrained'" class="mt-2">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Allowed values ({{ field.uniqueCount }}):
            </p>
            <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              <span
                v-for="val in field.uniqueValues.slice(0, 30)"
                :key="val"
                class="inline-flex px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >{{ val }}</span>
              <span v-if="field.uniqueValues.length > 30" class="text-xs text-gray-400">
                +{{ field.uniqueValues.length - 30 }} more
              </span>
            </div>
          </div>

          <!-- Person reference: preview matches -->
          <div v-if="overrides[field.key].type === 'person-reference-linked'" class="mt-2">
            <p v-if="field.unmatchedValues.length > 0" class="text-xs text-amber-600 dark:text-amber-400 mb-1">
              {{ field.unmatchedValues.length }} values could not be matched to roster people (will be dropped):
            </p>
            <div v-if="field.unmatchedValues.length > 0" class="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              <span
                v-for="val in field.unmatchedValues.slice(0, 15)"
                :key="val"
                class="inline-flex px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              >{{ val }}</span>
              <span v-if="field.unmatchedValues.length > 15" class="text-xs text-gray-400">
                +{{ field.unmatchedValues.length - 15 }} more
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <button
          @click="$emit('cancel')"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          @click="$emit('confirm', fieldOverridesList)"
          :disabled="loading"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          Migrate with these settings
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

defineEmits(['confirm', 'cancel'])

const loading = ref(true)
const preview = ref({ fields: [], totalPeople: 0 })
const overrides = reactive({})

onMounted(async () => {
  try {
    const data = await apiRequest('/modules/team-tracker/structure/migrate/preview')
    preview.value = data
    for (const field of data.fields) {
      overrides[field.key] = {
        type: field.suggestedType,
        multiValue: field.suggestedMultiValue
      }
    }
  } catch (err) {
    console.error('Failed to load migration preview:', err)
  } finally {
    loading.value = false
  }
})

const fieldOverridesList = computed(() =>
  preview.value.fields.map(f => ({
    key: f.key,
    type: overrides[f.key]?.type || 'free-text',
    multiValue: overrides[f.key]?.multiValue || false
  }))
)
</script>
