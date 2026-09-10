<script setup>
// Pinned to specific commit — update via PR to rhai-org-pulse
const PLANNER_URL = 'https://htmlpreview.github.io/?https://github.com/yuvalluria/rhai-release-planner/blob/18f6204/index.html'
</script>

<template>
  <div class="ai-planner-container" style="width: 100%; height: calc(100vh - 120px);">
    <iframe
      :src="PLANNER_URL"
      style="width: 100%; height: 100%; border: none;"
      title="AI-First Release Planner"
      sandbox="allow-scripts"
    />
  </div>
</template>
