import { defineAsyncComponent } from 'vue'

export const routes = {
  'board': defineAsyncComponent(() => import('./views/Board.vue')),
  'candidate-detail': defineAsyncComponent(() => import('./views/CandidateDetail.vue')),
  'report': defineAsyncComponent(() => import('./views/ReportView.vue')),
  'catalog': defineAsyncComponent(() => import('./views/CatalogView.vue')),
  'showcase-detail': defineAsyncComponent(() => import('./views/ShowcaseDetailView.vue')),
}
