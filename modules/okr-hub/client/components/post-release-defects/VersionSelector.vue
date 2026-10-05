<template>
  <div class="w-full">
    <!-- Selected versions as removable chips -->
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5 mb-2">
      <span
        v-for="versionName in modelValue"
        :key="versionName"
        class="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium"
      >
        {{ versionName }}
        <button
          @click="removeVersion(versionName)"
          class="ml-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-bold text-base leading-none"
          aria-label="Remove"
        >
          ×
        </button>
      </span>
    </div>

    <!-- Quick version group selectors -->
    <div class="mb-3">
      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick select</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="group in quickVersionGroups"
          :key="group.label"
          type="button"
          :disabled="group.names.length === 0 || (!isQuickGroupSelected(group) && !canSelectGroup(group))"
          :aria-pressed="isQuickGroupSelected(group)"
          :title="group.names.length === 0 ? 'No matching Jira versions found' : undefined"
          class="px-3 py-1.5 rounded-full border text-xs font-medium transition-colors"
          :class="isQuickGroupSelected(group)
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed'"
          @click="toggleQuickGroup(group)"
        >
          {{ group.label }}
        </button>
      </div>
    </div>

    <!-- Dropdown with search -->
    <div class="relative">
      <input
        v-model="searchQuery"
        @focus="isOpen = true"
        @blur="handleBlur"
        type="text"
        placeholder="Search versions..."
        class="w-full px-3 py-2 text-sm border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
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

const quickVersionDefinitions = [
  { label: '3.4 GA', names: ['rhoai-3.4', 'rhelai-3.4'], aliases: ['RHAIIS-3.4', 'RHAII-3.4'] },
  { label: '3.5 EA1', names: ['3.5 EA1 RHOAI RELEASE', '3.5 EA1 RHELAI RELEASE', '3.5 EA1 RHAII RELEASE'] },
  { label: '3.5 EA2', names: ['3.5 EA2 RHOAI RELEASE', '3.5 EA2 RHELAI RELEASE', '3.5 EA2 RHAII RELEASE'] },
  { label: '3.5 GA', names: ['3.5 GA RHOAI RELEASE', '3.5 GA RHELAI RELEASE', '3.5 GA RHAII RELEASE'] },
  { label: '3.6 EA1', names: ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHELAI RELEASE', '3.6 EA1 RHAII RELEASE'] },
  { label: '3.6 EA2', names: ['3.6 EA2 RHOAI RELEASE', '3.6 EA2 RHELAI RELEASE', '3.6 EA2 RHAII RELEASE'] },
  { label: '3.6 GA', names: ['3.6 GA RHOAI RELEASE', '3.6 GA RHELAI RELEASE', '3.6 GA RHAII RELEASE'] }
];

const quickVersionGroups = computed(() => quickVersionDefinitions.map(group => {
  const availableNames = group.names.filter(name => props.versions.some(version => version.name === name));
  if (group.aliases) {
    const availableAlias = group.aliases.find(name => props.versions.some(version => version.name === name));
    if (availableAlias) availableNames.push(availableAlias);
  }
  return { ...group, names: availableNames };
}));

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

function isQuickGroupSelected(group) {
  return group.names.length > 0 && group.names.every(name => props.modelValue.includes(name));
}

function canSelectGroup(group) {
  const missingNames = group.names.filter(name => !props.modelValue.includes(name));
  return props.modelValue.length + missingNames.length <= props.maxSelections;
}

function toggleQuickGroup(group) {
  if (group.names.length === 0) return;

  if (isQuickGroupSelected(group)) {
    emit('update:modelValue', props.modelValue.filter(name => !group.names.includes(name)));
    return;
  }

  if (!canSelectGroup(group)) return;
  const next = [...props.modelValue];
  for (const name of group.names) {
    if (!next.includes(name)) next.push(name);
  }
  emit('update:modelValue', next);
}

function handleBlur() {
  setTimeout(() => {
    isOpen.value = false;
  }, 200);
}

function getBugCountClass(count) {
  if (count === 0) return 'text-gray-400 dark:text-gray-500';
  if (count >= 10) return 'text-red-600 dark:text-red-400';
  return 'text-orange-500 dark:text-orange-400';
}
</script>
