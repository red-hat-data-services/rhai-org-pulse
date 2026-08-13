import { defineAsyncComponent } from 'vue'

export const routes = {
  'overview': defineAsyncComponent(() => import('./views/OverviewView.vue')),
  'runs': defineAsyncComponent(() => import('./views/RunsView.vue')),
  'run-detail': defineAsyncComponent(() => import('./views/RunDetailView.vue')),
  'bugs': defineAsyncComponent(() => import('./views/BugsView.vue'))
}
