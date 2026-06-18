'use strict';

const { DatasetIndex } = require('./dataset-index');

function loadAllDatasets(storage) {
  const datasets = {};
  const { readFromStorage, listStorageFiles, listStorageDirectories } = storage;

  const entries = listStorageDirectories('org-lens').sort();
  if (entries.length === 0) {
    console.warn('[org-lens] No org-lens directory found');
    return datasets;
  }

  console.log('[org-lens] Scanning for datasets in org-lens storage');

  for (const entry of entries) {
    if (entry.startsWith('.')) continue;

    const subFiles = listStorageFiles('org-lens/' + entry);
    if (subFiles.length === 0) continue;

    const summariesFile = subFiles.find(function(f) {
      return f.startsWith('people_summaries_');
    });
    if (!summariesFile) continue;

    const summariesData = readFromStorage('org-lens/' + entry + '/' + summariesFile);
    if (!summariesData) continue;

    const categoriesFile = subFiles.find(function(f) {
      return f.startsWith('people_categories_');
    });
    const categoriesData = categoriesFile
      ? readFromStorage('org-lens/' + entry + '/' + categoriesFile)
      : null;

    const projectsFile = subFiles.find(function(f) {
      return f.startsWith('projects_');
    });
    const projectsData = projectsFile
      ? readFromStorage('org-lens/' + entry + '/' + projectsFile)
      : null;

    try {
      datasets[entry] = new DatasetIndex(entry, summariesData, categoriesData, projectsData);
    } catch (err) {
      console.error('[org-lens] Failed to load dataset', entry, err.message);
    }
  }

  if (Object.keys(datasets).length > 0) {
    console.log('[org-lens] Ready —', Object.keys(datasets).length, 'dataset(s) loaded:', Object.keys(datasets).join(', '));
  } else {
    console.warn('[org-lens] No datasets found in org-lens storage');
  }

  return datasets;
}

function resolveDataset(datasets, datasetName) {
  const keys = Object.keys(datasets);
  if (keys.length === 0) {
    throw new Error('No datasets loaded. Ensure pipeline data is available.');
  }
  if (datasetName) {
    if (!datasets[datasetName]) {
      throw new Error('Dataset "' + datasetName + '" not found. Available: ' + keys.join(', '));
    }
    return datasets[datasetName];
  }
  if (keys.length === 1) return datasets[keys[0]];
  const sorted = keys.sort((a, b) => (datasets[b].people.length || 0) - (datasets[a].people.length || 0));
  return datasets[sorted[0]];
}

module.exports = { loadAllDatasets, resolveDataset };
