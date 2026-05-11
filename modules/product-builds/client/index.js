import { defineAsyncComponent } from 'vue'

const RhaiisProductView = defineAsyncComponent(() => import('./views/RhaiisProductView.vue'))
const PlaceholderProductView = defineAsyncComponent(() => import('./views/PlaceholderProductView.vue'))

export const routes = {
  'rhaiis': RhaiisProductView,
  'rhel-ai': PlaceholderProductView,
  'base-images': PlaceholderProductView,
  'builder-images': PlaceholderProductView,
  'wheel-collections': PlaceholderProductView,
  'drop-detail': defineAsyncComponent(() => import('./views/DropDetailView.vue')),
  'artifact-detail': defineAsyncComponent(() => import('./views/ArtifactDetailView.vue')),
}
