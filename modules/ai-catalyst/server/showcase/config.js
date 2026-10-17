const CONFIG_KEY = 'ai-catalyst/showcase/config.json';

const DEFAULT_CONFIG = {
  feedUrl: ''
};

async function getConfig(readFromStorage) {
  const saved = await readFromStorage(CONFIG_KEY);
  return { ...DEFAULT_CONFIG, ...saved };
}

async function saveConfig(writeToStorage, config) {
  const merged = { ...DEFAULT_CONFIG };

  if (config.feedUrl !== undefined) {
    if (typeof config.feedUrl !== 'string') {
      throw new Error('feedUrl must be a string');
    }
    merged.feedUrl = config.feedUrl.trim();
  }

  await writeToStorage(CONFIG_KEY, merged);
}

module.exports = { DEFAULT_CONFIG, getConfig, saveConfig, CONFIG_KEY };
