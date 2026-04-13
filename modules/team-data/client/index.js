import { defineAsyncComponent } from 'vue'

export const routes = {
  'people': defineAsyncComponent(() => import('./views/PeopleDirectoryView.vue')),
  'person-detail': defineAsyncComponent(() => import('./views/PersonDetailView.vue')),
  'org-explorer': defineAsyncComponent(() => import('./views/OrgExplorerView.vue')),
}
