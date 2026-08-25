import { defineAsyncComponent } from 'vue'

export const routes = {
  'overview': defineAsyncComponent(() => import('./views/OverviewView.vue')),
  'runs': defineAsyncComponent(() => import('./views/RunsView.vue')),
  'run-detail': defineAsyncComponent(() => import('./views/RunDetailView.vue')),
  'compare': defineAsyncComponent(() => import('./views/CompareView.vue')),
  'workflows': defineAsyncComponent(() => import('./views/WorkflowsView.vue')),
  'workflow-history': defineAsyncComponent(() => import('./views/WorkflowHistoryView.vue')),
  'activity': defineAsyncComponent(() => import('./views/ActivityView.vue'))
}
