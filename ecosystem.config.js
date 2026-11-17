module.exports = {
  apps: [
    {
      name: 'profarm-shiraz',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max', // or specify number of cpu cores, e.g. 2
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
