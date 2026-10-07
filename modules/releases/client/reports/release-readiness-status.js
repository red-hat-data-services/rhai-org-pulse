const NO_WORK_RESOLUTIONS = new Set([
  "Won't Do",
  "Can't Do",
  'Obsolete',
  'Duplicate',
  'Cannot Reproduce'
])

export function isNoWorkResolution(resolution) {
  return !!resolution && NO_WORK_RESOLUTIONS.has(resolution)
}

export function isTaskComplete(task) {
  if (!task) return true
  if (isNoWorkResolution(task.resolution)) return false

  return (task.status_category || task.status) === 'Done'
}

export function getRequiredOpenTasks(data) {
  const openTasks = []
  const seenKeys = new Set()

  for (const breakdown of Object.values(data?.breakdowns || {})) {
    for (const phase of breakdown?.test_execution?.phases || []) {
      for (const task of phase.tasks || []) {
        // A task can appear in more than one breakdown when initiatives overlap.
        if (task.key && seenKeys.has(task.key)) continue
        if (task.key) seenKeys.add(task.key)
        if (!isTaskComplete(task)) openTasks.push(task)
      }
    }
  }

  return openTasks
}

export function isReleasedStatus(status) {
  return ['released', 'ga'].includes(String(status || '').trim().toLowerCase())
}

export function releaseDisplayStatus(data) {
  const status = data?.release_schedule?.status
  if (isReleasedStatus(status) && getRequiredOpenTasks(data).length > 0) {
    return 'Released with Open Tasks'
  }
  return status || ''
}
