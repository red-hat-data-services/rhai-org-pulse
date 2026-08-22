<template>
  <template v-for="(section, sIdx) in docsSections" :key="section.id">
    <h2
      class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3"
      :class="{ 'mt-8': sIdx > 0 }"
    >
      {{ section.label }}
    </h2>

    <div
      v-for="cat in section.categories"
      :key="cat.id"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
    >
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {{ cat.title }}
        <a
          v-if="cat.slackChannel"
          :href="cat.slackChannel.url"
          target="_blank"
          rel="noopener"
          class="ml-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {{ cat.slackChannel.name }}
        </a>
      </h3>
      <template v-if="cat.resolvedLinkGroups">
        <div v-for="group in cat.resolvedLinkGroups" :key="group.date" class="mb-4 last:mb-0">
          <span class="inline-block mb-2 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {{ group.date }}
          </span>
          <div class="flex flex-wrap gap-4">
            <a
              v-for="link in group.links"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200"
            >
              <component :is="link.icon" :size="18" :stroke-width="1.7" class="flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <span>{{ link.label }}</span>
              <ExternalLink :size="14" class="flex-shrink-0 text-gray-400 dark:text-gray-500" />
            </a>
          </div>
        </div>
      </template>
      <div v-else class="flex flex-wrap gap-4">
        <a
          v-for="link in cat.resolvedLinks"
          :key="link.url"
          :href="link.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-all duration-200"
        >
          <component :is="link.icon" :size="18" :stroke-width="1.7" class="flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <span>{{ link.label }}</span>
          <ExternalLink :size="14" class="flex-shrink-0 text-gray-400 dark:text-gray-500" />
        </a>
      </div>
    </div>
  </template>
</template>

<script setup>
import { ExternalLink, Video, Presentation, StickyNote, Play, MessageSquare } from 'lucide-vue-next'
import { enablementCategories, enablementSections } from '@modules/ai-impact/client/enablement-links.js'

const iconMap = { Video, Presentation, StickyNote, Play, MessageSquare }

function resolveIcon(name) {
  return iconMap[name] || Video
}

const docsSections = enablementSections.map(s => ({
  ...s,
  categories: enablementCategories
    .filter(c => c.section === s.id)
    .map(c => ({
      ...c,
      resolvedLinks: c.links ? c.links.map(l => ({ ...l, icon: resolveIcon(l.icon) })) : null,
      resolvedLinkGroups: c.linkGroups
        ? c.linkGroups.map(g => ({
          ...g,
          links: g.links.map(l => ({ ...l, icon: resolveIcon(l.icon) })),
        }))
        : null,
    })),
}))
</script>
