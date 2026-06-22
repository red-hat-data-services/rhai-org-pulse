<template>
  <div class="p-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="text-2xl font-bold text-gray-900">Create RFE from Customer Feedback</h1>
        <InfoTooltip text="Convert customer feedback into Jira RFEs (Request for Enhancement). AI analyzes pain points and searches for potential duplicates. Connect your Jira account to create RFEs directly." />
      </div>
      <p class="text-gray-600 mt-1">Transform customer pain points into structured RFE requests with AI-powered duplicate detection</p>

      <!-- Jira Connection Status -->
      <div v-if="!isDemoMode" class="mt-3">
        <div v-if="jiraConnected" class="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span class="text-sm text-green-800">
              <strong>Connected to Jira:</strong> {{ jiraSiteName }} — RFEs will be created as you
            </span>
          </div>
          <button
            @click="disconnectJira"
            class="text-sm text-green-700 hover:text-green-900 underline"
          >
            Disconnect
          </button>
        </div>
        <div v-else class="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-blue-800">
                <strong>Per-User Jira Authentication:</strong> Connect your Jira account to create RFEs as yourself (recommended)
              </p>
              <p class="text-xs text-blue-600 mt-1">
                Or use shared credentials if configured by admin
              </p>
            </div>
            <button
              @click="connectJira"
              :disabled="jiraConnecting"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {{ jiraConnecting ? 'Connecting...' : 'Connect Jira' }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="isDemoMode" class="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <p class="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> RFEs will be saved locally only. In production, RFEs are automatically created as Jira issues.
        </p>
      </div>
    </div>

    <!-- Step Indicator -->
    <div class="mb-8">
      <div class="flex items-center justify-center space-x-4">
        <div :class="stepIndicatorClass(1)">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold">1</div>
          <div class="text-sm mt-1">Draft RFE</div>
        </div>
        <div class="w-16 h-1" :class="currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'"></div>
        <div :class="stepIndicatorClass(2)">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold">2</div>
          <div class="text-sm mt-1">Check Duplicates</div>
        </div>
        <div class="w-16 h-1" :class="currentStep >= 3 ? 'bg-blue-600' : 'bg-gray-300'"></div>
        <div :class="stepIndicatorClass(3)">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold">3</div>
          <div class="text-sm mt-1">Submit</div>
        </div>
      </div>
    </div>

    <!-- Step 1: Draft RFE -->
    <div v-if="currentStep === 1" class="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Step 1: Draft Your RFE</h2>

      <!-- Source Interaction Selector -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Source Customer Interaction (Optional)
        </label>
        <select
          v-model="rfe.sourceInteractionId"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          @change="populateFromInteraction"
        >
          <option value="">-- Select an interaction --</option>
          <option v-for="interaction in interactions" :key="interaction.id" :value="interaction.id">
            {{ interaction.customerCompany }} - {{ interaction.contactName }} ({{ interaction.component }})
          </option>
        </select>
        <p class="text-xs text-gray-500 mt-1">Pre-fill RFE details from a customer interaction</p>
      </div>

      <!-- Component -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Component <span class="text-red-500">*</span>
        </label>
        <select
          v-model="rfe.component"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        >
          <option value="">-- Select component --</option>
          <option v-for="c in components.filter(c => c.id !== 'all')" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>
      </div>

      <!-- RFE Title -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          RFE Title <span class="text-red-500">*</span>
        </label>
        <input
          v-model="rfe.title"
          type="text"
          placeholder="e.g., Add support for air-gapped GPU scheduling"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
        <p class="text-xs text-gray-500 mt-1">Clear, concise title describing the feature request</p>
      </div>

      <!-- Business Justification -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Business Justification <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="rfe.businessJustification"
          rows="4"
          placeholder="Describe the business value and customer impact..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Why is this important for customers and the business?</p>
      </div>

      <!-- Technical Details -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Technical Details <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="rfe.technicalDetails"
          rows="4"
          placeholder="Describe the technical requirements and implementation details..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">What are the technical requirements?</p>
      </div>

      <!-- Use Cases -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Use Cases
        </label>
        <textarea
          v-model="rfe.useCases"
          rows="3"
          placeholder="Describe specific customer use cases..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
      </div>

      <!-- Acceptance Criteria -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Acceptance Criteria
        </label>
        <textarea
          v-model="rfe.acceptanceCriteria"
          rows="4"
          placeholder="What must be true for this RFE to be considered complete?&#10;- Feature X works as described&#10;- Performance meets Y threshold&#10;- Documentation is complete"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Define clear, testable criteria for completion</p>
      </div>

      <!-- Success Metrics -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Success Metrics
        </label>
        <textarea
          v-model="rfe.successMetrics"
          rows="3"
          placeholder="How will we measure if this feature is successful?&#10;e.g., Adoption rate, customer satisfaction, performance benchmarks"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Quantifiable metrics to track post-launch</p>
      </div>

      <!-- Implementation Complexity & Dependencies -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Implementation Complexity
          </label>
          <select
            v-model="rfe.complexity"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Low">Low (&lt; 1 sprint)</option>
            <option value="Medium">Medium (1-2 sprints)</option>
            <option value="High">High (&gt; 2 sprints)</option>
            <option value="Unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Estimated Effort (Story Points)
          </label>
          <input
            v-model.number="rfe.estimatedEffort"
            type="number"
            placeholder="e.g., 13"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <!-- Dependencies -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Dependencies
        </label>
        <textarea
          v-model="rfe.dependencies"
          rows="2"
          placeholder="List any dependencies on other features, systems, or teams..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
      </div>

      <!-- Target Release -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Target Release
          </label>
          <input
            v-model="rfe.targetRelease"
            type="text"
            placeholder="e.g., v2.5 or Q3 2026"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Requested By (Team/Person)
          </label>
          <input
            v-model="rfe.requestedBy"
            type="text"
            placeholder="e.g., Sales Engineering, Jane Doe"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <!-- Customer Information -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Customer Company</label>
          <input
            v-model="rfe.customerCompany"
            type="text"
            placeholder="e.g., Acme Corp"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Industry Vertical</label>
          <select
            v-model="rfe.industryVertical"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">-- Select --</option>
            <option>Banking & Financial Services</option>
            <option>Healthcare & Life Sciences</option>
            <option>Manufacturing</option>
            <option>Telco</option>
            <option>Retail & E-commerce</option>
            <option>Energy & Utilities</option>
            <option>Federal & Public Sector</option>
            <option>Technology</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <!-- Priority & ARR Impact -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Priority</label>
          <select
            v-model="rfe.priority"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Estimated ARR Impact</label>
          <input
            v-model.number="rfe.arrImpact"
            type="number"
            placeholder="e.g., 500000"
            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end space-x-3 pt-4 border-t">
        <button
          @click="resetForm"
          class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Reset
        </button>
        <button
          @click="searchSimilarRfes"
          :disabled="!canProceedToSearch"
          class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Search Similar RFEs →
        </button>
        <button
          @click="currentStep = 3"
          :disabled="!canProceedToSearch"
          class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Skip to Review →
        </button>
      </div>
    </div>

    <!-- Step 2: Check for Similar RFEs -->
    <div v-if="currentStep === 2" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Step 2: Check for Similar RFEs</h2>

        <!-- Searching State -->
        <div v-if="searching" class="flex flex-col items-center justify-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-600">Searching for similar RFEs...</p>
        </div>

        <!-- Search Error State -->
        <div v-else-if="searchError" class="space-y-4">
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-800 font-medium">Search failed</p>
            <p class="text-sm text-red-700 mt-1">{{ searchError }}</p>
            <p class="text-sm text-gray-600 mt-2">You can still proceed to create the RFE.</p>
          </div>
        </div>

        <!-- Search Results -->
        <div v-else-if="similarRfes.length > 0" class="space-y-4">
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-yellow-800 font-medium">
              ⚠️ Found {{ similarRfes.length }} potentially similar RFE(s)
            </p>
            <p class="text-sm text-yellow-700 mt-1">
              Please review these before proceeding. You may want to update an existing RFE instead of creating a duplicate.
            </p>
          </div>

          <div class="space-y-3">
            <div
              v-for="similar in similarRfes"
              :key="similar.id"
              class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                  <h3 class="font-semibold text-gray-900">{{ similar.title }}</h3>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {{ similar.component }}
                    </span>
                    <span :class="priorityBadgeClass(similar.priority)">
                      {{ similar.priority }}
                    </span>
                    <span class="text-xs text-gray-500">
                      {{ similar.status }}
                    </span>
                  </div>
                </div>
                <div class="text-right ml-4">
                  <div class="text-2xl font-bold text-blue-600">{{ Math.round(similar.similarity * 100) }}%</div>
                  <div class="text-xs text-gray-500">Similar</div>
                </div>
              </div>

              <p class="text-sm text-gray-700 mb-2">{{ similar.businessJustification }}</p>

              <div v-if="similar.jiraIssue" class="text-sm text-gray-600">
                <a
                  :href="similar.jiraIssue.url"
                  target="_blank"
                  class="text-blue-600 hover:text-blue-800 underline"
                >
                  {{ similar.jiraIssue.key }}: {{ similar.jiraIssue.summary }}
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- No Similar RFEs -->
        <div v-else class="text-center py-12">
          <div class="text-6xl mb-4">✅</div>
          <p class="text-gray-900 font-medium text-lg">No similar RFEs found!</p>
          <p class="text-gray-600 mt-1">This appears to be a unique request. You can proceed to submit.</p>
        </div>
      </div>

      <!-- Actions (always show unless actively searching) -->
      <div v-if="!searching" class="flex justify-between">
        <button
          @click="goBackToEdit"
          class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          ← Back to Edit
        </button>
        <div class="space-x-3">
          <button
            v-if="similarRfes.length > 0"
            @click="resetForm"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="proceedToReview"
            type="button"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
          >
            {{ similarRfes.length > 0 ? 'Proceed Anyway' : 'Continue' }} →
          </button>
        </div>
      </div>
    </div>

    <!-- Step 3: Review & Submit -->
    <div v-if="currentStep === 3" class="space-y-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Step 3: Review & Submit</h2>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Component</label>
            <p class="text-sm text-gray-900">{{ getComponentLabel(rfe.component) }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <p class="text-sm text-gray-900">{{ rfe.title }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Business Justification</label>
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ rfe.businessJustification }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Technical Details</label>
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ rfe.technicalDetails }}</p>
          </div>

          <div v-if="rfe.useCases">
            <label class="block text-sm font-medium text-gray-700 mb-1">Use Cases</label>
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ rfe.useCases }}</p>
          </div>

          <div v-if="rfe.acceptanceCriteria">
            <label class="block text-sm font-medium text-gray-700 mb-1">Acceptance Criteria</label>
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ rfe.acceptanceCriteria }}</p>
          </div>

          <div v-if="rfe.successMetrics">
            <label class="block text-sm font-medium text-gray-700 mb-1">Success Metrics</label>
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ rfe.successMetrics }}</p>
          </div>

          <div v-if="rfe.dependencies">
            <label class="block text-sm font-medium text-gray-700 mb-1">Dependencies</label>
            <p class="text-sm text-gray-900 whitespace-pre-wrap">{{ rfe.dependencies }}</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div v-if="rfe.customerCompany">
              <label class="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <p class="text-sm text-gray-900">{{ rfe.customerCompany }}</p>
            </div>
            <div v-if="rfe.industryVertical">
              <label class="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <p class="text-sm text-gray-900">{{ rfe.industryVertical }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <p class="text-sm text-gray-900">{{ rfe.priority }}</p>
            </div>
            <div v-if="rfe.arrImpact">
              <label class="block text-sm font-medium text-gray-700 mb-1">ARR Impact</label>
              <p class="text-sm text-gray-900">${{ formatNumber(rfe.arrImpact) }}</p>
            </div>
            <div v-if="rfe.complexity">
              <label class="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
              <p class="text-sm text-gray-900">{{ rfe.complexity }}</p>
            </div>
            <div v-if="rfe.estimatedEffort">
              <label class="block text-sm font-medium text-gray-700 mb-1">Estimated Effort</label>
              <p class="text-sm text-gray-900">{{ rfe.estimatedEffort }} story points</p>
            </div>
            <div v-if="rfe.targetRelease">
              <label class="block text-sm font-medium text-gray-700 mb-1">Target Release</label>
              <p class="text-sm text-gray-900">{{ rfe.targetRelease }}</p>
            </div>
            <div v-if="rfe.requestedBy">
              <label class="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
              <p class="text-sm text-gray-900">{{ rfe.requestedBy }}</p>
            </div>
          </div>
        </div>

        <!-- Submission Status -->
        <div v-if="submitting" class="mt-6 flex items-center justify-center py-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <p class="text-gray-600">Creating RFE...</p>
        </div>

        <div v-if="submitError" class="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-red-800">{{ submitError }}</p>
        </div>

        <div v-if="submitSuccess" class="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p class="text-green-800 font-medium">✅ RFE created successfully!</p>
          <p v-if="createdRfe?.jiraIssue && !isDemoMode" class="text-sm text-green-700 mt-1">
            Jira Issue:
            <a
              :href="createdRfe.jiraIssue.url"
              target="_blank"
              class="underline hover:text-green-900"
            >
              {{ createdRfe.jiraIssue.key }}
            </a>
          </p>
          <p v-if="isDemoMode" class="text-sm text-green-700 mt-1">
            (Demo mode - RFE saved locally, no Jira issue created)
          </p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-between">
        <button
          @click="currentStep = 2"
          :disabled="submitting || submitSuccess"
          class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← Back
        </button>
        <div class="space-x-3">
          <button
            v-if="submitSuccess"
            @click="createAnother"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Another RFE
          </button>
          <button
            v-else
            @click="submitRfe"
            :disabled="submitting"
            class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300"
          >
            Submit RFE
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useComponentSelector } from '../composables/useComponentSelector'
import { useInteractions } from '../composables/useInteractions'
import { useRfeCreator } from '../composables/useRfeCreator'
import { useJiraAuth } from '@shared/client/composables/useJiraAuth'

const { components } = useComponentSelector()
const { interactions } = useInteractions(ref('all'))
const { searchSimilar, createRfe } = useRfeCreator()
const {
  connected: jiraConnected,
  connecting: jiraConnecting,
  siteName: jiraSiteName,
  connectJira,
  disconnectJira
} = useJiraAuth('/api/modules/customer-insights')

const currentStep = ref(1)
const searching = ref(false)
const searchError = ref(null)
const submitting = ref(false)
const submitError = ref(null)
const submitSuccess = ref(false)
const createdRfe = ref(null)
const similarRfes = ref([])
const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const rfe = ref({
  sourceInteractionId: '',
  component: '',
  title: '',
  businessJustification: '',
  technicalDetails: '',
  useCases: '',
  acceptanceCriteria: '',
  successMetrics: '',
  complexity: 'Medium',
  estimatedEffort: null,
  dependencies: '',
  targetRelease: '',
  requestedBy: '',
  customerCompany: '',
  industryVertical: '',
  priority: 'Medium',
  arrImpact: null,
})

const canProceedToSearch = computed(() => {
  return rfe.value.component &&
         rfe.value.title &&
         rfe.value.businessJustification &&
         rfe.value.technicalDetails
})

function stepIndicatorClass(step) {
  const isActive = currentStep.value === step
  const isCompleted = currentStep.value > step

  return [
    'flex flex-col items-center',
    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
  ].join(' ')
}

function getComponentLabel(componentId) {
  if (!components || !components.value) {
    return componentId
  }
  const comp = components.value.find(c => c.id === componentId)
  return comp ? comp.label : componentId
}

function populateFromInteraction() {
  const interaction = interactions.value.find(i => i.id === rfe.value.sourceInteractionId)
  if (!interaction) return

  rfe.value.component = interaction.component
  rfe.value.customerCompany = interaction.customerCompany
  rfe.value.industryVertical = interaction.industryVertical
  rfe.value.businessJustification = `Customer feedback: ${interaction.painPoints}\n\nFeature request: ${interaction.featureFeedback || 'See pain points above'}`
  rfe.value.useCases = interaction.mainAIUseCase
}

async function searchSimilarRfes() {
  searching.value = true
  searchError.value = null
  similarRfes.value = []
  currentStep.value = 2

  try {
    const results = await searchSimilar({
      title: rfe.value.title,
      businessJustification: rfe.value.businessJustification,
      technicalDetails: rfe.value.technicalDetails,
      component: rfe.value.component,
    })
    similarRfes.value = results
  } catch (error) {
    console.error('Error searching similar RFEs:', error)
    searchError.value = error.message || 'Failed to search for similar RFEs. You can still proceed to create your RFE.'
  } finally {
    searching.value = false
  }
}

async function submitRfe() {
  submitting.value = true
  submitError.value = null

  try {
    const result = await createRfe(rfe.value)
    createdRfe.value = result
    submitSuccess.value = true
  } catch (error) {
    console.error('Error creating RFE:', error)
    submitError.value = error.message || 'Failed to create RFE. Please try again.'
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  rfe.value = {
    sourceInteractionId: '',
    component: '',
    title: '',
    businessJustification: '',
    technicalDetails: '',
    useCases: '',
    acceptanceCriteria: '',
    successMetrics: '',
    complexity: 'Medium',
    estimatedEffort: null,
    dependencies: '',
    targetRelease: '',
    requestedBy: '',
    customerCompany: '',
    industryVertical: '',
    priority: 'Medium',
    arrImpact: null,
  }
  currentStep.value = 1
  similarRfes.value = []
  submitSuccess.value = false
  submitError.value = null
  createdRfe.value = null
}

function createAnother() {
  resetForm()
}

function goBackToEdit() {
  currentStep.value = 1
}

function proceedToReview() {
  currentStep.value = 3
}

// Check for prefilled data from roadmap suggestions
onMounted(() => {
  const prefillData = sessionStorage.getItem('rfe-prefill')
  if (prefillData) {
    try {
      const suggestion = JSON.parse(prefillData)
      // Auto-fill the form
      rfe.value = {
        sourceInteractionId: '',
        component: suggestion.component || '',
        title: suggestion.title || '',
        businessJustification: suggestion.businessJustification || '',
        technicalDetails: suggestion.technicalDetails || '',
        useCases: suggestion.useCases || '',
        customerCompany: suggestion.customerCompany || '',
        industryVertical: suggestion.industryVertical || '',
        arrImpact: suggestion.arrImpact || '',
        priority: suggestion.priority || 'Medium'
      }
      // Clear the prefill data
      sessionStorage.removeItem('rfe-prefill')

      // Show a notification
      alert('Form pre-filled with AI suggestion! Review and adjust as needed.')
    } catch (err) {
      console.error('Failed to load prefill data:', err)
    }
  }
})

// Pre-fill form from URL params on mount
onMounted(() => {
  const hash = window.location.hash || ''
  const qIdx = hash.indexOf('?')
  if (qIdx === -1) return

  const queryPart = hash.substring(qIdx + 1)
  const params = {}
  queryPart.split('&').forEach(pair => {
    const [key, value] = pair.split('=')
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value)
    }
  })

  // Pre-fill if coming from a recommendation
  if (params.prefill === 'recommendation') {
    if (params.title) rfe.value.title = params.title
    if (params.component) rfe.value.component = params.component
    if (params.priority) rfe.value.priority = params.priority

    // Business justification (legacy param name: description)
    if (params.businessJustification) {
      rfe.value.businessJustification = params.businessJustification
    } else if (params.description) {
      rfe.value.businessJustification = params.description
    }

    // All the new comprehensive fields
    if (params.technicalDetails) rfe.value.technicalDetails = params.technicalDetails
    if (params.useCases) rfe.value.useCases = params.useCases
    if (params.acceptanceCriteria) rfe.value.acceptanceCriteria = params.acceptanceCriteria
    if (params.successMetrics) rfe.value.successMetrics = params.successMetrics
    if (params.complexity) rfe.value.complexity = params.complexity
    if (params.estimatedEffort) rfe.value.estimatedEffort = parseInt(params.estimatedEffort, 10)
    if (params.dependencies) rfe.value.dependencies = params.dependencies
    if (params.targetRelease) rfe.value.targetRelease = params.targetRelease
    if (params.requestedBy) rfe.value.requestedBy = params.requestedBy
    if (params.arrImpact) rfe.value.arrImpact = parseInt(params.arrImpact, 10)
  }
})

function priorityBadgeClass(priority) {
  const classes = {
    'Critical': 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded',
    'High': 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded',
    'Medium': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'Low': 'text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded',
  }
  return classes[priority] || classes['Medium']
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num)
}
</script>
