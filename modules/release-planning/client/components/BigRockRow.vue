<script setup>
defineProps({
  rock: { type: Object, required: true },
  jiraBaseUrl: { type: String, default: '' }
})
</script>

<template>
  <td class="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs border border-gray-300 dark:border-gray-600">{{ rock.priority }}</td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
      {{ rock.pillar }}
    </span>
  </td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <div class="text-gray-900 dark:text-gray-100 font-medium">{{ rock.name }}</div>
    <div class="text-xs text-gray-500 dark:text-gray-400">{{ rock.fullName }}</div>
  </td>
  <td class="px-3 py-2 border border-gray-300 dark:border-gray-600">
    <div v-for="key in rock.outcomeKeys" :key="key" class="mb-0.5">
      <a
        :href="`${jiraBaseUrl}/${key}`"
        target="_blank"
        rel="noopener"
        class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
        @click.stop
      >{{ key }}</a>
      <span v-if="rock.outcomeDescriptions && rock.outcomeDescriptions[key]" class="text-xs text-gray-500 dark:text-gray-400 ml-1">
        - {{ rock.outcomeDescriptions[key] }}
      </span>
    </div>
    <span v-if="!rock.outcomeKeys || rock.outcomeKeys.length === 0" class="text-xs text-gray-400 dark:text-gray-500 italic">TBD</span>
  </td>
  <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ rock.owner || '-' }}</td>
  <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">{{ rock.architect || '-' }}</td>
  <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
    <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.featureCount }}</span>
  </td>
  <td class="px-3 py-2 text-center border border-gray-300 dark:border-gray-600">
    <span class="font-semibold text-gray-700 dark:text-gray-300">{{ rock.rfeCount }}</span>
  </td>
  <td class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate border border-gray-300 dark:border-gray-600">{{ rock.notes }}</td>
</template>
