<script setup>
import { ref, computed, onMounted } from 'vue'

const STORAGE_KEY = 'releases:hygiene:welcome_dismissed'

const props = defineProps({
  ruleDetails: {
    type: Object,
    default: null
  },
  isReleaseManager: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['navigate-manage'])

const visible = ref(false)
const dontShowAgain = ref(false)
const activeTab = ref('overview')

onMounted(() => {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== 'true') {
      visible.value = true
    }
  } catch {
    visible.value = true
  }
})

function dismiss() {
  visible.value = false
  if (dontShowAgain.value) {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* localStorage unavailable */ }
  }
}

function goToManage() {
  dismiss()
  emit('navigate-manage')
}

function show() {
  visible.value = true
  activeTab.value = 'overview'
}

defineExpose({ show })

const enabledRuleCount = computed(() => {
  if (!props.ruleDetails) return 0
  let count = 0
  for (const cat of Object.values(props.ruleDetails)) {
    for (const rule of cat.rules) {
      if (rule.enabled) count++
    }
  }
  return count
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      data-testid="hygiene-welcome-modal"
      class="fixed inset-0 z-[9999] flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40 dark:bg-black/60"
        @click="dismiss"
      />

      <!-- Modal -->
      <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6 z-10">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Welcome to Feature Status
        </h2>

        <!-- Tabs -->
        <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            @click="activeTab = 'overview'"
            class="px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            :class="activeTab === 'overview'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >Overview</button>
          <button
            @click="activeTab = 'rules'"
            class="px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            :class="activeTab === 'rules'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Hygiene Rules
            <span
              v-if="ruleDetails"
              class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            >{{ enabledRuleCount }}</span>
          </button>
        </div>

        <!-- Overview tab -->
        <div v-if="activeTab === 'overview'" class="text-sm text-gray-600 dark:text-gray-300 space-y-3">
          <p>
            This board shows hygiene rule compliance for features in the selected release.
            Each card represents a Jira feature, organized by workflow status.
          </p>

          <p>
            <strong class="text-gray-800 dark:text-gray-200">Violations</strong> highlight
            fields that need attention — such as a missing assignee, outdated status summary,
            or incomplete metadata. They help keep release data accurate and actionable.
          </p>

          <p>
            Click any card to see full details and specific guidance on how to resolve
            outstanding items.
          </p>

          <p v-if="isReleaseManager" class="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
            As a release manager, you can configure which rules are active and adjust
            thresholds on the
            <button @click="goToManage" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">Manage</button>
            page.
          </p>
        </div>

        <!-- Rules tab -->
        <div v-else-if="activeTab === 'rules'">
          <div v-if="ruleDetails" class="space-y-4 max-h-64 overflow-y-auto pr-1">
            <div v-for="(cat, key) in ruleDetails" :key="key">
              <h4 class="text-xs font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wide mb-1.5">
                {{ cat.label }}
              </h4>
              <ul class="space-y-1.5">
                <li
                  v-for="rule in cat.rules"
                  :key="rule.id"
                  class="flex items-start gap-2 text-xs"
                >
                  <span
                    class="mt-0.5 w-2 h-2 rounded-full shrink-0"
                    :class="rule.enabled
                      ? 'bg-green-500 dark:bg-green-400'
                      : 'bg-gray-300 dark:bg-gray-600'"
                    :title="rule.enabled ? 'Enabled' : 'Disabled'"
                  />
                  <div>
                    <span
                      class="font-medium"
                      :class="rule.enabled
                        ? 'text-gray-800 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-500'"
                    >{{ rule.name }}</span>
                    <p
                      v-if="rule.enabled"
                      class="text-gray-500 dark:text-gray-400 mt-0.5 leading-snug"
                    >{{ rule.description }}</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
            Rule details are only visible to release managers.
          </div>
          <p
            v-if="isReleaseManager && ruleDetails"
            class="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3 mt-4"
          >
            You can enable, disable, or adjust thresholds for these rules on the
            <button @click="goToManage" class="text-primary-600 dark:text-primary-400 hover:underline font-medium">Manage</button>
            page.
          </p>
        </div>

        <div class="mt-5 flex items-center justify-between">
          <label class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer select-none">
            <input
              v-model="dontShowAgain"
              type="checkbox"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            Don't show this again
          </label>
          <button
            @click="dismiss"
            class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 hover:bg-primary-700 text-white transition-colors dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
