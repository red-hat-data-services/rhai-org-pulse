import { defineAsyncComponent } from 'vue'

export const routes = {
  'kanban': defineAsyncComponent(() => import('./views/KanbanView.vue')),
  'table': defineAsyncComponent(() => import('./views/TableView.vue')),
  'dashboard': defineAsyncComponent(() => import('./views/DashboardView.vue')),
  'insights': defineAsyncComponent(() => import('./views/InsightsView.vue')),
  'roadmap': defineAsyncComponent(() => import('./views/RoadmapView.vue')),
  'rfe-creator': defineAsyncComponent(() => import('./views/RfeCreatorView.vue')),
  'import': defineAsyncComponent(() => import('./views/ImportView.vue')),
}

export { default as OnboardingModal } from './components/OnboardingModal.vue'
