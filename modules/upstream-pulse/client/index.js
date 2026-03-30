import { defineAsyncComponent } from 'vue'

export const routes = {
  'dashboard': defineAsyncComponent(() => import('./views/Dashboard.vue')),
}
