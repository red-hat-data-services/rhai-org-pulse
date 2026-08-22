import { defineAsyncComponent } from 'vue'

export const routes = {
  'quality-analysis': defineAsyncComponent(() => import('./views/QualityAnalysisView.vue')),
  'component-maturity': defineAsyncComponent(() => import('./views/ComponentMaturityView.vue')),
  'disconnected-repo-detail': defineAsyncComponent(() => import('./views/DisconnectedRepoDetailView.vue')),
  'odh-e2e-health': defineAsyncComponent(() => import('./views/OdhOperatorE2eHealthView.vue')),
  'e2e-run-detail': defineAsyncComponent(() => import('./views/E2eRunDetailView.vue'))
}
