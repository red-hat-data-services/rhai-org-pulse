import { defineAsyncComponent } from 'vue'

export const routes = {
  'main': defineAsyncComponent(() => import('./views/DashboardView.vue')),
  'health': defineAsyncComponent(() => import('./views/HealthDashboardView.vue')),
  'audit-log': defineAsyncComponent(() => import('./views/AuditLogView.vue')),
}
