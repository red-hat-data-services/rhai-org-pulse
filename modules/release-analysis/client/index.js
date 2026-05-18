import { defineAsyncComponent } from 'vue'

export const routes = {
  'main': defineAsyncComponent(() => import('./views/MainView.vue')),
  'project-breakdown': defineAsyncComponent(() => import('./views/ProjectBreakdownView.vue')),
  'conforma-exceptions': defineAsyncComponent(() => import('./views/ConformaExceptionsView.vue'))
}
