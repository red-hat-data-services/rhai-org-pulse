<template>
  <div class="py-8">
    <div class="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 opacity-70">
      <p class="text-center text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-6">
        What sharing looks like
      </p>

      <!-- Example: Status update -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 border-l-[3px] border-l-amber-400">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-medium">EE</div>
          <div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Example Engineer</div>
            <div class="text-xs text-gray-400">Platform &middot; 🏆 Win</div>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">"Just shipped the new onboarding flow. Early metrics show 30% faster setup!"</p>
        <div class="mt-2 text-xs text-gray-400">👍 8 &nbsp; 🚀 3 &nbsp;&nbsp; 💬 2 comments</div>
      </div>

      <!-- Example: TIL -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-[3px] border-l-purple-400">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-medium">EE</div>
          <div>
            <div class="text-sm font-medium text-gray-700 dark:text-gray-300">Example Engineer</div>
            <div class="text-xs text-gray-400">Data Science &middot; 💡 TIL</div>
          </div>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">"TIL: git bisect can binary-search your commit history to find exactly which commit introduced a bug. Game changer."</p>
        <div class="mt-2 text-xs text-gray-400">👍 5 &nbsp; 💡 3</div>
      </div>
    </div>

    <p class="text-center text-sm text-gray-400 dark:text-gray-500 mt-4 mb-6">These are examples of what your feed could look like</p>

    <div class="text-center">
      <button
        @click="$emit('compose')"
        class="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors cursor-pointer"
      >
        Write your first post
      </button>
    </div>
  </div>
</template>

<script setup>
defineEmits(['compose'])
</script>
