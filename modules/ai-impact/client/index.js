import { defineAsyncComponent } from 'vue'

const ComingSoonView = defineAsyncComponent(() => import('./components/ComingSoonPlaceholder.vue'))

export const routes = {
  'rfe-review': defineAsyncComponent(() => import('./views/RFEReviewView.vue')),
  'feature-review': defineAsyncComponent(() => import('./views/FeatureReviewView.vue')),
  'autofix': defineAsyncComponent(() => import('./views/AutofixView.vue')),
  'ai-factory-guide': defineAsyncComponent(() => import('./views/AIFactoryGuideView.vue')),
  'implementation': ComingSoonView,
  'test-plan-review': defineAsyncComponent(() => import('./views/TestPlanView.vue')),
  'security': ComingSoonView,
  'documentation': defineAsyncComponent(() => import('./views/DocumentationView.vue')),
  'build-release': defineAsyncComponent(() => import('./views/BuildReleaseView.vue')),
}
