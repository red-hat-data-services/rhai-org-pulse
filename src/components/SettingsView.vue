<template>
  <div class="max-w-3xl">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h2>

    <!-- Tab bar -->
    <div class="flex border-b border-gray-200 dark:border-gray-700 mb-6">
      <!-- Dynamic module settings tabs -->
      <button
        v-for="tab in moduleSettingsTabs"
        :key="tab.slug"
        @click="activeTab = tab.slug"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === tab.slug
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        {{ tab.label }}
      </button>
      <!-- Users tab -->
      <button
        @click="activeTab = 'users'"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === 'users'
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        Users
      </button>
      <!-- Platform-level Modules tab (git-static management) -->
      <button
        @click="activeTab = 'modules'"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === 'modules'
          ? 'border-primary-600 text-primary-600 dark:text-primary-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        Modules
      </button>
    </div>

    <!-- Dynamic module settings content -->
    <template v-for="tab in moduleSettingsTabs" :key="tab.slug">
      <component
        v-if="activeTab === tab.slug"
        :is="tab.component"
        @toast="(t) => $emit('toast', t)"
      />
    </template>

    <UserManagement
      v-if="activeTab === 'users'"
      @toast="(t) => $emit('toast', t)"
    />

    <div v-if="activeTab === 'modules'">
      <BuiltInModuleSettings @toast="(t) => $emit('toast', t)" class="mb-8" />
      <ModuleSettings @toast="(t) => $emit('toast', t)" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ModuleSettings from './ModuleSettings.vue'
import BuiltInModuleSettings from './BuiltInModuleSettings.vue'
import UserManagement from './UserManagement.vue'
import { loadModuleSettingsComponent } from '../module-loader'

const props = defineProps({
  builtInManifests: { type: Array, default: () => [] },
  initialTab: { type: String, default: null }
})

defineEmits(['toast'])

const moduleSettingsTabs = computed(() => {
  return props.builtInManifests
    .filter(m => m.client?.settingsComponent)
    .map(m => ({
      slug: m.slug,
      label: m.name,
      component: loadModuleSettingsComponent(m.slug, m.client.settingsComponent)
    }))
})

const activeTab = ref(
  props.initialTab || (moduleSettingsTabs.value.length > 0 ? moduleSettingsTabs.value[0].slug : 'modules')
)
</script>
