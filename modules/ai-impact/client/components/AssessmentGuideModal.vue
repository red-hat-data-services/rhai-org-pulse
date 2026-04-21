<script setup>
import { ref } from 'vue'

defineProps({
  show: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const activeTab = ref('scoring')
const dontShowAgain = ref(false)

function handleClose() {
  emit('close', dontShowAgain.value)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="handleClose" />

        <!-- Modal -->
        <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Impact Tools</h2>
            <button
              @click="handleClose"
              class="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex border-b border-gray-200 dark:border-gray-700 px-6">
            <button
              @click="activeTab = 'scoring'"
              class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
              :class="activeTab === 'scoring'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              Quality Scoring
            </button>
            <button
              @click="activeTab = 'creator'"
              class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
              :class="activeTab === 'creator'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
            >
              RFE Creator
            </button>
          </div>

          <!-- Content (scrollable) -->
          <div class="flex-1 overflow-auto px-6 py-5">

            <!-- Scoring Tab -->
            <div v-if="activeTab === 'scoring'" class="space-y-5">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">How RFE Quality Scoring Works</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                  Each RFE (Request for Enhancement) is automatically assessed by an AI-powered pipeline that evaluates how well the RFE communicates its intent. Scores range from 0–10 across five criteria, with a pass threshold of 5.
                </p>
              </div>

              <!-- Flow diagram -->
              <div class="flex items-center gap-2 text-xs">
                <span class="px-2.5 py-1.5 rounded-md bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-200 font-medium">RFE Created</span>
                <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                <span class="px-2.5 py-1.5 rounded-md bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-200 font-medium">Assessment Pipeline</span>
                <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                <span class="px-2.5 py-1.5 rounded-md bg-green-100 dark:bg-green-800/60 text-green-700 dark:text-green-200 font-medium">Quality Score</span>
              </div>

              <!-- Rubric -->
              <div>
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Scoring Criteria</h4>
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table class="w-full text-sm">
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100 w-24">What (0–2)</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Does the RFE clearly describe the desired outcome?</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">Why (0–2)</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Is there a compelling business justification?</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">How (0–2)</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Are acceptance criteria specific and measurable?</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">Task (0–2)</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Is this a true enhancement, not a task or bug?</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-semibold text-gray-900 dark:text-gray-100">Size (0–2)</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Is the scope right-sized for a single RFE?</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- CLI reference -->
              <div class="rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 px-4 py-3">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">CLI Tools</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  The scoring rubric is maintained in the <span class="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">assess-rfe</span> plugin (source: <a href="https://github.com/n1hility/assess-rfe" target="_blank" rel="noopener noreferrer" class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline">n1hility/assess-rfe</a>).
                </p>
                <div class="space-y-1.5 text-xs font-mono">
                  <div class="flex items-start gap-2">
                    <code class="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 whitespace-nowrap">/assess-rfe</code>
                    <span class="text-gray-500 dark:text-gray-400 font-sans pt-0.5">Evaluate an RFE interactively against the rubric</span>
                  </div>
                  <div class="flex items-start gap-2">
                    <code class="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 whitespace-nowrap">/export-rubric</code>
                    <span class="text-gray-500 dark:text-gray-400 font-sans pt-0.5">Export the full scoring rubric to a markdown file</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Creator Tab -->
            <div v-if="activeTab === 'creator'" class="space-y-5">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">RFE Creator</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                  The RFE Creator is an AI-powered toolkit for the full RFE lifecycle — from initial idea through submission to Jira. It builds on the quality scoring rubric to ensure every RFE meets quality standards before submission.
                </p>
              </div>

              <!-- Workflow -->
              <div>
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Workflow</h4>
                <div class="flex items-center gap-2 text-xs flex-wrap">
                  <span class="px-2.5 py-1.5 rounded-md bg-purple-100 dark:bg-purple-800/60 text-purple-700 dark:text-purple-200 font-medium">Create</span>
                  <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                  <span class="px-2.5 py-1.5 rounded-md bg-purple-100 dark:bg-purple-800/60 text-purple-700 dark:text-purple-200 font-medium">Review</span>
                  <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                  <span class="px-2.5 py-1.5 rounded-md bg-purple-100 dark:bg-purple-800/60 text-purple-700 dark:text-purple-200 font-medium">Auto-Fix</span>
                  <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                  <span class="px-2.5 py-1.5 rounded-md bg-green-100 dark:bg-green-800/60 text-green-700 dark:text-green-200 font-medium">Submit</span>
                </div>
              </div>

              <!-- Key skills -->
              <div>
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Available Skills</h4>
                <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table class="w-full text-sm">
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">/rfe.create</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Write a new RFE from a problem statement or idea</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">/rfe.review</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Review and improve existing RFEs by Jira key</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">/rfe.auto-fix</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Batch review and fix RFEs automatically via JQL</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">/rfe.split</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Split oversized RFEs into right-sized pieces</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">/rfe.submit</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">Submit or update RFEs in Jira</td>
                      </tr>
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td class="px-4 py-2.5 font-mono text-xs text-purple-600 dark:text-purple-400 whitespace-nowrap">/rfe.speedrun</td>
                        <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300">End-to-end pipeline: create, review, fix, and submit</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Install -->
              <div class="rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 px-4 py-3">
                <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Installation</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Both plugins are available from the <a href="https://github.com/opendatahub-io/skills-registry" target="_blank" rel="noopener noreferrer" class="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 hover:underline">opendatahub-skills</a> registry. Install them in Claude Code:
                </p>
                <div class="space-y-2 text-xs font-mono">
                  <div>
                    <p class="text-gray-500 dark:text-gray-400 font-sans text-xs mb-1">Quality scoring (assess-rfe):</p>
                    <code class="block px-3 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">/plugin install assess-rfe@opendatahub-skills</code>
                  </div>
                  <div>
                    <p class="text-gray-500 dark:text-gray-400 font-sans text-xs mb-1">Full RFE lifecycle (rfe-creator):</p>
                    <code class="block px-3 py-2 rounded bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">/plugin install rfe-creator@opendatahub-skills</code>
                  </div>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Source: <a href="https://github.com/n1hility/assess-rfe" target="_blank" rel="noopener noreferrer" class="font-mono text-blue-600 dark:text-blue-400 hover:underline">n1hility/assess-rfe</a> and <a href="https://github.com/jwforres/rfe-creator" target="_blank" rel="noopener noreferrer" class="font-mono text-blue-600 dark:text-blue-400 hover:underline">jwforres/rfe-creator</a>
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                v-model="dontShowAgain"
                type="checkbox"
                class="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
              />
              <span class="text-sm text-gray-500 dark:text-gray-400">Don't show this again</span>
            </label>
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: scale(0.95);
}
</style>
