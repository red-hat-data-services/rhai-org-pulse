<template>
  <div class="w-full max-w-2xl">
    <label class="block text-sm font-medium mb-2">Select Versions (max {{ maxSelections }})</label>

    <!-- Selected versions as removable chips -->
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-2 mb-2">
      <span
        v-for="versionName in modelValue"
        :key="versionName"
        class="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-sm"
      >
        {{ versionName }}
        <button
          @click="removeVersion(versionName)"
          class="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-bold"
          aria-label="Remove"
        >
          ×
        </button>
      </span>
    </div>

    <!-- Dropdown with search -->
    <div class="relative">
      <input
        v-model="searchQuery"
        @focus="isOpen = true"
        @blur="handleBlur"
        type="text"
        placeholder="Search versions..."
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        :disabled="modelValue.length >= maxSelections"
      />

      <div
        v-if="isOpen && filteredVersions.length > 0"
        class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      >
        <button
          v-for="version in filteredVersions"
          :key="version.name"
          @mousedown.prevent="addVersion(version.name)"
          class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between gap-4"
          :disabled="modelValue.includes(version.name)"
          :class="{ 'opacity-50 cursor-not-allowed': modelValue.includes(version.name) }"
        >
          <span class="flex-1">{{ version.name }}</span>
          <div class="flex items-center gap-3 text-xs text-gray-500">
            <span class="font-semibold" :class="getBugCountClass(version.bugCount)">
              {{ version.bugCount }} {{ version.bugCount === 1 ? 'bug' : 'bugs' }}
            </span>
            <span>{{ version.releaseDate }}</span>
          </div>
        </button>
      </div>

      <div v-if="isOpen && filteredVersions.length === 0" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 text-center text-gray-500 dark:text-gray-400">
        No versions found
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: Array, required: true },
  versions: { type: Array, required: true },
  maxSelections: { type: Number, default: 6 }
});

const emit = defineEmits(['update:modelValue']);

const searchQuery = ref('');
const isOpen = ref(false);

const filteredVersions = computed(() => {
  if (!searchQuery.value) {
    return props.versions.filter(v => !props.modelValue.includes(v.name));
  }
  const query = searchQuery.value.toLowerCase();
  return props.versions.filter(v =>
    !props.modelValue.includes(v.name) &&
    v.name.toLowerCase().includes(query)
  );
});

function addVersion(versionName) {
  if (props.modelValue.length >= props.maxSelections) return;
  if (props.modelValue.includes(versionName)) return;

  emit('update:modelValue', [...props.modelValue, versionName]);
  searchQuery.value = '';
  isOpen.value = false;
}

function removeVersion(versionName) {
  emit('update:modelValue', props.modelValue.filter(v => v !== versionName));
}

function handleBlur() {
  setTimeout(() => {
    isOpen.value = false;
  }, 200);
}

function getBugCountClass(count) {
  if (count === 0) return 'text-gray-400';
  if (count >= 10) return 'text-red-600';
  return 'text-orange-500';
}
</script>
