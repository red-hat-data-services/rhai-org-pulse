/**
 * GitLab CI Pipeline integration for Jira issue classification.
 *
 * Handles:
 * - Triggering pipelines for test/bulk classification
 * - Managing GitLab pipeline schedules for auto-classification
 * - Fetching pipeline status and results
 */

const fetch = require('node-fetch');

const GITLAB_API_BASE = 'https://gitlab.com/api/v4';

/**
 * Get GitLab configuration from environment
 */
function getGitLabConfig() {
  const projectId = process.env.GITLAB_CLASSIFIER_PROJECT_ID;
  const triggerToken = process.env.GITLAB_CLASSIFIER_TRIGGER_TOKEN;
  const orgPulseUrl = process.env.ORG_PULSE_URL;
  const gitlabToken = process.env.GITLAB_TOKEN;

  if (!projectId || !triggerToken) {
    throw new Error('GitLab classifier not configured: missing GITLAB_CLASSIFIER_PROJECT_ID or GITLAB_CLASSIFIER_TRIGGER_TOKEN');
  }

  return {
    projectId,
    triggerToken,
    orgPulseUrl,
    gitlabToken
  };
}

/**
 * Trigger a GitLab pipeline
 *
 * @param {Object} params
 * @param {string} params.jql - JQL query
 * @param {boolean} params.dryRun - Dry run mode
 * @param {number} params.limit - Max issues to process
 * @param {number} params.lookbackHours - Lookback window (for scheduled)
 * @returns {Promise<Object>} Pipeline info
 */
async function triggerPipeline({ jql, dryRun = true, limit = 100, lookbackHours = 12 }) {
  const config = getGitLabConfig();

  const variables = {
    DRY_RUN: String(dryRun),
    LIMIT: String(limit),
    LOOKBACK_HOURS: String(lookbackHours)
  };

  // Only include JQL if provided (scheduled pipelines auto-generate it)
  if (jql) {
    variables.JQL = jql;
  }

  const response = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/trigger/pipeline`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.triggerToken,
        ref: 'main',
        variables
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger pipeline: ${response.status} ${text}`);
  }

  const pipeline = await response.json();

  return {
    pipelineId: pipeline.id,
    pipelineUrl: pipeline.web_url,
    status: pipeline.status,
    ref: pipeline.ref,
    triggeredAt: new Date().toISOString()
  };
}

/**
 * Get pipeline status
 *
 * @param {number} pipelineId
 * @returns {Promise<Object>} Pipeline status
 */
async function getPipelineStatus(pipelineId) {
  const config = getGitLabConfig();

  if (!config.gitlabToken) {
    throw new Error('GITLAB_TOKEN required to fetch pipeline status');
  }

  const response = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/pipelines/${pipelineId}`,
    {
      headers: { 'PRIVATE-TOKEN': config.gitlabToken }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch pipeline status: ${response.status}`);
  }

  return await response.json();
}

/**
 * Download pipeline artifact (classification results)
 *
 * @param {number} pipelineId
 * @returns {Promise<Object>} Classification results
 */
async function downloadArtifact(pipelineId) {
  const config = getGitLabConfig();

  if (!config.gitlabToken) {
    throw new Error('GITLAB_TOKEN required to download artifacts');
  }

  // Get jobs for this pipeline
  const jobsResponse = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/pipelines/${pipelineId}/jobs`,
    {
      headers: { 'PRIVATE-TOKEN': config.gitlabToken }
    }
  );

  if (!jobsResponse.ok) {
    throw new Error(`Failed to fetch pipeline jobs: ${jobsResponse.status}`);
  }

  const jobs = await jobsResponse.json();
  const classifyJob = jobs.find(j => j.name === 'classify-jira-issues');

  if (!classifyJob) {
    throw new Error('No classify-jira-issues job found in pipeline');
  }

  // Download artifact
  const artifactResponse = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/jobs/${classifyJob.id}/artifacts/classification-results.json`,
    {
      headers: { 'PRIVATE-TOKEN': config.gitlabToken }
    }
  );

  if (!artifactResponse.ok) {
    throw new Error(`Failed to download artifact: ${artifactResponse.status}`);
  }

  return await artifactResponse.json();
}

/**
 * Convert frequency to cron expression
 *
 * @param {string} frequency - 'hourly', 'every-6-hours', 'every-12-hours', 'daily'
 * @returns {string} Cron expression
 */
function frequencyToCron(frequency) {
  // Use off-minute times to avoid :00 and :30 (per AGENTS.md)
  switch (frequency) {
    case 'hourly':
      return '7 * * * *'; // Every hour at :07
    case 'every-6-hours':
      return '12 */6 * * *'; // Every 6 hours at :12
    case 'every-12-hours':
      return '23 */12 * * *'; // Every 12 hours at :23
    case 'daily':
      return '47 2 * * *'; // Daily at 2:47 AM
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }
}

/**
 * Create or update a GitLab pipeline schedule
 *
 * @param {Object} params
 * @param {string} params.frequency - Frequency identifier
 * @param {number} params.lookbackHours - Lookback window
 * @param {boolean} params.enabled - Schedule enabled
 * @returns {Promise<Object>} Schedule info
 */
async function upsertSchedule({ frequency, lookbackHours, enabled }) {
  const config = getGitLabConfig();

  if (!config.gitlabToken) {
    throw new Error('GITLAB_TOKEN required to manage pipeline schedules');
  }

  const cron = frequencyToCron(frequency);

  // List existing schedules
  const listResponse = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/pipeline_schedules`,
    {
      headers: { 'PRIVATE-TOKEN': config.gitlabToken }
    }
  );

  if (!listResponse.ok) {
    throw new Error(`Failed to list schedules: ${listResponse.status}`);
  }

  const schedules = await listResponse.json();
  const existingSchedule = schedules.find(s => s.description === 'Auto-classification');

  const scheduleData = {
    description: 'Auto-classification',
    ref: 'main',
    cron,
    cron_timezone: 'UTC',
    active: enabled
  };

  if (existingSchedule) {
    // Update existing schedule
    const updateResponse = await fetch(
      `${GITLAB_API_BASE}/projects/${config.projectId}/pipeline_schedules/${existingSchedule.id}`,
      {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': config.gitlabToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      }
    );

    if (!updateResponse.ok) {
      const text = await updateResponse.text();
      throw new Error(`Failed to update schedule: ${updateResponse.status} ${text}`);
    }

    const schedule = await updateResponse.json();

    // Update schedule variables
    await updateScheduleVariable(schedule.id, 'DRY_RUN', 'false');
    await updateScheduleVariable(schedule.id, 'LIMIT', '1000');
    await updateScheduleVariable(schedule.id, 'LOOKBACK_HOURS', String(lookbackHours));

    return {
      scheduleId: schedule.id,
      cron: schedule.cron,
      active: schedule.active,
      nextRun: schedule.next_run_at
    };
  } else {
    // Create new schedule
    const createResponse = await fetch(
      `${GITLAB_API_BASE}/projects/${config.projectId}/pipeline_schedules`,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': config.gitlabToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      }
    );

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Failed to create schedule: ${createResponse.status} ${text}`);
    }

    const schedule = await createResponse.json();

    // Create schedule variables
    await createScheduleVariable(schedule.id, 'DRY_RUN', 'false');
    await createScheduleVariable(schedule.id, 'LIMIT', '1000');
    await createScheduleVariable(schedule.id, 'LOOKBACK_HOURS', String(lookbackHours));

    return {
      scheduleId: schedule.id,
      cron: schedule.cron,
      active: schedule.active,
      nextRun: schedule.next_run_at
    };
  }
}

/**
 * Create a schedule variable
 */
async function createScheduleVariable(scheduleId, key, value) {
  const config = getGitLabConfig();

  const response = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/pipeline_schedules/${scheduleId}/variables`,
    {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': config.gitlabToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key, value })
    }
  );

  if (!response.ok) {
    // Variable might already exist, try update
    return await updateScheduleVariable(scheduleId, key, value);
  }

  return await response.json();
}

/**
 * Update a schedule variable
 */
async function updateScheduleVariable(scheduleId, key, value) {
  const config = getGitLabConfig();

  const response = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/pipeline_schedules/${scheduleId}/variables/${key}`,
    {
      method: 'PUT',
      headers: {
        'PRIVATE-TOKEN': config.gitlabToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update schedule variable ${key}: ${response.status} ${text}`);
  }

  return await response.json();
}

/**
 * Get the current schedule configuration
 */
async function getSchedule() {
  const config = getGitLabConfig();

  if (!config.gitlabToken) {
    return null;
  }

  const listResponse = await fetch(
    `${GITLAB_API_BASE}/projects/${config.projectId}/pipeline_schedules`,
    {
      headers: { 'PRIVATE-TOKEN': config.gitlabToken }
    }
  );

  if (!listResponse.ok) {
    return null;
  }

  const schedules = await listResponse.json();
  const schedule = schedules.find(s => s.description === 'Auto-classification');

  if (!schedule) {
    return null;
  }

  return {
    scheduleId: schedule.id,
    cron: schedule.cron,
    active: schedule.active,
    nextRun: schedule.next_run_at
  };
}

module.exports = {
  triggerPipeline,
  getPipelineStatus,
  downloadArtifact,
  upsertSchedule,
  getSchedule,
  frequencyToCron
};
