<template>
  <div class="space-y-6">
    <!-- Header with back button when drilled in -->
    <div class="flex items-center gap-3">
      <button
        v-if="activeReport"
        @click="activeReport = null"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
      >
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" /></svg>
        All Reports
      </button>
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">
          {{ activeReport ? activeReportDef.title : 'Reports' }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ activeReport ? activeReportDef.description : 'OKR analytics and reporting dashboards.' }}
        </p>
      </div>
    </div>

    <!-- Flash Cards Grid -->
    <div v-if="!activeReport" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-for="report in reports"
        :key="report.id"
        @click="activeReport = report.id"
        class="group text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            :class="report.iconBg"
          >{{ report.icon }}</div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{{ report.title }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{{ report.description }}</div>
          </div>
          <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 dark:group-hover:text-primary-400 transition-colors mt-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" /></svg>
        </div>
        <div v-if="report.measure" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <span class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Measure of Success</span>
          <span class="ml-2 text-xs font-bold" :class="report.measureColor">{{ report.measure }}</span>
        </div>
      </button>
    </div>

    <!-- Active Report Detail -->
    <OnTimeReleasesReport v-if="activeReport === 'on-time-releases'" />
    <CveSlaReport v-if="activeReport === 'cve-sla'" />
    <PostReleaseDefectsReport v-if="activeReport === 'post-release-defects'" />
    <CommitmentTrackingReport v-if="activeReport === 'commitment-tracking'" />
    <TechVisibilityReport v-if="activeReport === 'tech-visibility'" />
    <SupportCaseReport v-if="activeReport === 'support-cases'" />
    <FeatureDeliveryReport v-if="activeReport === 'feature-delivery'" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import OnTimeReleasesReport from '../components/OnTimeReleasesReport.vue'
import CveSlaReport from '../components/CveSlaReport.vue'
import PostReleaseDefectsReport from '../components/post-release-defects/PostReleaseDefectsReport.vue'
import CommitmentTrackingReport from '../components/commitment-tracking/CommitmentTrackingReport.vue'
import TechVisibilityReport from '../components/TechVisibilityReport.vue'
import SupportCaseReport from '../components/SupportCaseReport.vue'
import FeatureDeliveryReport from '../components/FeatureDeliveryReport.vue'

var activeReport = ref(null)

onMounted(function() {
  var hash = window.location.hash || ''
  var qIdx = hash.indexOf('?')
  if (qIdx === -1) return
  var qs = hash.substring(qIdx + 1)
  var params = new URLSearchParams(qs)
  var reportId = params.get('report')
  if (reportId) {
    for (var i = 0; i < reports.length; i++) {
      if (reports[i].id === reportId) { activeReport.value = reportId; break }
    }
  }
})

var reports = [
  {
    id: 'on-time-releases',
    title: 'On Time Releases',
    description: 'Did we hit the planned GA date? Tracks all point and major RHAI releases GA\'d after April 1, 2026.',
    icon: '🚀',
    iconBg: 'bg-blue-50 dark:bg-blue-900/30',
    measure: 'Number of Releases On Time - 100%',
    measureColor: 'text-gray-600 dark:text-gray-300'
  },
  {
    id: 'cve-sla',
    title: 'CVE SLA Compliance',
    description: 'Number of escalations & on-time responses. Tracks CVE met vs missed across all products per quarter.',
    icon: '🛡️',
    iconBg: 'bg-purple-50 dark:bg-purple-900/30',
    measure: 'Number of Escalations and On Time Response - 100%',
    measureColor: 'text-gray-600 dark:text-gray-300'
  },
  {
    id: 'post-release-defects',
    title: 'Post-Release Defects',
    description: 'Cumulative bug trends across releases. Compare defect rates by version, product, and component.',
    icon: '🐛',
    iconBg: 'bg-red-50 dark:bg-red-900/30',
    measure: '90% reduction in bugs (Functional, UX, Regressions) discovered post-release by the field',
    measureColor: 'text-gray-600 dark:text-gray-300'
  },
  {
    id: 'commitment-tracking',
    title: 'Commitment Tracking',
    description: 'Track committed vs. delivered features per release phase. Monitor >90% delivery OKR.',
    icon: '🎯',
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/30',
    measure: '>90% of planned features for a release are delivered in the target release',
    measureColor: 'text-gray-600 dark:text-gray-300'
  },
  {
    id: 'tech-visibility',
    title: 'Technical Visibility',
    description: 'Red Hat AI technical visibility across internal and external sources. Tracks weekly article output.',
    icon: '📝',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
    measure: 'KR1: >5 posts/week | KR2: 1 piece of content from each AI Eng associate',
    measureColor: 'text-gray-600 dark:text-gray-300'
  },
  {
    id: 'support-cases',
    title: 'Support Case Time To Resolution',
    description: 'Track defect rates and resolution times across products. Monitor support case closure efficiency per quarter.',
    icon: '🔧',
    iconBg: 'bg-orange-50 dark:bg-orange-900/30',
    measure: 'Defect Rate for Product: 10% | Time to Resolution Target: 10-14 days',
    measureColor: 'text-gray-600 dark:text-gray-300'
  },
  {
    id: 'feature-delivery',
    title: 'Feature Delivery Accuracy',
    description: 'Committed vs delivered features per release. Compares Target Version (before freeze) to Fix Version at release.',
    icon: '📊',
    iconBg: 'bg-indigo-50 dark:bg-indigo-900/30',
    measure: '>90% of committed features delivered per release',
    measureColor: 'text-gray-600 dark:text-gray-300'
  }
]

var activeReportDef = computed(function() {
  if (!activeReport.value) return {}
  for (var i = 0; i < reports.length; i++) {
    if (reports[i].id === activeReport.value) return reports[i]
  }
  return {}
})
</script>
