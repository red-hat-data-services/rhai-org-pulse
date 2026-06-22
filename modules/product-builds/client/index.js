import { defineAsyncComponent } from 'vue'

const ProductView = defineAsyncComponent(() => import('./views/ProductView.vue'))

export const routes = {
  'rhaiis': ProductView,
  'rhel-ai': ProductView,
  'base-images': ProductView,
  'builder-images': ProductView,
  'series-detail': defineAsyncComponent(() => import('./views/SeriesDetailView.vue')),
  'wheel-collections': defineAsyncComponent(() => import('./views/WheelCollectionsView.vue')),
  'drop-detail': defineAsyncComponent(() => import('./views/DropDetailView.vue')),
  'artifact-detail': defineAsyncComponent(() => import('./views/ArtifactDetailView.vue')),
  'package-analysis': defineAsyncComponent(() => import('./views/PackageAnalysisView.vue')),
}
