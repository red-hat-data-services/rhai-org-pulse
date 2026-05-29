import { defineAsyncComponent } from 'vue'

export const routes = {
  'status': defineAsyncComponent(() => import('./views/StatusBoard.vue')),
  'detail': defineAsyncComponent(() => import('./views/PipelineDetail.vue')),
}
