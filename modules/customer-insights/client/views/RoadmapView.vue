<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Product Roadmap</h1>
          <p class="text-gray-600 mt-1">Customer-driven initiatives and feature development</p>
        </div>
        <InfoTooltip text="AI-generated product roadmap recommendations based on customer feedback. Shows initiatives with ARR impact, deliverables, and quick actions to create RFEs. Click 'Generate Roadmap' to analyze and prioritize customer requests." />
      </div>

      <div class="flex gap-3 items-center">
        <!-- Component Selector -->
        <select
          v-model="selectedComponent"
          class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option v-for="c in components" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>

        <!-- Generate Roadmap Button -->
        <button
          @click="generateRoadmap"
          :disabled="generating"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="generating" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ generating ? 'Generating...' : 'Generate Roadmap with AI' }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="text-gray-500">Loading roadmap...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">Error loading roadmap: {{ error }}</p>
    </div>

    <!-- Roadmap Content -->
    <div v-else-if="roadmap" class="space-y-6">
      <!-- Summary Stats -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600 mb-1">Total Initiatives</div>
          <div class="text-2xl font-bold text-gray-900">{{ roadmap.summary.total }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600 mb-1">In Progress</div>
          <div class="text-2xl font-bold text-blue-600">{{ roadmap.summary.inProgress }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600 mb-1">Completed</div>
          <div class="text-2xl font-bold text-green-600">{{ roadmap.summary.completed }}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-4">
          <div class="text-sm text-gray-600 mb-1">Customer Impact</div>
          <div class="text-2xl font-bold text-purple-600">{{ roadmap.summary.customersImpacted }}</div>
        </div>
      </div>

      <!-- Timeline View -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center gap-2 mb-6">
          <Calendar class="w-6 h-6 text-blue-600" />
          <h2 class="text-xl font-semibold text-gray-900">Timeline</h2>
        </div>

        <div class="space-y-8">
          <!-- Now -->
          <div v-if="itemsByTimeframe.now.length">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0 w-24 text-sm font-semibold text-gray-900">Now</div>
              <div class="flex-grow border-t border-gray-300"></div>
            </div>
            <div class="ml-24 space-y-3">
              <RoadmapCard
                v-for="item in itemsByTimeframe.now"
                :key="item.id"
                :item="item"
                @click="selectedItem = item"
              />
            </div>
          </div>

          <!-- Next -->
          <div v-if="itemsByTimeframe.next.length">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0 w-24 text-sm font-semibold text-gray-900">Next</div>
              <div class="flex-grow border-t border-gray-300"></div>
            </div>
            <div class="ml-24 space-y-3">
              <RoadmapCard
                v-for="item in itemsByTimeframe.next"
                :key="item.id"
                :item="item"
                @click="selectedItem = item"
              />
            </div>
          </div>

          <!-- Later -->
          <div v-if="itemsByTimeframe.later.length">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0 w-24 text-sm font-semibold text-gray-900">Later</div>
              <div class="flex-grow border-t border-gray-300"></div>
            </div>
            <div class="ml-24 space-y-3">
              <RoadmapCard
                v-for="item in itemsByTimeframe.later"
                :key="item.id"
                :item="item"
                @click="selectedItem = item"
              />
            </div>
          </div>

          <!-- Future -->
          <div v-if="itemsByTimeframe.future.length">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0 w-24 text-sm font-semibold text-gray-900">Future</div>
              <div class="flex-grow border-t border-gray-300"></div>
            </div>
            <div class="ml-24 space-y-3">
              <RoadmapCard
                v-for="item in itemsByTimeframe.future"
                :key="item.id"
                :item="item"
                @click="selectedItem = item"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- AI Recommendations -->
      <div v-if="roadmap.aiRecommendations" class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 border border-purple-200">
        <div class="flex items-center gap-2 mb-6">
          <Sparkles class="w-6 h-6 text-purple-600" />
          <h2 class="text-xl font-semibold text-gray-900">AI Recommended Actions</h2>
          <span class="ml-auto text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">Powered by Gemini AI</span>
        </div>

        <!-- Quick Actions -->
        <div v-if="roadmap.aiRecommendations.quickActions?.length" class="mb-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap class="w-5 h-5 text-yellow-600" />
            Quick Wins - Improve Existing RFEs
          </h3>
          <div class="space-y-3">
            <div
              v-for="action in roadmap.aiRecommendations.quickActions"
              :key="action.id"
              class="bg-white rounded-lg p-4 border border-purple-200 hover:border-purple-400 transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{{ action.rfeKey }}</span>
                    <h4 class="font-medium text-gray-900">{{ action.title }}</h4>
                  </div>
                  <p class="text-sm text-gray-600 mb-3">{{ action.description }}</p>
                  <div v-if="action.suggestedChanges" class="text-xs text-gray-500 space-y-1">
                    <div v-if="action.suggestedChanges.priority">
                      <span class="font-medium">Priority:</span> → {{ action.suggestedChanges.priority }}
                    </div>
                    <div v-if="action.suggestedChanges.labels">
                      <span class="font-medium">Add labels:</span> {{ action.suggestedChanges.labels.join(', ') }}
                    </div>
                  </div>
                </div>
                <button
                  @click="executeAction(action.id)"
                  :disabled="executingAction === action.id"
                  class="ml-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                >
                  {{ executingAction === action.id ? 'Updating...' : 'Apply Now' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Suggested RFEs -->
        <div v-if="roadmap.aiRecommendations.suggestedRFEs?.length">
          <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Lightbulb class="w-5 h-5 text-yellow-500" />
            Suggested New RFEs - Ready to Submit
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="suggestion in roadmap.aiRecommendations.suggestedRFEs"
              :key="suggestion.id"
              class="bg-white rounded-lg p-4 border border-purple-200 hover:border-purple-400 transition-all hover:shadow-md cursor-pointer"
              @click="createFromSuggestion(suggestion)"
            >
              <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-gray-900 flex-1">{{ suggestion.title }}</h4>
                <span :class="priorityBadgeClass(suggestion.priority)">{{ suggestion.priority }}</span>
              </div>
              <p class="text-sm text-gray-600 mb-3 line-clamp-2">{{ suggestion.businessJustification }}</p>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <div class="flex items-center gap-2">
                  <Users class="w-3 h-3" />
                  <span>{{ suggestion.sourceCustomers?.length || 0 }} customers</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="bg-gray-100 px-2 py-0.5 rounded">{{ suggestion.component }}</span>
                  <span class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{{ suggestion.estimatedEffort }}</span>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-gray-100">
                <button class="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
                  <span>Click to auto-fill RFE form</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Customer Feedback Alignment -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center gap-2 mb-4">
          <Users class="w-6 h-6 text-purple-600" />
          <h2 class="text-xl font-semibold text-gray-900">Top Customer Requests</h2>
        </div>
        <div class="space-y-3">
          <div
            v-for="request in roadmap.topRequests"
            :key="request.feature"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div class="flex-1">
              <div class="font-medium text-gray-900">{{ request.feature }}</div>
              <div class="text-sm text-gray-600 mt-1">{{ request.customerCount }} customers requesting</div>
            </div>
            <div class="flex items-center gap-2">
              <span
                v-if="request.roadmapStatus"
                :class="statusBadgeClass(request.roadmapStatus)"
              >
                {{ request.roadmapStatus }}
              </span>
              <span v-else class="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                Not Planned
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- AI-Powered Roadmap Recommendations -->
      <div v-if="roadmap.recommendations" class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg shadow-lg p-6 border border-purple-200">
        <div class="flex items-center gap-2 mb-4">
          <Sparkles class="w-6 h-6 text-purple-600" />
          <h2 class="text-xl font-semibold text-gray-900">AI-Powered Roadmap Recommendations</h2>
        </div>

        <p class="text-sm text-gray-700 mb-6">
          Based on analysis of {{ roadmap.recommendations.analysisMetadata?.totalInteractions || 0 }} customer interactions,
          {{ roadmap.recommendations.analysisMetadata?.totalRfes || 0 }} RFEs, and
          {{ roadmap.recommendations.analysisMetadata?.totalCustomers || 0 }} unique customers.
        </p>

        <!-- Priority Adjustments -->
        <div v-if="roadmap.recommendations.priorityAdjustments?.length" class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <TrendingUp class="w-5 h-5 text-orange-600" />
              <h3 class="text-lg font-semibold text-gray-900">
                Priority Adjustments Recommended
              </h3>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="appliedAdjustments.length > 0" class="text-sm text-green-600">
                {{ appliedAdjustments.length }} of {{ roadmap.recommendations.priorityAdjustments.length }} applied
              </span>
              <button
                @click="applyAllPriorityAdjustments"
                :disabled="appliedAdjustments.length === roadmap.recommendations.priorityAdjustments.length"
                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {{ appliedAdjustments.length === roadmap.recommendations.priorityAdjustments.length ? 'All Applied' : 'Apply All Adjustments' }}
              </button>
            </div>
          </div>
          <div class="space-y-3">
            <div
              v-for="adjustment in roadmap.recommendations.priorityAdjustments"
              :key="adjustment.initiativeId"
              class="bg-white rounded-lg p-4 border-l-4"
              :class="{
                'border-red-500': adjustment.recommendedPriority === 'Critical',
                'border-orange-500': adjustment.recommendedPriority === 'High',
                'border-yellow-500': adjustment.recommendedPriority === 'Medium',
              }"
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <div class="font-semibold text-gray-900">{{ adjustment.initiativeTitle }}</div>
                    <span v-if="appliedAdjustments.includes(adjustment.initiativeId)" class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      ✓ Applied
                    </span>
                  </div>
                  <div class="text-sm text-gray-600 mt-1">{{ adjustment.reason }}</div>
                </div>
                <div class="flex items-center gap-2 ml-4">
                  <span :class="priorityBadgeClass(adjustment.currentPriority)">
                    {{ adjustment.currentPriority }}
                  </span>
                  <span class="text-gray-400">→</span>
                  <span :class="priorityBadgeClass(adjustment.recommendedPriority)">
                    {{ adjustment.recommendedPriority }}
                  </span>
                  <button
                    v-if="!appliedAdjustments.includes(adjustment.initiativeId)"
                    @click="applyPriorityAdjustment(adjustment)"
                    class="ml-2 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                    title="Apply this priority adjustment"
                  >
                    Apply
                  </button>
                </div>
              </div>
              <div class="flex items-center gap-4 text-xs text-gray-600">
                <span>{{ adjustment.customerDemand }} customers</span>
                <span>${{ formatNumber(adjustment.arrImpact) }} ARR</span>
                <span v-if="adjustment.competitiveThreat" class="text-red-600">Competitive threat</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Coverage Gaps -->
        <div v-if="roadmap.recommendations.coverageGaps?.length" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <Target class="w-5 h-5 text-red-600" />
            <h3 class="text-lg font-semibold text-gray-900">
              Coverage Gaps
            </h3>
          </div>
          <div class="bg-white rounded-lg p-4">
            <ul class="space-y-2">
              <li
                v-for="gap in roadmap.recommendations.coverageGaps"
                :key="gap.area"
                class="flex items-start"
              >
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                  !
                </span>
                <div class="flex-1">
                  <div class="font-medium text-gray-900">{{ gap.area }}</div>
                  <div class="text-sm text-gray-600">{{ gap.description }}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ gap.affectedCustomers }} customers affected • {{ gap.painPointMentions }} pain point mentions
                  </div>
                </div>
                <button
                  @click="createRfeFromRecommendation(gap)"
                  class="flex-shrink-0 ml-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  title="Create RFE from this recommendation"
                >
                  Create RFE
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- Quick Wins -->
        <div v-if="roadmap.recommendations.quickWins?.length" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <Zap class="w-5 h-5 text-green-600" />
            <h3 class="text-lg font-semibold text-gray-900">
              Quick Wins
            </h3>
          </div>
          <div class="bg-white rounded-lg p-4">
            <div class="space-y-3">
              <div
                v-for="win in roadmap.recommendations.quickWins"
                :key="win.suggestion"
                class="flex items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0"
              >
                <span class="text-green-500 mr-2 font-bold">•</span>
                <div class="flex-1">
                  <div class="font-medium text-gray-900">{{ win.suggestion }}</div>
                  <div class="text-sm text-gray-600 mt-1">{{ win.rationale }}</div>
                  <div class="flex items-center gap-3 mt-2 text-xs">
                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded">
                      {{ win.effort }} effort
                    </span>
                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {{ win.impact }} impact
                    </span>
                    <span class="text-gray-500">{{ win.customerBenefit }}</span>
                  </div>
                </div>
                <button
                  @click="createRfeFromRecommendation(win)"
                  class="flex-shrink-0 ml-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  title="Create RFE from this recommendation"
                >
                  Create RFE
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Strategic Themes -->
        <div v-if="roadmap.recommendations.strategicThemes?.length" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <Lightbulb class="w-5 h-5 text-yellow-600" />
            <h3 class="text-lg font-semibold text-gray-900">
              Strategic Themes Emerging
            </h3>
          </div>
          <div class="bg-white rounded-lg p-4">
            <div class="space-y-3">
              <div
                v-for="theme in roadmap.recommendations.strategicThemes"
                :key="theme.theme"
                class="border-l-4 border-purple-500 pl-4"
              >
                <div class="font-semibold text-gray-900">{{ theme.theme }}</div>
                <div class="text-sm text-gray-600 mt-1">{{ theme.insight }}</div>
                <div class="flex flex-wrap gap-2 mt-2">
                  <span
                    v-for="initiative in theme.relatedInitiatives"
                    :key="initiative"
                    class="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded"
                  >
                    {{ initiative }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Risk Factors -->
        <div v-if="roadmap.recommendations.riskFactors?.length" class="mb-6">
          <div class="flex items-center gap-2 mb-3">
            <AlertTriangle class="w-5 h-5 text-red-600" />
            <h3 class="text-lg font-semibold text-gray-900">
              Risk Factors
            </h3>
          </div>
          <div class="bg-white rounded-lg p-4">
            <ul class="space-y-2">
              <li
                v-for="risk in roadmap.recommendations.riskFactors"
                :key="risk.risk"
                class="flex items-start"
              >
                <span class="text-red-500 mr-2 mt-1 font-bold">!</span>
                <div class="flex-1">
                  <div class="font-medium text-gray-900">{{ risk.risk }}</div>
                  <div class="text-sm text-gray-600">{{ risk.mitigation }}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    Impact: {{ risk.impact }} • Probability: {{ risk.probability }}
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Summary Action Items -->
        <div class="bg-white rounded-lg p-4 border-2 border-purple-300">
          <div class="flex items-center gap-2 mb-2">
            <ListChecks class="w-5 h-5 text-purple-600" />
            <h4 class="font-semibold text-gray-900">Recommended Actions</h4>
          </div>
          <ol class="list-decimal list-inside space-y-1 text-sm text-gray-700">
            <li v-for="action in roadmap.recommendations.actionItems" :key="action">
              {{ action }}
            </li>
          </ol>
        </div>

        <div class="mt-4 text-xs text-gray-500 text-center">
          Last updated: {{ formatDate(roadmap.recommendations.generatedAt) }}
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div v-else class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-gray-500 mb-4">
        <Lightbulb class="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <p class="font-medium text-lg mb-2">No Roadmap Generated Yet</p>
        <p class="text-sm mb-6">Click "Generate Roadmap with AI" above to analyze customer interactions and Jira RFEs to create strategic product recommendations.</p>
      </div>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="selectedItem"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="selectedItem = null"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div class="flex justify-between items-start mb-4">
          <div class="flex-1">
            <h2 class="text-xl font-bold text-gray-900">{{ selectedItem.title }}</h2>
            <div class="flex items-center gap-2 mt-2">
              <span :class="statusBadgeClass(selectedItem.status)">
                {{ selectedItem.status }}
              </span>
              <span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {{ selectedItem.timeframe }}
              </span>
              <span
                v-if="selectedItem.priority"
                :class="priorityBadgeClass(selectedItem.priority)"
              >
                {{ selectedItem.priority }} Priority
              </span>
            </div>
          </div>
          <button @click="selectedItem = null" class="text-gray-400 hover:text-gray-600 text-2xl ml-4">
            ×
          </button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <p class="text-sm text-gray-900">{{ selectedItem.description }}</p>
          </div>

          <div v-if="selectedItem.customerDemand" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Requesting Customers</label>
              <p class="text-2xl font-bold text-gray-900">{{ selectedItem.customerDemand.requestingCustomers }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Total ARR Impact</label>
              <p class="text-2xl font-bold text-green-600">${{ formatNumber(selectedItem.customerDemand.totalARR) }}</p>
            </div>
          </div>

          <div v-if="selectedItem.customerDemand?.keyAccounts?.length">
            <label class="block text-sm font-medium text-gray-700 mb-2">Key Accounts Requesting</label>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="account in selectedItem.customerDemand.keyAccounts"
                :key="account"
                class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
              >
                {{ account }}
              </span>
            </div>
          </div>

          <div v-if="selectedItem.painPoints?.length">
            <label class="block text-sm font-medium text-gray-700 mb-2">Addresses Pain Points</label>
            <ul class="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li v-for="pain in selectedItem.painPoints" :key="pain">{{ pain }}</li>
            </ul>
          </div>

          <div v-if="selectedItem.dependencies?.length">
            <label class="block text-sm font-medium text-gray-700 mb-2">Dependencies</label>
            <ul class="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li v-for="dep in selectedItem.dependencies" :key="dep">{{ dep }}</li>
            </ul>
          </div>

          <div v-if="selectedItem.deliverables?.length">
            <label class="block text-sm font-medium text-gray-700 mb-2">Key Deliverables</label>
            <ul class="space-y-2">
              <li
                v-for="deliverable in selectedItem.deliverables"
                :key="deliverable.item"
                class="flex items-start"
              >
                <span
                  class="flex-shrink-0 mr-2 mt-0.5"
                  :class="deliverable.completed ? 'text-green-600' : 'text-gray-400'"
                >
                  {{ deliverable.completed ? '✓' : '○' }}
                </span>
                <span
                  class="text-sm"
                  :class="deliverable.completed ? 'text-gray-500 line-through' : 'text-gray-900'"
                >
                  {{ deliverable.item }}
                </span>
              </li>
            </ul>
          </div>

          <div v-if="selectedItem.jiraEpic">
            <label class="block text-sm font-medium text-gray-700 mb-1">Jira Epic</label>
            <a
              :href="selectedItem.jiraEpic.url"
              target="_blank"
              class="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {{ selectedItem.jiraEpic.key }}: {{ selectedItem.jiraEpic.summary }}
            </a>
          </div>

          <div v-if="selectedItem.owner" class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <p class="text-sm text-gray-900">{{ selectedItem.owner.name }}</p>
              <p class="text-xs text-gray-600">{{ selectedItem.owner.role }}</p>
            </div>
            <div v-if="selectedItem.targetQuarter">
              <label class="block text-sm font-medium text-gray-700 mb-1">Target</label>
              <p class="text-sm text-gray-900">{{ selectedItem.targetQuarter }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useComponentSelector } from '../composables/useComponentSelector'
import { useRoadmap } from '../composables/useRoadmap'
import RoadmapCard from '../components/RoadmapCard.vue'
import { Calendar, Users, Sparkles, TrendingUp, Target, Zap, Lightbulb, AlertTriangle, ListChecks } from 'lucide-vue-next'

const { components, selectedComponent } = useComponentSelector()
const { roadmap, loading, error, refresh } = useRoadmap(selectedComponent)
const moduleNav = inject('moduleNav')

const selectedItem = ref(null)
const appliedAdjustments = ref([])
const generating = ref(false)
const executingAction = ref(null)

async function generateRoadmap() {
  generating.value = true
  try {
    const response = await fetch('/api/modules/customer-insights/roadmap/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ component: selectedComponent.value })
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.error || `HTTP ${response.status}`)
    }

    // Refresh the roadmap display
    await refresh()
  } catch (err) {
    alert(`Failed to generate roadmap: ${err.message}`)
  } finally {
    generating.value = false
  }
}

async function executeAction(actionId) {
  if (!confirm('Execute this action? This will update the Jira RFE.')) {
    return
  }

  executingAction.value = actionId
  try {
    const response = await fetch('/api/modules/customer-insights/roadmap/execute-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId })
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    alert(result.message || 'Action executed successfully!')

    // Refresh to remove the completed action
    await refresh()
  } catch (err) {
    alert(`Failed to execute action: ${err.message}`)
  } finally {
    executingAction.value = null
  }
}

function createFromSuggestion(suggestion) {
  // Store the suggestion data for the RFE creator
  sessionStorage.setItem('rfe-prefill', JSON.stringify(suggestion))

  // Navigate to RFE creator
  if (moduleNav) {
    moduleNav.navigateTo('rfe-creator')
  }
}

const itemsByTimeframe = computed(() => {
  if (!roadmap.value?.items) {
    return { now: [], next: [], later: [], future: [] }
  }

  return {
    now: roadmap.value.items.filter(i => i.timeframe === 'Now'),
    next: roadmap.value.items.filter(i => i.timeframe === 'Next'),
    later: roadmap.value.items.filter(i => i.timeframe === 'Later'),
    future: roadmap.value.items.filter(i => i.timeframe === 'Future'),
  }
})

function statusBadgeClass(status) {
  const classes = {
    'Not Started': 'text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded',
    'In Progress': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'In Review': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'Completed': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'On Hold': 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded',
  }
  return classes[status] || classes['Not Started']
}

function priorityBadgeClass(priority) {
  const classes = {
    'High': 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded',
    'Medium': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'Low': 'text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded',
  }
  return classes[priority] || classes['Medium']
}

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function createRfeFromRecommendation(recommendation) {
  // Build comprehensive RFE data from recommendation
  const params = {
    prefill: 'recommendation',
    title: recommendation.suggestion || recommendation.area || '',
    component: selectedComponent.value !== 'all' ? selectedComponent.value : '',
  }

  // Business justification from rationale/description + customer benefit
  let businessJustification = recommendation.rationale || recommendation.description || ''
  if (recommendation.customerBenefit) {
    businessJustification += `\n\nCustomer Benefit: ${recommendation.customerBenefit}`
  }
  if (recommendation.affectedCustomers) {
    businessJustification += `\n\nAffected Customers: ${recommendation.affectedCustomers} customer organizations`
  }
  if (recommendation.customerDemand) {
    businessJustification += `\n\nCustomer Demand: ${recommendation.customerDemand} requesting customers`
  }
  if (recommendation.arrImpact) {
    businessJustification += `\n\nARR Impact: $${recommendation.arrImpact.toLocaleString()}`
  }
  params.businessJustification = businessJustification

  // Technical details based on type of recommendation
  let technicalDetails = ''
  if (recommendation.effort) {
    technicalDetails += `Estimated Effort: ${recommendation.effort}\n`
  }
  if (recommendation.impact) {
    technicalDetails += `Expected Impact: ${recommendation.impact}\n`
  }
  if (recommendation.reason) {
    technicalDetails += `\nBackground: ${recommendation.reason}`
  }
  params.technicalDetails = technicalDetails || 'To be defined during RFE refinement'

  // Use cases from customer benefit or affected customers
  if (recommendation.customerBenefit || recommendation.affectedCustomers) {
    params.useCases = recommendation.customerBenefit || `Addresses needs of ${recommendation.affectedCustomers} customer organizations`
  }

  // Acceptance criteria based on impact and customer benefit
  // eslint-disable-next-line no-useless-assignment -- false positive, value is used on line 648
  let acceptanceCriteria = ''
  if (recommendation.impact === 'High') {
    acceptanceCriteria = '- Feature delivers measurable improvement to customer workflows\n- Documentation is complete and validated by field teams\n- Successfully deployed to at least 3 customer environments'
  } else if (recommendation.impact === 'Medium') {
    acceptanceCriteria = '- Feature meets requirements outlined in this RFE\n- Documentation is complete\n- Successfully tested in staging environment'
  } else {
    acceptanceCriteria = '- Feature works as described\n- Basic documentation is available'
  }
  params.acceptanceCriteria = acceptanceCriteria

  // Success metrics
  let successMetrics = ''
  if (recommendation.customerDemand) {
    successMetrics += `- Adoption by at least ${Math.ceil(recommendation.customerDemand * 0.7)} of the ${recommendation.customerDemand} requesting customers\n`
  }
  if (recommendation.affectedCustomers) {
    successMetrics += `- Positive feedback from ${recommendation.affectedCustomers} affected customer organizations\n`
  }
  if (recommendation.arrImpact) {
    successMetrics += `- ARR impact target: $${recommendation.arrImpact.toLocaleString()}\n`
  }
  successMetrics += '- Customer satisfaction score improvement\n- Reduction in support tickets related to this area'
  params.successMetrics = successMetrics

  // Complexity from effort
  if (recommendation.effort === 'Low') {
    params.complexity = 'Low'
  } else if (recommendation.effort === 'Medium') {
    params.complexity = 'Medium'
  } else if (recommendation.effort === 'High') {
    params.complexity = 'High'
  } else {
    params.complexity = 'Medium'
  }

  // Estimated effort in story points
  if (recommendation.effort === 'Low') {
    params.estimatedEffort = '5'
  } else if (recommendation.effort === 'Medium') {
    params.estimatedEffort = '13'
  } else if (recommendation.effort === 'High') {
    params.estimatedEffort = '21'
  }

  // Priority
  if (recommendation.recommendedPriority) {
    params.priority = recommendation.recommendedPriority
  } else if (recommendation.priority) {
    params.priority = recommendation.priority
  } else if (recommendation.impact === 'High') {
    params.priority = 'High'
  } else if (recommendation.impact === 'Medium') {
    params.priority = 'Medium'
  } else {
    params.priority = 'Low'
  }

  // ARR Impact
  if (recommendation.arrImpact) {
    params.arrImpact = recommendation.arrImpact.toString()
  }

  // Requested by
  params.requestedBy = 'Product Team (AI Roadmap Analysis)'

  // Navigate to RFE creator with comprehensive pre-filled data
  moduleNav.navigateTo('rfe-creator', params)
}

function applyPriorityAdjustment(adjustment) {
  // Find the initiative in the roadmap
  const initiative = roadmap.value.items.find(item => item.id === adjustment.initiativeId)

  if (initiative) {
    // Update the priority
    initiative.priority = adjustment.recommendedPriority

    // Mark as applied
    if (!appliedAdjustments.value.includes(adjustment.initiativeId)) {
      appliedAdjustments.value.push(adjustment.initiativeId)
    }

    console.log(`Applied priority adjustment: ${adjustment.initiativeTitle} → ${adjustment.recommendedPriority}`)
  }
}

function applyAllPriorityAdjustments() {
  if (!roadmap.value?.recommendations?.priorityAdjustments) return

  roadmap.value.recommendations.priorityAdjustments.forEach(adjustment => {
    if (!appliedAdjustments.value.includes(adjustment.initiativeId)) {
      applyPriorityAdjustment(adjustment)
    }
  })
}
</script>

<style scoped>
/* Component for roadmap cards */
</style>
