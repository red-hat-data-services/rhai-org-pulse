import { defineAsyncComponent } from 'vue'

export const routes = {
  'quality-analysis': defineAsyncComponent(() => import('./views/QualityAnalysisView.vue'))
}
