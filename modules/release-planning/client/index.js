import { defineAsyncComponent } from 'vue'

export const routes = {
  'main': defineAsyncComponent(() => import('./views/DashboardView.vue')),
  'audit-log': defineAsyncComponent(() => import('./views/AuditLogView.vue')),
}
