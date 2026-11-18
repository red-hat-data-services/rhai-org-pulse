import { defineAsyncComponent } from 'vue'
import { withTracking } from '@shared/client'

const ComingSoonView = defineAsyncComponent(() => import('./components/ComingSoonPlaceholder.vue'))

export const routes = {
  'rfe-review': withTracking('ai-impact', 'rfe-review', () => import('./views/RFEReviewView.vue')),
  'feature-review': withTracking('ai-impact', 'feature-review', () => import('./views/FeatureReviewView.vue')),
  'feature-decomposer': withTracking('ai-impact', 'feature-decomposer', () => import('./views/FeatureDecomposerView.vue')),
  'autofix': withTracking('ai-impact', 'autofix', () => import('./views/AutofixView.vue')),
  'ai-factory-guide': withTracking('ai-impact', 'ai-factory-guide', () => import('./views/AIFactoryGuideView.vue')),
  'implementation': ComingSoonView,
  'test-plan-review': withTracking('ai-impact', 'test-plan-review', () => import('./views/TestPlanView.vue')),
  'security': ComingSoonView,
  'documentation': withTracking('ai-impact', 'documentation', () => import('./views/DocumentationView.vue')),
  'build-release': withTracking('ai-impact', 'build-release', () => import('./views/BuildReleaseView.vue')),
}
