import { defineAsyncComponent } from 'vue'

export const routes = {
  'home': defineAsyncComponent(() => import('./views/TeamDirectoryView.vue')),
  'people': defineAsyncComponent(() => import('./views/PeopleDirectoryView.vue')),
  'trends': defineAsyncComponent(() => import('./views/TrendsView.vue')),
  'reports': defineAsyncComponent(() => import('./views/ReportsView.vue')),
  'org-dashboard': defineAsyncComponent(() => import('./views/OrgDashboardView.vue')),
  'org-explorer': defineAsyncComponent(() => import('./views/OrgExplorerView.vue')),
  'team-detail': defineAsyncComponent(() => import('./views/TeamRosterView.vue')),
  'person-detail': defineAsyncComponent(() => import('./views/PersonProfileView.vue')),
}
