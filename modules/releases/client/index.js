import { defineAsyncComponent } from 'vue'

export const routes = {
  'registry': defineAsyncComponent(() => import('./views/RegistryView.vue')),
  'plan': defineAsyncComponent(() => import('./views/PlanView.vue')),
  'execute': defineAsyncComponent(() => import('./views/ExecuteView.vue')),
  'feature-detail': defineAsyncComponent(() => import('./views/FeatureDetailView.vue')),
  'deliver': defineAsyncComponent(() => import('./views/DeliverView.vue')),
  'reports': defineAsyncComponent(() => import('./views/ReportsView.vue')),
  'audit': defineAsyncComponent(() => import('./views/AuditView.vue')),
}
