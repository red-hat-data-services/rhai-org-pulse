import { defineAsyncComponent } from 'vue'

export const routes = {
  'home': defineAsyncComponent(() => import('./views/TeamDirectoryView.vue')),
  'people': defineAsyncComponent(() => import('./views/PeopleDirectoryView.vue')),
  'reports': defineAsyncComponent(() => import('./reports/ReportsHub.vue')),
  'org-dashboard': defineAsyncComponent(() => import('./views/OrgDashboardView.vue')),
  'org-explorer': defineAsyncComponent(() => import('./views/OrgExplorerView.vue')),
  'team-detail': defineAsyncComponent(() => import('./views/TeamRosterView.vue')),
  'person-detail': defineAsyncComponent(() => import('./views/PersonProfileView.vue')),
  'unassigned': defineAsyncComponent(() => import('./components/UnassignedPeople.vue')),
  'manager-dashboard': defineAsyncComponent(() => import('./views/ManagerDashboardView.vue')),
  'manage': defineAsyncComponent(() => import('./views/ManageView.vue')),
}
