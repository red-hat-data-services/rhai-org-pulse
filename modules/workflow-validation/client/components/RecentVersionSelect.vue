<template>
  <RecentFilterSelect :model-value="modelValue" :options="options" label="RHOAI versions" all-label="All versions"
    :normalize="normalizeVersions" :format-label="versionLabel" @update:model-value="$emit('update:modelValue', $event)" />
</template>

<script setup>
import RecentFilterSelect from './RecentFilterSelect.vue'
import * as versionRules from '../../lib/versions.js'

const { normalizeVersions, versionLabel } = versionRules

defineProps({ modelValue: { type: Array, default: () => [] }, options: { type: Array, default: () => [] } })
defineEmits(['update:modelValue'])
</script>
