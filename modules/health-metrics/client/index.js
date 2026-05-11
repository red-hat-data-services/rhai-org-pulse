import { defineAsyncComponent } from 'vue'

export const routes = {
  'dashboard': defineAsyncComponent(() => import('./views/DashboardView.vue')),
  'page-detail': defineAsyncComponent(() => import('./views/PageDetailView.vue')),
}
