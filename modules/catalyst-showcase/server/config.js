const CONFIG_KEY = 'catalyst-showcase/config.json';

const DEFAULT_CONFIG = {
  sheetId: ''
};

function getConfig(readFromStorage) {
  const saved = readFromStorage(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...saved };
}

function saveConfig(writeToStorage, config) {
  const merged = { ...DEFAULT_CONFIG };

  if (config.sheetId !== undefined) {
    if (typeof config.sheetId !== 'string') {
      throw new Error('sheetId must be a string');
    }
    merged.sheetId = config.sheetId.trim();
  }

  writeToStorage(CONFIG_KEY, merged);
}

module.exports = { DEFAULT_CONFIG, getConfig, saveConfig, CONFIG_KEY };
