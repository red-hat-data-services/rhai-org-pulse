import { defineAsyncComponent } from 'vue'

const ProductView = defineAsyncComponent(() => import('./views/ProductView.vue'))

export const routes = {
  'rhaiis': ProductView,
  'rhel-ai': ProductView,
  'base-images': ProductView,
  'builder-images': ProductView,
  'wheel-collections': ProductView,
  'series-detail': defineAsyncComponent(() => import('./views/SeriesDetailView.vue')),
  'drop-detail': defineAsyncComponent(() => import('./views/DropDetailView.vue')),
  'artifact-detail': defineAsyncComponent(() => import('./views/ArtifactDetailView.vue')),
}
