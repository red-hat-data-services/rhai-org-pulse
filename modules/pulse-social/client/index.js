import { defineAsyncComponent } from 'vue'

export const routes = {
  'feed': defineAsyncComponent(() => import('./views/FeedView.vue')),
  'my-posts': defineAsyncComponent(() => import('./views/MyPostsView.vue')),
  'post-detail': defineAsyncComponent(() => import('./views/PostDetailView.vue')),
}
