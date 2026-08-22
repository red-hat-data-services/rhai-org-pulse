import { defineAsyncComponent } from 'vue'

export const routes = {
  'planning-prep': defineAsyncComponent(() => import('./views/PipelineShellView.vue')),
  'my-pipeline': defineAsyncComponent(() => import('./views/PipelineShellView.vue')),
  'learn': defineAsyncComponent(() => import('./views/PipelineShellView.vue'))
}
