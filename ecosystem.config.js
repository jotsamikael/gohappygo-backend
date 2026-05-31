module.exports = {
  apps: [{
    name: 'gohappygo-api',
    script: 'dist/main.js',
    cwd: '/home/mikael/htdocs/api.gohappygo.fr/current',
    env_file: '/home/mikael/htdocs/api.gohappygo.fr/shared/.env.production',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
  }],
};