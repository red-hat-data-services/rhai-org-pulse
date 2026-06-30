import { defineAsyncComponent } from 'vue'

export const routes = {
  'timeline': defineAsyncComponent(() => import('./views/TimelineView.vue')),
  'deep-dive': defineAsyncComponent(() => import('./views/DeepDiveView.vue')),
  'reports': defineAsyncComponent(() => import('./views/ReportsView.vue')),
}
