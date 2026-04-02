import { defineAsyncComponent } from 'vue'

export const routes = {
  'overview': defineAsyncComponent(() => import('./views/OverviewView.vue')),
  'feature-detail': defineAsyncComponent(() => import('./views/FeatureDetailView.vue')),
}
