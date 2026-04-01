import { defineAsyncComponent } from 'vue'

export const routes = {
  'dashboard': defineAsyncComponent(() => import('./views/Dashboard.vue')),
  'insights': defineAsyncComponent(() => import('./views/Insights.vue')),
  'portfolio': defineAsyncComponent(() => import('./views/Portfolio.vue')),
}
