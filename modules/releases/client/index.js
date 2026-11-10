import { defineAsyncComponent } from 'vue'

export const routes = {
  'registry': defineAsyncComponent(() => import('./views/RegistryView.vue')),
  'schedule': defineAsyncComponent(() => import('./views/ScheduleHubView.vue')),
  'plan': defineAsyncComponent(() => import('./views/PlanView.vue')),
  'execute': defineAsyncComponent(() => import('./views/ExecuteView.vue')),
  'feature-detail': defineAsyncComponent(() => import('./views/FeatureDetailView.vue')),
  // Stage 1b/1c previews -- unlisted (no navItem), reachable only via
  // #/releases/<id> for local QA. See AI-PLANNER-HANDOFF.md.
  'feature-scheduling-preview': defineAsyncComponent(() => import('./plan/views/FeatureSchedulingPreview.vue')),
  'roadmap-preview': defineAsyncComponent(() => import('./plan/views/RoadmapPreview.vue')),
  'executive-preview': defineAsyncComponent(() => import('./plan/views/ExecutivePreview.vue')),
  'deliver': defineAsyncComponent(() => import('./views/DeliverView.vue')),
  'reports': defineAsyncComponent(() => import('./views/ReportsView.vue')),
  'audit': defineAsyncComponent(() => import('./views/AuditView.vue')),
}
