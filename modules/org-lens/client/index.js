import { defineAsyncComponent } from 'vue'

export const routes = {
  chat: defineAsyncComponent(() => import('./views/ChatView.vue')),
}
