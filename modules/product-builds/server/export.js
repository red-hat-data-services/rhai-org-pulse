const { getConfig } = require('./index');

module.exports = async function productBuildsExport(addFile, storage) {
  const config = getConfig(storage.readFromStorage);
  if (!config || !config.baseUrl) return;

  addFile('product-builds/config.json', { baseUrl: 'https://api.example.com' });
};
