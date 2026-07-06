<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading data quality...
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-12 text-red-600 dark:text-red-400">
      {{ error }}
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <select
          v-if="orgKeys.length > 1"
          v-model="selectedOrg"
          data-testid="org-filter"
          class="text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All orgs</option>
          <option v-for="org in orgKeys" :key="org.key" :value="org.key">{{ org.displayName }}</option>
        </select>

        <select
          v-model="selectedTeam"
          data-testid="team-filter"
          class="text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All teams</option>
          <option v-for="team in filteredTeamOptions" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>

        <select
          v-if="activeTab === 'people' ? visiblePersonFields.length > 0 : visibleTeamFields.length > 0"
          v-model="selectedField"
          data-testid="field-filter"
          class="text-sm rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="">All fields</option>
          <option
            v-for="field in (activeTab === 'people' ? visiblePersonFields : visibleTeamFields)"
            :key="field.id"
            :value="field.id"
          >Missing: {{ field.label }}</option>
        </select>
      </div>

      <!-- Sub-tabs: People / Teams -->
      <div class="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="switchTab(tab.id)"
          class="pb-2 px-1 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          {{ tab.label }}
          <span class="ml-1 text-xs text-gray-400 dark:text-gray-500">({{ tab.count }})</span>
        </button>
      </div>

      <!-- ═══ People tab ═══ -->
      <div v-if="activeTab === 'people'">
        <div v-if="filteredPeopleForDisplay.length === 0 && !searchQuery" class="text-center py-8 text-gray-500 dark:text-gray-400">
          No people found{{ selectedOrg || selectedTeam ? ' matching the selected filters' : '' }}.
        </div>
        <div v-else>
          <!-- Edit controls -->
          <div class="flex items-center justify-end gap-3 mb-3">
            <template v-if="bulkEditing">
              <span v-if="pendingChangeCount > 0" class="text-xs text-amber-600 dark:text-amber-400">{{ pendingChangeCount }} unsaved change{{ pendingChangeCount !== 1 ? 's' : '' }}</span>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                :disabled="saving || pendingChangeCount === 0"
                @click="saveAllChanges"
              >{{ saving ? 'Saving...' : `Save All (${pendingChangeCount})` }}</button>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                :disabled="saving"
                @click="cancelBulkEdit"
              >Cancel</button>
            </template>
            <button
              v-else
              class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors flex items-center gap-1.5"
              @click="enterBulkEdit"
            >
              <Pencil class="w-3.5 h-3.5" />
              Edit All Fields
            </button>
          </div>

          <!-- Search -->
          <div class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name, title, team, or field values..."
              class="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Completeness banner -->
          <div
            v-if="!bannerDismissed && incompletePeople.length > 0"
            class="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm"
          >
            <AlertTriangle class="w-4 h-4 flex-shrink-0" />
            <span>{{ incompletePeople.length }} of {{ filteredPeopleBeforeSearch.length }} {{ filteredPeopleBeforeSearch.length === 1 ? 'person has' : 'people have' }} incomplete fields</span>
            <button
              @click="showIncompleteOnly = !showIncompleteOnly"
              class="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >{{ showIncompleteOnly ? 'Show all' : 'Show incomplete only' }}</button>
            <button @click="bannerDismissed = true" class="text-amber-500 hover:text-amber-700">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="searchQuery && filteredPeopleForDisplay.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            No people match "{{ searchQuery }}"
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="bulkEditing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="bulkEditing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'">Title</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="bulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'">Team(s)</th>
                  <th
                    v-for="field in visiblePersonFields"
                    :key="field.id"
                    class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    :class="bulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'"
                  >{{ field.label }}</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="person in filteredPeopleForDisplay"
                  :key="person.uid"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <!-- Name -->
                  <td class="px-4 py-3 text-sm whitespace-nowrap" :class="bulkEditing ? 'opacity-50' : ''">
                    <button
                      @click="navigateToPersonDetail(person.uid)"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >{{ person.name }}</button>
                  </td>
                  <!-- Title -->
                  <td class="px-4 py-3 text-sm whitespace-nowrap" :class="bulkEditing ? 'opacity-50 text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'">
                    {{ person.title || '—' }}
                  </td>
                  <!-- Team(s) -->
                  <td class="px-4 py-3 text-sm" :class="bulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''">
                    <!-- BULK EDIT -->
                    <div v-if="bulkEditing" class="min-w-[140px]">
                      <ConstrainedAutocomplete
                        :model-value="getBulkTeamValue(person.uid)"
                        :options="allTeamNames"
                        :multi-value="true"
                        @update:model-value="setBulkTeamValue(person.uid, $event)"
                      />
                    </div>
                    <!-- SINGLE-CELL EDIT -->
                    <div v-else-if="editingTeamUid === person.uid" class="relative min-w-[160px]">
                      <ConstrainedAutocomplete
                        :model-value="editTeamValue"
                        :options="allTeamNames"
                        :multi-value="true"
                        @update:model-value="editTeamValue = $event"
                      />
                      <div class="flex gap-1.5 mt-1">
                        <button class="px-2 py-0.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50" :disabled="saving" @click="saveTeamEdit(person.uid)">Save</button>
                        <button class="px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600" @click="editingTeamUid = null">Cancel</button>
                      </div>
                    </div>
                    <!-- DISPLAY -->
                    <div v-else class="group flex items-center gap-1.5 cursor-pointer" @click="startTeamEdit(person)">
                      <div v-if="person.teamIds.length > 0">
                        <template v-for="(id, idx) in person.teamIds" :key="id">
                          <span v-if="idx > 0" class="text-gray-400 dark:text-gray-500">, </span>
                          <button
                            v-if="teamById[id]"
                            @click.stop="navigateToTeamDetail(teamById[id])"
                            class="text-primary-600 dark:text-primary-400 hover:underline"
                          >{{ teamById[id].name }}</button>
                          <span v-else class="text-gray-600 dark:text-gray-400">{{ id }}</span>
                        </template>
                      </div>
                      <span v-else class="text-amber-500 dark:text-amber-400">Unassigned</span>
                      <svg class="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </td>
                  <!-- Field cells -->
                  <td
                    v-for="field in visiblePersonFields"
                    :key="field.id"
                    class="px-4 py-3 text-sm"
                    :class="bulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
                  >
                    <FieldEditCell
                      v-if="bulkEditing"
                      :field="field"
                      :model-value="getBulkValue(person.uid, field)"
                      :all-people="allPeopleForEditor"
                      :referenced-people="referencedPeople"
                      :show-buttons="false"
                      @update:model-value="setBulkValue(person.uid, field.id, $event)"
                      @add-person="addToBulkPersonValue(person.uid, field.id, $event)"
                      @remove-person="removeFromBulkPersonValue(person.uid, field.id, $event)"
                    />
                    <div v-else-if="editingCell.uid === person.uid && editingCell.fieldId === field.id" class="editing-cell relative min-w-[160px]">
                      <FieldEditCell
                        :field="field"
                        :model-value="editValue"
                        :all-people="allPeopleForEditor"
                        :referenced-people="referencedPeople"
                        :disabled="saving"
                        @update:model-value="editValue = $event"
                        @save="saveCell(person.uid, field.id)"
                        @cancel="cancelEdit"
                        @add-person="addToEditPersonValue($event)"
                        @remove-person="removeFromEditPersonValue($event)"
                      />
                      <button
                        v-if="isFieldEmpty(person.customFields?.[field.id], field)"
                        class="mt-1 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        @click="openExceptionModal('person', person.uid, person.name, field.id)"
                      >Add Exception</button>
                    </div>
                    <div v-else>
                      <ExceptionPopover
                        v-if="isFieldEmpty(person.customFields?.[field.id], field) && hasExceptionFor('person', person.uid, field.id)"
                        :exception="getExceptionObj('person', person.uid, field.id)"
                        @remove="handleRemoveException"
                        @view-all="navigateToExceptionsTab"
                      />
                      <div v-else class="cursor-pointer" @click="startCellEdit(person, field)">
                        <FieldDisplayCell
                          :value="person.customFields?.[field.id]"
                          :field="field"
                          :referenced-people="referencedPeople"
                          :highlight="isFieldEmpty(person.customFields?.[field.id], field)"
                          @person-click="navigateToPersonDetail($event)"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ═══ Teams tab ═══ -->
      <div v-if="activeTab === 'teams'">
        <div v-if="filteredTeamsForDisplay.length === 0 && !teamSearchQuery" class="text-center py-8 text-gray-500 dark:text-gray-400">
          No teams found{{ selectedOrg ? ' matching the selected filters' : '' }}.
        </div>
        <div v-else>
          <!-- Edit controls -->
          <div class="flex items-center justify-end gap-3 mb-3">
            <template v-if="teamBulkEditing">
              <span v-if="teamPendingChangeCount > 0" class="text-xs text-amber-600 dark:text-amber-400">{{ teamPendingChangeCount }} unsaved change{{ teamPendingChangeCount !== 1 ? 's' : '' }}</span>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
                :disabled="saving || teamPendingChangeCount === 0"
                @click="saveAllTeamChanges"
              >{{ saving ? 'Saving...' : `Save All (${teamPendingChangeCount})` }}</button>
              <button
                class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                :disabled="saving"
                @click="cancelTeamBulkEdit"
              >Cancel</button>
            </template>
            <button
              v-else
              class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors flex items-center gap-1.5"
              @click="enterTeamBulkEdit"
            >
              <Pencil class="w-3.5 h-3.5" />
              Edit All Fields
            </button>
          </div>

          <!-- Search -->
          <div class="relative mb-3">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              v-model="teamSearchQuery"
              type="text"
              placeholder="Search by team name, org, or field values..."
              class="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
            <button
              v-if="teamSearchQuery"
              @click="teamSearchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Team completeness banner -->
          <div
            v-if="!teamBannerDismissed && incompleteTeams.length > 0"
            class="flex items-center gap-3 px-4 py-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm"
          >
            <AlertTriangle class="w-4 h-4 flex-shrink-0" />
            <span>{{ incompleteTeams.length }} of {{ filteredTeamsBeforeSearch.length }} {{ filteredTeamsBeforeSearch.length === 1 ? 'team has' : 'teams have' }} incomplete fields</span>
            <button
              @click="showIncompleteTeamsOnly = !showIncompleteTeamsOnly"
              class="ml-auto text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
            >{{ showIncompleteTeamsOnly ? 'Show all' : 'Show incomplete only' }}</button>
            <button @click="teamBannerDismissed = true" class="text-amber-500 hover:text-amber-700">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div v-if="teamSearchQuery && filteredTeamsForDisplay.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
            No teams match "{{ teamSearchQuery }}"
          </div>

          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="teamBulkEditing ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'">Team</th>
                  <th
                    v-for="field in visibleTeamFields"
                    :key="field.id"
                    class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                    :class="teamBulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'"
                  >{{ field.label }}</th>
                  <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" :class="teamBulkEditing ? 'text-primary-700 dark:text-primary-300 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-500 dark:text-gray-400'">Boards</th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="team in filteredTeamsForDisplay"
                  :key="team.id"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td class="px-4 py-3 text-sm whitespace-nowrap" :class="teamBulkEditing ? 'opacity-50' : ''">
                    <button
                      @click="navigateToTeamDetail(team)"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                    >{{ team.name }}</button>
                    <span v-if="teamsHaveMultipleOrgs" class="ml-1.5 text-xs text-gray-400 dark:text-gray-500">{{ team.orgDisplayName || team.orgKey }}</span>
                  </td>
                  <!-- Team field cells -->
                  <td
                    v-for="field in visibleTeamFields"
                    :key="field.id"
                    class="px-4 py-3 text-sm text-left"
                    :class="teamBulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
                  >
                    <FieldEditCell
                      v-if="teamBulkEditing"
                      :field="field"
                      :model-value="getTeamBulkValue(team.id, field)"
                      :all-people="allPeopleForEditor"
                      :referenced-people="referencedPeople"
                      :show-buttons="false"
                      @update:model-value="setTeamBulkValue(team.id, field.id, $event)"
                      @add-person="addToTeamBulkPersonValue(team.id, field.id, $event)"
                      @remove-person="removeFromTeamBulkPersonValue(team.id, field.id, $event)"
                    />
                    <div v-else-if="editingTeamCell.teamId === team.id && editingTeamCell.fieldId === field.id" class="editing-cell relative min-w-[160px]">
                      <FieldEditCell
                        :field="field"
                        :model-value="editTeamFieldValue"
                        :all-people="allPeopleForEditor"
                        :referenced-people="referencedPeople"
                        :disabled="saving"
                        @update:model-value="editTeamFieldValue = $event"
                        @save="saveTeamFieldCell(team.id, field.id)"
                        @cancel="cancelTeamFieldEdit"
                        @add-person="addToEditTeamFieldValue($event)"
                        @remove-person="editTeamFieldValue = editTeamFieldValue.filter(u => u !== $event)"
                      />
                      <button
                        v-if="isFieldEmpty(team.metadata?.[field.id], field)"
                        class="mt-1 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        @click="openExceptionModal('team', team.id, team.name, field.id)"
                      >Add Exception</button>
                    </div>
                    <div v-else>
                      <ExceptionPopover
                        v-if="isFieldEmpty(team.metadata?.[field.id], field) && hasExceptionFor('team', team.id, field.id)"
                        :exception="getExceptionObj('team', team.id, field.id)"
                        @remove="handleRemoveException"
                        @view-all="navigateToExceptionsTab"
                      />
                      <div v-else class="cursor-pointer" @click="startTeamFieldEdit(team, field)">
                        <FieldDisplayCell
                          :value="team.metadata?.[field.id]"
                          :field="field"
                          :referenced-people="referencedPeople"
                          :highlight="isFieldEmpty(team.metadata?.[field.id], field)"
                          @person-click="navigateToPersonDetail($event)"
                        />
                      </div>
                    </div>
                  </td>
                  <!-- Boards column -->
                  <td class="px-4 py-3 text-sm" :class="teamBulkEditing ? 'bg-blue-50 dark:bg-blue-900/20' : ''">
                    <div
                      class="group flex items-center gap-1.5 cursor-pointer"
                      :class="{ 'bg-red-100 dark:bg-red-700/50 rounded px-1': (!team.boards || team.boards.length === 0) && !hasExceptionFor('team', team.id, '__boards__') }"
                      @click="boardsDrawerTeam = team"
                    >
                      <div v-if="team.boards && team.boards.length > 0" class="flex flex-wrap gap-1.5">
                        <a
                          v-for="(board, idx) in team.boards"
                          :key="idx"
                          :href="board.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          @click.stop
                          class="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          {{ board.name || 'Board' }}
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                      <ExceptionPopover
                        v-else-if="hasExceptionFor('team', team.id, '__boards__')"
                        :exception="getExceptionObj('team', team.id, '__boards__')"
                        @remove="handleRemoveException"
                        @view-all="navigateToExceptionsTab"
                      />
                      <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                      <button
                        v-if="(!team.boards || team.boards.length === 0) && !hasExceptionFor('team', team.id, '__boards__')"
                        class="hidden group-hover:inline-flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        @click.stop="openExceptionModal('team', team.id, team.name, '__boards__')"
                      >Add Exception</button>
                      <svg class="h-3 w-3 text-gray-400 dark:text-gray-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Boards drawer -->
    <TeamBoardsDrawer
      :team="boardsDrawerTeam"
      :is-open="!!boardsDrawerTeam"
      @close="boardsDrawerTeam = null"
      @saved="refresh()"
    />

    <!-- Exception modal (inline creation from edit mode) -->
    <AddExceptionModal
      v-if="showExceptionModal"
      :people="allPeople.map(p => ({ uid: p.uid, name: p.name }))"
      :teams="teams.map(t => ({ id: t.id, name: t.name, orgKey: t.orgKey }))"
      :org-keys="orgKeys"
      :field-definitions="fieldDefinitions"
      :prefill-entity-type="exceptionPrefill.entityType"
      :prefill-entity-id="exceptionPrefill.entityId"
      :prefill-entity-label="exceptionPrefill.entityLabel"
      :prefill-field-id="exceptionPrefill.fieldId"
      @close="showExceptionModal = false"
      @created="handleExceptionCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, inject, watch } from 'vue'
import { ExternalLink, Pencil, Search, X, AlertTriangle } from 'lucide-vue-next'
import { useFieldCompleteness } from '../composables/useFieldCompleteness'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions'
import { useTeams } from '@shared/client/composables/useTeams'
import { useRoster } from '@shared/client/composables/useRoster'
import { apiRequest } from '@shared/client/services/api'
import { isFieldEmpty as _isFieldEmpty, buildExceptionSet, hasException as _hasException, getException as _getException } from '../utils/field-helpers'
import ConstrainedAutocomplete from './ConstrainedAutocomplete.vue'
import FieldDisplayCell from './FieldDisplayCell.vue'
import FieldEditCell from './FieldEditCell.vue'
import TeamBoardsDrawer from './TeamBoardsDrawer.vue'
import AddExceptionModal from './AddExceptionModal.vue'
import ExceptionPopover from './ExceptionPopover.vue'

const nav = inject('moduleNav', null)

const { people, teams, allPeople, referencedPeople, fieldDefinitions, orgKeys, fieldExceptions, loading, error, load, refresh } = useFieldCompleteness()
const { updatePersonFields } = useFieldDefinitions()
const { updateTeamFields } = useTeams()
const { reloadRoster } = useRoster()

// --- Tab state ---
const activeTab = ref('people')

// --- Filter state ---
const selectedOrg = ref('')
const selectedTeam = ref('')
const selectedField = ref('')
const searchQuery = ref('')
const teamSearchQuery = ref('')

// --- Completeness filter ---
const showIncompleteOnly = ref(false)
const showIncompleteTeamsOnly = ref(false)
const bannerDismissed = ref(false)
const teamBannerDismissed = ref(false)

// --- People: single-cell editing ---
const editingCell = ref({ uid: null, fieldId: null })
const editValue = ref(null)
const editingTeamUid = ref(null)
const editTeamValue = ref([])
const saving = ref(false)

// --- People: bulk editing ---
const bulkEditing = ref(false)
const bulkChanges = reactive({})
const bulkTeamChanges = reactive({})

// --- Teams: single-cell editing ---
const editingTeamCell = ref({ teamId: null, fieldId: null })
const editTeamFieldValue = ref(null)
const boardsDrawerTeam = ref(null)

// --- Teams: bulk editing ---
const teamBulkEditing = ref(false)
const teamBulkChanges = reactive({})

// --- Exception modal (inline creation from edit mode) ---
const showExceptionModal = ref(false)
const exceptionPrefill = ref({ entityType: null, entityId: null, entityLabel: null, fieldId: null })

function openExceptionModal(entityType, entityId, entityLabel, fieldId) {
  exceptionPrefill.value = { entityType, entityId, entityLabel, fieldId }
  // Close whichever edit mode is open
  editingCell.value = { uid: null, fieldId: null }
  editingTeamCell.value = { teamId: null, fieldId: null }
  showExceptionModal.value = true
}

async function handleExceptionCreated() {
  showExceptionModal.value = false
  await refresh()
}

async function handleRemoveException(exceptionId) {
  try {
    await apiRequest(`/modules/team-tracker/field-exceptions/${exceptionId}`, { method: 'DELETE' })
    await refresh()
  } catch (err) {
    console.error('Failed to remove exception:', err)
  }
}

function navigateToExceptionsTab() {
  nav?.navigateTo('manage', { tab: 'exceptions' })
}

// --- Computed: field definitions ---
const visiblePersonFields = computed(() =>
  (fieldDefinitions.value.person || []).filter(f => !f.deleted && f.visible)
)

const visibleTeamFields = computed(() =>
  (fieldDefinitions.value.team || []).filter(f => !f.deleted && f.visible)
)

// --- Computed: team lookup ---
const teamById = computed(() => {
  const map = {}
  for (const team of teams.value) {
    map[team.id] = team
  }
  return map
})

const allTeamNames = computed(() =>
  teams.value.map(t => t.name).sort()
)

const teamNameToId = computed(() => {
  const map = {}
  for (const t of teams.value) map[t.name] = t.id
  return map
})

const allPeopleForEditor = computed(() => {
  const seen = new Set()
  const result = []
  for (const p of allPeople.value) {
    if (!seen.has(p.uid)) {
      seen.add(p.uid)
      result.push(p)
    }
  }
  for (const [uid, name] of Object.entries(referencedPeople.value)) {
    if (!seen.has(uid)) {
      seen.add(uid)
      result.push({ uid, name })
    }
  }
  return result
})

// --- Computed: team filter options (cascade from org) ---
const filteredTeamOptions = computed(() => {
  let t = teams.value
  if (selectedOrg.value) {
    t = t.filter(team => team.orgKey === selectedOrg.value)
  }
  return t
})

// --- Computed: filtered people ---

// Step 1: apply org/team/field filters (before search)
const filteredPeopleBeforeSearch = computed(() => {
  let result = people.value

  if (selectedOrg.value) {
    const orgTeamIds = new Set(
      teams.value.filter(t => t.orgKey === selectedOrg.value).map(t => t.id)
    )
    result = result.filter(p => p.teamIds?.some(id => orgTeamIds.has(id)))
  }

  if (selectedTeam.value) {
    result = result.filter(p => p.teamIds?.includes(selectedTeam.value))
  }

  if (selectedField.value) {
    const fieldDef = visiblePersonFields.value.find(f => f.id === selectedField.value)
    if (fieldDef) {
      result = result.filter(p => isFieldEmpty(p.customFields?.[selectedField.value], fieldDef))
    }
  }

  return result
})

// Step 2: incompleteness computation (on filtered set)
function isFieldEmpty(value, field) {
  return _isFieldEmpty(value, field)
}

const exceptionSet = computed(() => buildExceptionSet(fieldExceptions.value))

function hasExceptionFor(entityType, entityId, fieldId) {
  return _hasException(exceptionSet.value, entityType, entityId, fieldId)
}

function getExceptionObj(entityType, entityId, fieldId) {
  return _getException(fieldExceptions.value, entityType, entityId, fieldId)
}

const incompletePeople = computed(() =>
  filteredPeopleBeforeSearch.value.filter(person =>
    visiblePersonFields.value.some(field =>
      isFieldEmpty(person.customFields?.[field.id], field) &&
      !hasExceptionFor('person', person.uid, field.id)
    )
  )
)

const incompletePeopleUids = computed(() => new Set(incompletePeople.value.map(p => p.uid)))

// Step 3: search + incomplete filter
const filteredPeopleForDisplay = computed(() => {
  let result = filteredPeopleBeforeSearch.value
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(r => {
      if (r.name?.toLowerCase().includes(q)) return true
      if (r.title?.toLowerCase().includes(q)) return true
      if (r.teamIds?.some(id => teamById.value[id]?.name?.toLowerCase().includes(q))) return true
      for (const field of visiblePersonFields.value) {
        const val = r.customFields?.[field.id]
        if (!val) continue
        if (typeof val === 'string' && val.toLowerCase().includes(q)) return true
        if (Array.isArray(val) && val.some(v => {
          if (typeof v === 'string') {
            const resolved = referencedPeople.value[v]
            return (resolved || v).toLowerCase().includes(q)
          }
          return false
        })) return true
      }
      return false
    })
  }
  if (showIncompleteOnly.value) {
    result = result.filter(r => incompletePeopleUids.value.has(r.uid))
  }
  return result
})

// --- Computed: filtered teams ---

const filteredTeamsBeforeSearch = computed(() => {
  let result = teams.value
  if (selectedOrg.value) {
    result = result.filter(t => t.orgKey === selectedOrg.value)
  }
  if (selectedTeam.value) {
    result = result.filter(t => t.id === selectedTeam.value)
  }
  if (selectedField.value && activeTab.value === 'teams') {
    const fieldDef = visibleTeamFields.value.find(f => f.id === selectedField.value)
    if (fieldDef) {
      result = result.filter(t => isFieldEmpty(t.metadata?.[selectedField.value], fieldDef))
    }
  }
  return result
})

const incompleteTeams = computed(() =>
  filteredTeamsBeforeSearch.value.filter(team => {
    const hasEmptyBoards = (!team.boards || team.boards.length === 0)
      && !hasExceptionFor('team', team.id, '__boards__')
    if (hasEmptyBoards) return true
    return visibleTeamFields.value.some(field =>
      isFieldEmpty(team.metadata?.[field.id], field) &&
      !hasExceptionFor('team', team.id, field.id)
    )
  })
)

const incompleteTeamIds = computed(() => new Set(incompleteTeams.value.map(t => t.id)))

const filteredTeamsForDisplay = computed(() => {
  let result = filteredTeamsBeforeSearch.value
  const q = teamSearchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(t => {
      if (t.name?.toLowerCase().includes(q)) return true
      if (t.orgKey?.toLowerCase().includes(q)) return true
      for (const field of visibleTeamFields.value) {
        const val = t.metadata?.[field.id]
        if (!val) continue
        if (typeof val === 'string' && val.toLowerCase().includes(q)) return true
        if (Array.isArray(val) && val.some(v => {
          if (typeof v === 'string') {
            const resolved = referencedPeople.value[v]
            return (resolved || v).toLowerCase().includes(q)
          }
          return false
        })) return true
      }
      return false
    })
  }
  if (showIncompleteTeamsOnly.value) {
    result = result.filter(t => incompleteTeamIds.value.has(t.id))
  }
  return result
})

const teamsHaveMultipleOrgs = computed(() => {
  const orgs = new Set(filteredTeamsForDisplay.value.map(t => t.orgKey))
  return orgs.size > 1
})

// --- Tabs ---

const tabs = computed(() => [
  { id: 'people', label: 'People', count: filteredPeopleBeforeSearch.value.length },
  { id: 'teams', label: 'Teams', count: filteredTeamsBeforeSearch.value.length }
])

function switchTab(tabId) {
  activeTab.value = tabId
  showIncompleteOnly.value = false
  showIncompleteTeamsOnly.value = false
  bannerDismissed.value = false
  teamBannerDismissed.value = false
  selectedField.value = ''
}

// --- People: bulk editing ---

const pendingChangeCount = computed(() =>
  Object.keys(bulkChanges).length + Object.keys(bulkTeamChanges).length
)

function enterBulkEdit() {
  bulkEditing.value = true
  for (const key of Object.keys(bulkChanges)) delete bulkChanges[key]
  for (const key of Object.keys(bulkTeamChanges)) delete bulkTeamChanges[key]
}

function cancelBulkEdit() {
  bulkEditing.value = false
  for (const key of Object.keys(bulkChanges)) delete bulkChanges[key]
  for (const key of Object.keys(bulkTeamChanges)) delete bulkTeamChanges[key]
}

function bulkKey(uid, fieldId) {
  return `${uid}\0${fieldId}`
}

function getBulkValue(uid, field) {
  const key = bulkKey(uid, field.id)
  if (key in bulkChanges) return bulkChanges[key]
  const raw = people.value.find(r => r.uid === uid)?.customFields?.[field.id] ?? null
  if (field.type === 'constrained' && field.multiValue) {
    return Array.isArray(raw) ? raw : (raw ? [raw] : [])
  }
  if (field.type === 'person-reference-linked') {
    return (Array.isArray(raw) ? raw[0] : raw) || ''
  }
  return Array.isArray(raw) ? (raw[0] || '') : (raw || '')
}

function setBulkValue(uid, fieldId, value) {
  const key = bulkKey(uid, fieldId)
  const person = people.value.find(r => r.uid === uid)
  const original = person?.customFields?.[fieldId] ?? null
  const field = visiblePersonFields.value.find(f => f.id === fieldId)

  let originalNormalized
  if (field?.type === 'constrained' && field?.multiValue) {
    originalNormalized = Array.isArray(original) ? original : (original ? [original] : [])
  } else if (field?.type === 'person-reference-linked') {
    originalNormalized = (Array.isArray(original) ? original[0] : original) || ''
  } else {
    originalNormalized = Array.isArray(original) ? (original[0] || '') : (original || '')
  }

  if (JSON.stringify(value) === JSON.stringify(originalNormalized)) {
    delete bulkChanges[key]
  } else {
    bulkChanges[key] = value
  }
}

function addToBulkPersonValue(uid, fieldId, personUid) {
  if (!personUid) return
  const field = visiblePersonFields.value.find(f => f.id === fieldId)
  const current = [...(Array.isArray(getBulkValue(uid, field)) ? getBulkValue(uid, field) : [])]
  if (!current.includes(personUid)) {
    current.push(personUid)
    setBulkValue(uid, fieldId, current)
  }
}

function removeFromBulkPersonValue(uid, fieldId, personUid) {
  const field = visiblePersonFields.value.find(f => f.id === fieldId)
  const current = [...(Array.isArray(getBulkValue(uid, field)) ? getBulkValue(uid, field) : [])]
  setBulkValue(uid, fieldId, current.filter(u => u !== personUid))
}

// Team assignment helpers
function teamNamesForUid(uid) {
  const person = people.value.find(r => r.uid === uid)
  if (!person || !person.teamIds) return []
  return person.teamIds.map(id => teamById.value[id]?.name).filter(Boolean)
}

function getBulkTeamValue(uid) {
  if (uid in bulkTeamChanges) return bulkTeamChanges[uid]
  return teamNamesForUid(uid)
}

function setBulkTeamValue(uid, names) {
  const original = teamNamesForUid(uid)
  if (JSON.stringify([...names].sort()) === JSON.stringify([...original].sort())) {
    delete bulkTeamChanges[uid]
  } else {
    bulkTeamChanges[uid] = names
  }
}

async function saveTeamMemberChanges(uid, newNames) {
  const person = people.value.find(r => r.uid === uid)
  const oldIds = person?.teamIds || []
  const newIds = newNames.map(n => teamNameToId.value[n]).filter(Boolean)
  const toAdd = newIds.filter(id => !oldIds.includes(id))
  const toRemove = oldIds.filter(id => !newIds.includes(id))
  const ops = [
    ...toAdd.map(id =>
      apiRequest(`/modules/team-tracker/structure/teams/${id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      })
    ),
    ...toRemove.map(id =>
      apiRequest(`/modules/team-tracker/structure/teams/${id}/members/${uid}`, { method: 'DELETE' })
    )
  ]
  await Promise.all(ops)
}

async function saveAllChanges() {
  saving.value = true
  try {
    const changesByUid = {}
    for (const [key, value] of Object.entries(bulkChanges)) {
      const [uid, fieldId] = key.split('\0')
      if (!changesByUid[uid]) changesByUid[uid] = {}
      const field = visiblePersonFields.value.find(f => f.id === fieldId)
      let valueToSave = value
      if (field?.type !== 'constrained' || !field?.multiValue) {
        valueToSave = valueToSave || null
      }
      changesByUid[uid][fieldId] = valueToSave
    }
    await Promise.all([
      ...Object.entries(changesByUid).map(([uid, fields]) =>
        updatePersonFields(uid, fields)
      ),
      ...Object.entries(bulkTeamChanges).map(([uid, names]) =>
        saveTeamMemberChanges(uid, names)
      )
    ])
    bulkEditing.value = false
    for (const key of Object.keys(bulkChanges)) delete bulkChanges[key]
    if (Object.keys(bulkTeamChanges).length > 0) reloadRoster()
    for (const key of Object.keys(bulkTeamChanges)) delete bulkTeamChanges[key]
    refresh()
  } finally {
    saving.value = false
  }
}

// --- People: single-cell editing ---

function startCellEdit(person, field) {
  const raw = person.customFields?.[field.id] ?? null
  if (field.type === 'constrained' && field.multiValue) {
    editValue.value = Array.isArray(raw) ? [...raw] : (raw ? [raw] : [])
  } else if (field.type === 'person-reference-linked') {
    editValue.value = (Array.isArray(raw) ? raw[0] : raw) || ''
  } else {
    editValue.value = Array.isArray(raw) ? (raw[0] || '') : (raw || '')
  }
  editingCell.value = { uid: person.uid, fieldId: field.id }
}

async function saveCell(uid, fieldId) {
  saving.value = true
  try {
    const field = visiblePersonFields.value.find(f => f.id === fieldId)
    let valueToSave = editValue.value
    if (field?.type !== 'constrained' || !field?.multiValue) {
      valueToSave = valueToSave || null
    }
    await updatePersonFields(uid, { [fieldId]: valueToSave })
    editingCell.value = { uid: null, fieldId: null }
    refresh()
  } finally {
    saving.value = false
  }
}

function cancelEdit() {
  editingCell.value = { uid: null, fieldId: null }
}

function addToEditPersonValue(personUid) {
  if (personUid && Array.isArray(editValue.value) && !editValue.value.includes(personUid)) {
    editValue.value = [...editValue.value, personUid]
  }
}

function removeFromEditPersonValue(personUid) {
  if (Array.isArray(editValue.value)) {
    editValue.value = editValue.value.filter(u => u !== personUid)
  }
}

function startTeamEdit(person) {
  editingTeamUid.value = person.uid
  editTeamValue.value = [...teamNamesForUid(person.uid)]
}

async function saveTeamEdit(uid) {
  saving.value = true
  try {
    await saveTeamMemberChanges(uid, editTeamValue.value)
    editingTeamUid.value = null
    reloadRoster()
    refresh()
  } finally {
    saving.value = false
  }
}

// --- Teams: single-cell editing ---

function isMultiValueField(field) {
  return (field.type === 'constrained' && field.multiValue) || field.type === 'person-reference-linked'
}

function startTeamFieldEdit(team, field) {
  const raw = team.metadata[field.id] ?? null
  if (isMultiValueField(field)) {
    editTeamFieldValue.value = Array.isArray(raw) ? [...raw] : (raw ? [raw] : [])
  } else {
    editTeamFieldValue.value = Array.isArray(raw) ? (raw[0] || '') : (raw || '')
  }
  editingTeamCell.value = { teamId: team.id, fieldId: field.id }
}

async function saveTeamFieldCell(teamId, fieldId) {
  saving.value = true
  try {
    const field = visibleTeamFields.value.find(f => f.id === fieldId)
    let valueToSave = editTeamFieldValue.value
    if (!field || !isMultiValueField(field)) {
      valueToSave = valueToSave || null
    }
    await updateTeamFields(teamId, { [fieldId]: valueToSave })
    editingTeamCell.value = { teamId: null, fieldId: null }
    refresh()
  } finally {
    saving.value = false
  }
}

function cancelTeamFieldEdit() {
  editingTeamCell.value = { teamId: null, fieldId: null }
}

function addToEditTeamFieldValue(uid) {
  if (uid && Array.isArray(editTeamFieldValue.value) && !editTeamFieldValue.value.includes(uid)) {
    editTeamFieldValue.value = [...editTeamFieldValue.value, uid]
  }
}

// --- Teams: bulk editing ---

const teamPendingChangeCount = computed(() => Object.keys(teamBulkChanges).length)

function enterTeamBulkEdit() {
  teamBulkEditing.value = true
  for (const key of Object.keys(teamBulkChanges)) delete teamBulkChanges[key]
}

function cancelTeamBulkEdit() {
  teamBulkEditing.value = false
  for (const key of Object.keys(teamBulkChanges)) delete teamBulkChanges[key]
}

function teamBulkKey(teamId, fieldId) {
  return `${teamId}\0${fieldId}`
}

function getTeamBulkValue(teamId, field) {
  const key = teamBulkKey(teamId, field.id)
  if (key in teamBulkChanges) return teamBulkChanges[key]
  const raw = teams.value.find(t => t.id === teamId)?.metadata[field.id] ?? null
  if (isMultiValueField(field)) {
    return Array.isArray(raw) ? raw : (raw ? [raw] : [])
  }
  return Array.isArray(raw) ? (raw[0] || '') : (raw || '')
}

function setTeamBulkValue(teamId, fieldId, value) {
  const key = teamBulkKey(teamId, fieldId)
  const team = teams.value.find(t => t.id === teamId)
  const original = team?.metadata[fieldId] ?? null
  const field = visibleTeamFields.value.find(f => f.id === fieldId)

  let originalNormalized
  if (field && isMultiValueField(field)) {
    originalNormalized = Array.isArray(original) ? original : (original ? [original] : [])
  } else {
    originalNormalized = Array.isArray(original) ? (original[0] || '') : (original || '')
  }

  if (JSON.stringify(value) === JSON.stringify(originalNormalized)) {
    delete teamBulkChanges[key]
  } else {
    teamBulkChanges[key] = value
  }
}

function addToTeamBulkPersonValue(teamId, fieldId, uid) {
  if (!uid) return
  const current = [...getTeamBulkValue(teamId, { id: fieldId, type: 'person-reference-linked' })]
  if (!current.includes(uid)) {
    current.push(uid)
    setTeamBulkValue(teamId, fieldId, current)
  }
}

function removeFromTeamBulkPersonValue(teamId, fieldId, uid) {
  const current = [...getTeamBulkValue(teamId, { id: fieldId, type: 'person-reference-linked' })]
  setTeamBulkValue(teamId, fieldId, current.filter(u => u !== uid))
}

async function saveAllTeamChanges() {
  saving.value = true
  try {
    const changesByTeam = {}
    for (const [key, value] of Object.entries(teamBulkChanges)) {
      const [teamId, fieldId] = key.split('\0')
      if (!changesByTeam[teamId]) changesByTeam[teamId] = {}
      const field = visibleTeamFields.value.find(f => f.id === fieldId)
      let valueToSave = value
      if (!field || !isMultiValueField(field)) {
        valueToSave = valueToSave || null
      }
      changesByTeam[teamId][fieldId] = valueToSave
    }

    await Promise.all(
      Object.entries(changesByTeam).map(([teamId, fields]) =>
        updateTeamFields(teamId, fields)
      )
    )

    teamBulkEditing.value = false
    for (const key of Object.keys(teamBulkChanges)) delete teamBulkChanges[key]
    refresh()
  } finally {
    saving.value = false
  }
}

// --- Navigation ---

function navigateToPersonDetail(uid) {
  if (nav) nav.navigateTo('person-detail', { uid })
}

function navigateToTeamDetail(team) {
  if (nav) nav.navigateTo('team-detail', { teamKey: `${team.orgKey}::${team.name}` })
}

// --- Reset filters on org change ---
watch(selectedOrg, () => {
  selectedTeam.value = ''
})

// --- Lifecycle ---
onMounted(() => {
  load()
})
</script>
