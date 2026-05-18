const fs = require('fs');
const path = require('path');

function createEventStore(dataDir) {
  const eventsDir = path.join(dataDir, 'health-metrics', 'events');

  let isPruning = false;
  let pruneBuffer = [];

  function ensureEventsDir() {
    if (!fs.existsSync(eventsDir)) {
      fs.mkdirSync(eventsDir, { recursive: true });
    }
  }

  function getMonthKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function getFilePath(monthKey) {
    return path.join(eventsDir, `${monthKey}.jsonl`);
  }

  function append(event) {
    if (isPruning) {
      pruneBuffer.push(event);
      return;
    }
    ensureEventsDir();
    const monthKey = getMonthKey(event.ts);
    const filePath = getFilePath(monthKey);
    fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
  }

  function readMonth(monthKey) {
    const filePath = getFilePath(monthKey);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try { return JSON.parse(line); }
          catch { return null; }
        })
        .filter(Boolean);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  function listMonthFiles() {
    try {
      return fs.readdirSync(eventsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => f.replace('.jsonl', ''))
        .sort();
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  function deleteMonthFile(monthKey) {
    const filePath = getFilePath(monthKey);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  function rewriteMonth(monthKey, events) {
    ensureEventsDir();
    const filePath = getFilePath(monthKey);
    if (events.length === 0) {
      try { fs.unlinkSync(filePath); } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
      return;
    }
    const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(filePath, content);
  }

  function startPruning() {
    isPruning = true;
    pruneBuffer = [];
  }

  function finishPruning() {
    isPruning = false;
    if (pruneBuffer.length > 0) {
      ensureEventsDir();
      for (const event of pruneBuffer) {
        const monthKey = getMonthKey(event.ts);
        const filePath = getFilePath(monthKey);
        fs.appendFileSync(filePath, JSON.stringify(event) + '\n');
      }
      pruneBuffer = [];
    }
  }

  function deleteAllEvents() {
    try {
      const files = fs.readdirSync(eventsDir);
      for (const f of files) {
        if (f.endsWith('.jsonl')) {
          fs.unlinkSync(path.join(eventsDir, f));
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  return {
    append,
    readMonth,
    listMonthFiles,
    deleteMonthFile,
    rewriteMonth,
    startPruning,
    finishPruning,
    deleteAllEvents,
    getMonthKey,
  };
}

module.exports = { createEventStore };
