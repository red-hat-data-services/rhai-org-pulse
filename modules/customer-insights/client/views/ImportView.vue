<template>
  <div class="p-6">
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="text-2xl font-bold text-gray-900">Import Data</h1>
        <InfoTooltip text="Bulk import customer interactions from CSV files or Google Drive documents. Data is validated and appended to your configured Google Sheet. Supports drag-and-drop upload." />
      </div>
      <p class="text-gray-600 mt-1">Import customer interactions from various sources</p>
    </div>

    <!-- Status Message -->
    <div v-if="uploadSuccess" class="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-green-800 font-medium text-lg mb-2">✅ {{ uploadSuccess }}</p>
          <p class="text-green-700 text-sm">Your data has been saved to Google Sheets and is ready to view.</p>
        </div>
        <div class="flex items-center space-x-3">
          <button
            @click="goToKanban"
            class="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center space-x-2 shadow-sm transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Kanban Board</span>
          </button>
        </div>
      </div>
    </div>
    <div v-if="uploadError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">❌ Error: {{ uploadError }}</p>
    </div>

    <!-- Tab Navigation -->
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm'
            ]"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="bg-white rounded-lg shadow p-8">
      <!-- Spreadsheet Import -->
      <div v-if="activeTab === 'spreadsheet'" class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">CSV File Upload</h3>
            <p class="text-gray-600 mb-4">
              Upload a CSV file containing customer interaction data. The file should have headers matching the interaction fields.
            </p>
          </div>
        </div>

        <!-- File Upload Area -->
        <div
          @drop.prevent="handleDrop"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          :class="[
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-gray-50'
          ]"
        >
          <svg class="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="mt-4">
            <label class="cursor-pointer">
              <span class="mt-2 block text-sm font-medium text-gray-900">
                Drop CSV file here or <span class="text-primary-600 hover:text-primary-500">browse</span>
              </span>
              <input
                type="file"
                accept=".csv"
                @change="handleFileSelect"
                class="hidden"
                ref="fileInput"
              />
            </label>
            <p class="mt-1 text-xs text-gray-500">CSV files only</p>
          </div>
        </div>

        <!-- File Preview -->
        <div v-if="selectedFile" class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-gray-900">{{ selectedFile.name }}</p>
                <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
              </div>
            </div>
            <button
              @click="clearFile"
              class="text-gray-400 hover:text-gray-600"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Upload Button -->
          <div class="mt-4 flex justify-end">
            <button
              @click="uploadFile"
              :disabled="uploading"
              class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {{ uploading ? 'Uploading...' : 'Upload & Import' }}
            </button>
          </div>
        </div>

        <!-- Expected Format -->
        <div class="bg-gray-50 border border-gray-200 rounded p-4">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Expected CSV Format:</h4>
          <p class="text-xs text-gray-600 mb-2">Your CSV should have headers with these column names (case-insensitive):</p>
          <code class="text-xs bg-white px-2 py-1 rounded block overflow-x-auto">
            customerCompany,contactName,fieldContactName,component,industryVertical,geo,customerType,environment,mainAIUseCase,toolsOfChoice,painPoints,featureFeedback,futureWishlist,pmComments,status
          </code>
        </div>
      </div>

      <!-- Transcript Import -->
      <div v-if="activeTab === 'transcript'" class="space-y-6">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Transcript Import</h3>
            <p class="text-gray-600 mb-4">
              Paste meeting notes or call transcripts. AI will detect all Red Hat AI components discussed and create a separate interaction for each.
            </p>
          </div>
        </div>

        <!-- Phase: Input -->
        <template v-if="transcriptPhase === 'input'">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Paste Transcript or Meeting Notes
              </label>
              <button
                @click="autoExtract"
                :disabled="!transcriptText.trim() || extracting"
                class="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {{ extracting ? 'Extracting...' : 'Auto-Extract with AI' }}
              </button>
            </div>
            <textarea
              v-model="transcriptText"
              rows="12"
              placeholder="Paste your meeting notes, call transcript, or customer conversation here...

Example:
Meeting with John Smith from Acme Financial Corp (Banking, North America)
- Discussed model serving latency for real-time inference
- Also needs better observability for monitoring model drift
- Currently using PyTorch and Jupyter notebooks
- Pain points: GPU scheduling, no drift alerting
- Requested: autoscaling support, custom metrics dashboard"
              class="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
            ></textarea>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 class="text-sm font-medium text-blue-900 mb-2">Multi-Component Detection</h4>
            <p class="text-sm text-blue-800">
              AI will identify all Red Hat AI components discussed in the transcript and create a separate interaction for each, with pain points and feedback attributed per component. You can review and edit before submitting.
            </p>
          </div>
        </template>

        <!-- Phase: Review -->
        <template v-if="transcriptPhase === 'review'">
          <button
            @click="transcriptPhase = 'input'"
            class="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Transcript
          </button>

          <!-- Shared Customer Information -->
          <div class="bg-white border border-gray-200 rounded-lg p-6">
            <h4 class="text-lg font-semibold text-gray-900 mb-4">Shared Customer Information</h4>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Customer Company *</label>
                  <input
                    v-model="sharedData.customerCompany"
                    type="text"
                    placeholder="e.g., Acme Financial Corp"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                  <input
                    v-model="sharedData.contactName"
                    type="text"
                    placeholder="e.g., John Smith"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Industry Vertical</label>
                  <input
                    v-model="sharedData.industryVertical"
                    type="text"
                    placeholder="e.g., Banking & Financial Services"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Geography</label>
                  <select
                    v-model="sharedData.geo"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">-- Select --</option>
                    <option value="NA">North America</option>
                    <option value="EMEA">EMEA</option>
                    <option value="APAC">APAC</option>
                    <option value="LATAM">LATAM</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    v-model="sharedData.status"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Lead">Lead</option>
                    <option value="Discovery">Discovery</option>
                    <option value="Evaluating">Evaluating</option>
                    <option value="Feedback Received">Feedback Received</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Detected Components -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-lg font-semibold text-gray-900">
                Detected Components ({{ componentInteractions.length }})
              </h4>
              <button
                @click="addComponentCard"
                class="px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors"
              >
                + Add Component
              </button>
            </div>

            <div class="space-y-4">
              <div
                v-for="(comp, index) in componentInteractions"
                :key="index"
                class="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                <!-- Card Header -->
                <div
                  class="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                  @click="toggleComponentCard(index)"
                >
                  <div class="flex items-center gap-3 flex-1">
                    <svg
                      class="w-4 h-4 text-gray-500 transition-transform"
                      :class="{ 'rotate-90': comp._expanded }"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <select
                      v-model="comp.component"
                      @click.stop
                      class="flex-1 max-w-xs px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">-- Select Component --</option>
                      <optgroup v-for="pillar in pillars" :key="pillar.name" :label="pillar.name">
                        <option v-for="c in pillar.components" :key="c.id" :value="c.id">
                          {{ c.label }}
                        </option>
                      </optgroup>
                    </select>
                    <span v-if="comp.component" class="text-xs text-gray-500">
                      {{ getPillarName(comp.component) }}
                    </span>
                  </div>
                  <button
                    @click.stop="removeComponentCard(index)"
                    class="text-gray-400 hover:text-red-600 ml-2 transition-colors"
                    title="Remove component"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Card Body -->
                <div v-if="comp._expanded" class="p-4 space-y-4 border-t border-gray-200">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Main Use Case</label>
                    <input
                      v-model="comp.mainAIUseCase"
                      type="text"
                      placeholder="Use case relevant to this component"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Pain Points</label>
                    <textarea
                      v-model="comp.painPoints"
                      rows="2"
                      placeholder="Pain points relevant to this component"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    ></textarea>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Feature Feedback</label>
                    <textarea
                      v-model="comp.featureFeedback"
                      rows="2"
                      placeholder="Feature feedback relevant to this component"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="componentInteractions.length === 0" class="text-center py-8 text-gray-500">
              <p>No components detected. Click "Add Component" to manually add one.</p>
            </div>
          </div>

          <!-- Submit / Clear -->
          <div class="flex justify-end space-x-3">
            <button
              @click="clearTranscript"
              class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              @click="submitTranscript"
              :disabled="!canSubmitTranscript || uploading"
              class="px-6 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {{ uploading ? 'Creating...' : `Create ${componentInteractions.length} Interaction${componentInteractions.length !== 1 ? 's' : ''}` }}
            </button>
          </div>
        </template>
      </div>

      <!-- Google Drive Import -->
      <div v-if="activeTab === 'google-drive'" class="space-y-4">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-lg font-semibold text-gray-900">Google Drive Import</h3>
            </div>
            <p class="text-gray-600 mb-4">
              <strong>Optional:</strong> Sign in with your Google account to import files from your personal Drive.
              All interactions are stored in a central team spreadsheet - this is only needed if you want to import files from your own Drive.
            </p>
            <p class="text-gray-600 mb-4 text-sm">
              Supports Google Sheets, CSV files, XLSX files, and Google Docs.
            </p>

            <!-- Connection Status -->
            <div v-if="!googleDrive.connected.value" class="mb-4">
              <button
                @click="connectGoogleDrive"
                :disabled="googleDrive.connecting.value"
                class="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg v-if="googleDrive.connecting.value" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {{ googleDrive.connecting.value ? 'Connecting...' : 'Connect Google Drive' }}
              </button>
              <p v-if="googleDrive.error.value" class="text-sm text-red-600 mt-2">
                {{ googleDrive.error.value }}
              </p>
            </div>

            <div v-else class="mb-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-green-800 font-medium">Connected to Google Drive</span>
              </div>
              <button
                @click="disconnectGoogleDrive"
                class="text-sm text-red-600 hover:text-red-800"
              >
                Disconnect
              </button>
            </div>

            <!-- File Picker (shown when connected) -->
            <div v-if="googleDrive.connected.value" class="bg-white border border-gray-200 rounded-lg p-6">
              <h4 class="text-sm font-medium text-gray-900 mb-4">Select File from Drive</h4>
              <button
                @click="pickGoogleDriveFile"
                :disabled="!googleDrive.pickerApiLoaded.value || processingDriveFile"
                class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {{ processingDriveFile ? 'Processing...' : 'Pick File from Drive' }}
              </button>
              <p v-if="!googleDrive.pickerApiLoaded.value" class="text-xs text-gray-500 mt-2">
                Loading Google Picker...
              </p>
            </div>

            <div class="bg-gray-50 border border-gray-200 rounded p-4 mt-4">
              <h4 class="text-sm font-medium text-gray-900 mb-2">Supported file types:</h4>
              <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
                <li>Google Sheets → Exported as CSV</li>
                <li>CSV/XLSX files → Direct download</li>
                <li>Google Docs → Exported as plain text for transcript extraction</li>
              </ul>
              <p class="text-xs text-gray-500 mt-3">
                Files are processed the same way as local uploads
              </p>
            </div>

            <!-- Setup Instructions -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 class="text-sm font-medium text-blue-900 mb-2">📝 Setup Required</h4>
              <p class="text-sm text-blue-800 mb-2">
                Google Drive import requires OAuth credentials. See setup guide:
              </p>
              <code class="text-xs bg-white text-blue-900 px-2 py-1 rounded block">
                docs/GOOGLE-CLOUD-SETUP-WALKTHROUGH.md
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useGoogleDrive } from '../composables/useGoogleDrive'
import { useComponentSelector } from '../composables/useComponentSelector'

const moduleNav = inject('moduleNav')

const activeTab = ref('spreadsheet')
const selectedFile = ref(null)
const dragOver = ref(false)
const uploading = ref(false)
const uploadSuccess = ref(null)
const uploadError = ref(null)
const fileInput = ref(null)
const transcriptText = ref('')
const extracting = ref(false)
const googleDrive = useGoogleDrive()
const { pillars } = useComponentSelector()
const processingDriveFile = ref(false)
const transcriptPhase = ref('input')
const sharedData = ref({
  customerCompany: '',
  contactName: '',
  industryVertical: '',
  geo: '',
  customerType: 'Customer',
  environment: 'Unknown',
  toolsOfChoice: [],
  status: 'Discovery',
})
const componentInteractions = ref([])

// Check if AI features are available by checking for API key in env
const aiEnabled = ref(false)

onMounted(async () => {
  // Check if AI extraction is configured
  try {
    const response = await fetch('/api/modules/customer-insights/extract/health')
    aiEnabled.value = response.ok
  } catch {
    aiEnabled.value = false
  }
})

const tabs = computed(() => {
  const allTabs = [
    { id: 'spreadsheet', label: 'Spreadsheet Import' }
  ]

  // Only show Transcript Import if AI is configured
  if (aiEnabled.value) {
    allTabs.push({ id: 'transcript', label: 'Transcript Import' })
  }

  allTabs.push({ id: 'google-drive', label: 'Google Drive Import (Coming Soon)' })

  return allTabs
})

const canSubmitTranscript = computed(() => {
  return sharedData.value.customerCompany &&
         sharedData.value.contactName &&
         componentInteractions.value.length > 0 &&
         componentInteractions.value.every(c => c.component)
})

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file && file.name.endsWith('.csv')) {
    selectedFile.value = file
    uploadError.value = null
  } else {
    uploadError.value = 'Please select a CSV file'
  }
}

function handleDrop(event) {
  dragOver.value = false
  const file = event.dataTransfer.files[0]
  if (file && file.name.endsWith('.csv')) {
    selectedFile.value = file
    uploadError.value = null
  } else {
    uploadError.value = 'Please drop a CSV file'
  }
}

function clearFile() {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

async function uploadFile() {
  if (!selectedFile.value) return

  uploading.value = true
  uploadSuccess.value = null
  uploadError.value = null

  try {
    // Read the CSV file
    const text = await selectedFile.value.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows')
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    const interactions = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const interaction = {}

      headers.forEach((header, index) => {
        const key = header.toLowerCase()
          .replace(/\s+/g, '')
          .replace(/[^a-z0-9]/gi, '')

        let value = values[index]?.trim() || ''

        // Handle arrays (toolsOfChoice, futureWishlist)
        if (key === 'toolsofchoice' || key === 'futurewishlist') {
          value = value ? value.split(';').map(v => v.trim()).filter(v => v) : []
        }

        interaction[key] = value
      })

      interactions.push(interaction)
    }

    // Send to API
    const response = await fetch('/api/modules/customer-insights/interactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interactions,
        mode: 'create'
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json()
    uploadSuccess.value = `Successfully imported ${result.created || interactions.length} interactions!`
    clearFile()
  } catch (error) {
    console.error('Upload error:', error)
    uploadError.value = error.message
  } finally {
    uploading.value = false
  }
}

function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim().replace(/^"|"$/g, ''))
  return values
}

function clearTranscript() {
  transcriptText.value = ''
  transcriptPhase.value = 'input'
  sharedData.value = {
    customerCompany: '',
    contactName: '',
    industryVertical: '',
    geo: '',
    customerType: 'Customer',
    environment: 'Unknown',
    toolsOfChoice: [],
    status: 'Discovery',
  }
  componentInteractions.value = []
  uploadError.value = null
  uploadSuccess.value = null
}

async function autoExtract() {
  if (!transcriptText.value.trim()) return

  extracting.value = true
  uploadError.value = null

  try {
    const response = await fetch('/api/modules/customer-insights/extract/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: transcriptText.value
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to extract data')
    }

    const result = await response.json()

    sharedData.value = {
      customerCompany: result.shared?.customerCompany || '',
      contactName: result.shared?.contactName || '',
      industryVertical: result.shared?.industryVertical || '',
      geo: result.shared?.geo || '',
      customerType: result.shared?.customerType || 'Customer',
      environment: result.shared?.environment || 'Unknown',
      toolsOfChoice: result.shared?.toolsOfChoice || [],
      status: result.shared?.status || 'Discovery',
    }

    componentInteractions.value = (result.components || []).map(c => ({
      component: c.component || '',
      mainAIUseCase: c.mainAIUseCase || '',
      painPoints: c.painPoints || '',
      featureFeedback: c.featureFeedback || '',
      futureWishlist: c.futureWishlist || [],
      _expanded: true,
    }))

    if (componentInteractions.value.length === 0) {
      componentInteractions.value.push({
        component: '',
        mainAIUseCase: '',
        painPoints: '',
        featureFeedback: '',
        futureWishlist: [],
        _expanded: true,
      })
    }

    transcriptPhase.value = 'review'

    if (result._demoMode) {
      uploadError.value = 'Demo mode: Please review and edit the extracted fields manually'
    }
  } catch (error) {
    console.error('Auto-extract error:', error)
    uploadError.value = error.message
  } finally {
    extracting.value = false
  }
}

async function submitTranscript() {
  if (!canSubmitTranscript.value) return

  uploading.value = true
  uploadSuccess.value = null
  uploadError.value = null

  try {
    const interactions = componentInteractions.value.map(c => ({
      customerCompany: sharedData.value.customerCompany,
      contactName: sharedData.value.contactName,
      industryVertical: sharedData.value.industryVertical,
      geo: sharedData.value.geo,
      customerType: sharedData.value.customerType || 'Customer',
      environment: sharedData.value.environment || 'Unknown',
      toolsOfChoice: sharedData.value.toolsOfChoice || [],
      status: sharedData.value.status,
      fieldContactName: 'Field Team',
      component: c.component,
      mainAIUseCase: c.mainAIUseCase,
      painPoints: c.painPoints,
      featureFeedback: c.featureFeedback,
      futureWishlist: c.futureWishlist || [],
      meetingNotes: transcriptText.value || '',
      pmComments: '',
    }))

    const response = await fetch('/api/modules/customer-insights/interactions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interactions, mode: 'create' })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create interactions')
    }

    const result = await response.json()
    uploadSuccess.value = `Successfully created ${result.created} interaction${result.created !== 1 ? 's' : ''}!`
    clearTranscript()
  } catch (error) {
    console.error('Transcript submission error:', error)
    uploadError.value = error.message
  } finally {
    uploading.value = false
  }
}

function addComponentCard() {
  componentInteractions.value.push({
    component: '',
    mainAIUseCase: '',
    painPoints: '',
    featureFeedback: '',
    futureWishlist: [],
    _expanded: true,
  })
}

function removeComponentCard(index) {
  componentInteractions.value.splice(index, 1)
}

function toggleComponentCard(index) {
  componentInteractions.value[index]._expanded = !componentInteractions.value[index]._expanded
}

function getPillarName(componentId) {
  for (const pillar of pillars) {
    if (pillar.components.some(c => c.id === componentId)) {
      return pillar.name
    }
  }
  return ''
}

// Google Drive functions
async function connectGoogleDrive() {
  try {
    await googleDrive.connectGoogleDrive()
  } catch (error) {
    console.error('Failed to connect Google Drive:', error)
  }
}

async function disconnectGoogleDrive() {
  try {
    await googleDrive.disconnectGoogleDrive()
  } catch (error) {
    console.error('Failed to disconnect Google Drive:', error)
    uploadError.value = error.message
  }
}

async function pickGoogleDriveFile() {
  processingDriveFile.value = true
  uploadError.value = null
  uploadSuccess.value = null

  try {
    // Open Google Picker
    const file = await googleDrive.openFilePicker()

    // Download file content
    const fileData = await googleDrive.downloadFile(file.id)

    // Process based on file type
    if (fileData.mimeType.includes('spreadsheet') || fileData.mimeType.includes('csv')) {
      // Process as CSV
      await processCSVContent(fileData.content, fileData.name)
    } else if (fileData.mimeType.includes('document') || fileData.mimeType.includes('text')) {
      // Process as transcript
      transcriptText.value = fileData.content
      activeTab.value = 'transcript'
      uploadSuccess.value = `Loaded transcript from "${fileData.name}". Please review and extract details below.`
    } else {
      throw new Error(`Unsupported file type: ${fileData.mimeType}`)
    }
  } catch (error) {
    console.error('Error processing Google Drive file:', error)
    uploadError.value = error.message
  } finally {
    processingDriveFile.value = false
  }
}

async function processCSVContent(csvText, filename) {
  const lines = csvText.split('\n').filter(line => line.trim())

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  // Parse CSV (reuse existing logic)
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const interactions = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const interaction = {}

    headers.forEach((header, index) => {
      const key = header.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/gi, '')

      let value = values[index]?.trim() || ''

      // Handle arrays (toolsOfChoice, futureWishlist)
      if (key === 'toolsofchoice' || key === 'futurewishlist') {
        value = value ? value.split(';').map(v => v.trim()).filter(v => v) : []
      }

      interaction[key] = value
    })

    interactions.push(interaction)
  }

  // Send to API
  const response = await fetch('/api/modules/customer-insights/interactions/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interactions,
      mode: 'create'
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Upload failed')
  }

  const result = await response.json()
  uploadSuccess.value = `Successfully imported ${result.created || interactions.length} interactions from "${filename}"!`
}

function goToKanban() {
  if (moduleNav) {
    moduleNav.navigateTo('kanban')
  }
}

</script>
