<script setup>
defineProps({
  tier: { type: Number, required: true },
  count: { type: Number, default: 0 },
  colspan: { type: Number, default: 1 }
})
</script>

<template>
  <tr>
    <td
      :colspan="colspan"
      class="px-3 py-2 text-xs font-bold uppercase tracking-wide border border-gray-300 dark:border-gray-600 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
    >
      Tier {{ tier }}
      <span class="font-semibold ml-1">({{ count }})</span>
    </td>
  </tr>
</template>
