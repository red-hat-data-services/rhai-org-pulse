const path = require('path');
const { startServer } = require('@org-pulse/core/server');

startServer({
  dataDir: path.join(__dirname, '..', 'data'),
  modulePaths: [path.join(__dirname, '..', 'modules')],
  platformPaths: [path.join(__dirname, '..', 'platform')],
  fixturesDirs: [
    path.join(__dirname, '..', 'fixtures'),
    path.join(__dirname, '..', 'node_modules', '@org-pulse', 'core', 'fixtures')
  ]
});
