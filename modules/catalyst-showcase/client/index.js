import { defineAsyncComponent } from 'vue'

export const routes = {
  'catalog': defineAsyncComponent(() => import('./views/CatalogView.vue')),
  'detail': defineAsyncComponent(() => import('./views/DetailView.vue')),
}
