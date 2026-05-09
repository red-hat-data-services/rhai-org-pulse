module.exports = {
  apps: [
    {
      name: 'rhai-org-pulse',
      script: 'npm',
      args: 'run dev:full',
      cwd: __dirname,
      interpreter: 'none',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
}
