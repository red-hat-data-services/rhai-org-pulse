<template>
  <div class="space-y-6">
    <!-- Headcount Chart -->
    <div v-if="headcount" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Headcount by Role</h3>
      <HeadcountChart :headcount="headcount" />
    </div>

    <!-- Team Members -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Team Members
          <span class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</span>
        </h3>
        <button
          v-if="canManage"
          @click="showAddModal = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Member
        </button>
      </div>
      <TeamMembersTable
        :members="members"
        :teamKey="teamKey"
        :fieldDefinitions="fieldDefinitions"
        :canManage="canManage"
        :teamId="teamId"
        @remove-member="handleRemoveMember"
      />
    </div>

    <!-- Add Member Modal -->
    <AddMemberModal
      v-if="showAddModal"
      :teamId="teamId"
      :memberUids="memberUids"
      :allPeople="allPeople"
      @close="showAddModal = false"
      @updated="$emit('updated')"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import HeadcountChart from './HeadcountChart.vue'
import TeamMembersTable from './TeamMembersTable.vue'
import AddMemberModal from './AddMemberModal.vue'
import { useTeams } from '@shared/client/composables/useTeams'

const props = defineProps({
  headcount: { type: Object, default: null },
  members: { type: Array, default: () => [] },
  teamKey: { type: String, default: null },
  fieldDefinitions: { type: Array, default: () => [] },
  canManage: { type: Boolean, default: false },
  teamId: { type: String, default: null },
  allPeople: { type: Array, default: () => [] }
})

const emit = defineEmits(['updated'])

const { unassignMember } = useTeams()

const showAddModal = ref(false)

const memberUids = computed(() => new Set(props.members.map(m => m.uid)))

async function handleRemoveMember(uid) {
  try {
    await unassignMember(props.teamId, uid)
    emit('updated')
  } catch (e) {
    console.error('Failed to remove member:', e)
  }
}
</script>
