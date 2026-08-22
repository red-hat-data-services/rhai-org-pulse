const CONFIG_KEY = 'ai-catalyst/board-config.json';

const DEFAULT_CONFIG = {
  sheetId: ''
};

async function getConfig(readFromStorage) {
  const saved = await readFromStorage(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...saved };
}

async function saveConfig(writeToStorage, config) {
  const merged = { ...DEFAULT_CONFIG };

  if (config.sheetId !== undefined) {
    if (typeof config.sheetId !== 'string') {
      throw new Error('sheetId must be a string');
    }
    merged.sheetId = config.sheetId.trim();
  }

  await writeToStorage(CONFIG_KEY, merged);
}

module.exports = { DEFAULT_CONFIG, getConfig, saveConfig, CONFIG_KEY };
