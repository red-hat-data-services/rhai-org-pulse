import { defineAsyncComponent } from 'vue'

const ComingSoonView = defineAsyncComponent(() => import('./components/ComingSoonPlaceholder.vue'))

export const routes = {
  'rfe-review': defineAsyncComponent(() => import('./views/RFEReviewView.vue')),
  'feature-review': defineAsyncComponent(() => import('./views/FeatureReviewView.vue')),
  'autofix': defineAsyncComponent(() => import('./views/AutofixView.vue')),
  'implementation': ComingSoonView,
  'qe-validation': ComingSoonView,
  'security': ComingSoonView,
  'documentation': ComingSoonView,
  'build-release': ComingSoonView,
}
