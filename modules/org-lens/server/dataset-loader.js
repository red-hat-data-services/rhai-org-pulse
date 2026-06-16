'use strict';

const fs = require('fs');
const path = require('path');
const { DatasetIndex } = require('./dataset-index');

function loadAllDatasets(dataDir) {
  const datasets = {};

  if (!fs.existsSync(dataDir) || !fs.statSync(dataDir).isDirectory()) {
    console.warn('[org-lens] Data directory does not exist:', dataDir);
    return datasets;
  }

  console.log('[org-lens] Scanning for datasets in:', dataDir);

  const entries = fs.readdirSync(dataDir).sort();
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const entryPath = path.join(dataDir, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;

    const summariesFiles = fs.readdirSync(entryPath)
      .filter(f => f.startsWith('people_summaries_') && f.endsWith('.json'));
    if (summariesFiles.length === 0) continue;

    const summariesPath = path.join(entryPath, summariesFiles[0]);
    const categoriesFiles = fs.readdirSync(entryPath)
      .filter(f => f.startsWith('people_categories_') && f.endsWith('.json'));
    const categoriesPath = categoriesFiles.length > 0 ? path.join(entryPath, categoriesFiles[0]) : null;
    const projectsFiles = fs.readdirSync(entryPath)
      .filter(f => f.startsWith('projects_') && f.endsWith('.json'));
    const projectsPath = projectsFiles.length > 0 ? path.join(entryPath, projectsFiles[0]) : null;

    try {
      datasets[entry] = new DatasetIndex(entry, summariesPath, categoriesPath, projectsPath);
    } catch (err) {
      console.error('[org-lens] Failed to load dataset', entry, err.message);
    }
  }

  if (Object.keys(datasets).length > 0) {
    console.log('[org-lens] Ready —', Object.keys(datasets).length, 'dataset(s) loaded:', Object.keys(datasets).join(', '));
  } else {
    console.warn('[org-lens] No datasets found in', dataDir);
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
  throw new Error('Multiple datasets loaded (' + keys.join(', ') + '). Specify which one.');
}

module.exports = { loadAllDatasets, resolveDataset };
