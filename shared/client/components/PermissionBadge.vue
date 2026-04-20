<script setup>
import { usePermissions } from '@shared/client/composables/usePermissions'

const { tier, loading } = usePermissions()

const tierConfig = {
  admin: { label: 'Admin', classes: 'bg-red-100 text-red-800' },
  manager: { label: 'Manager', classes: 'bg-blue-100 text-blue-800' },
  user: { label: 'Viewer', classes: 'bg-gray-100 text-gray-700' }
}
</script>

<template>
  <span
    v-if="!loading"
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
    :class="tierConfig[tier]?.classes || tierConfig.user.classes"
  >
    {{ tierConfig[tier]?.label || 'Viewer' }}
  </span>
</template>
