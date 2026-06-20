// VPS template — copy to ~/htdocs/api.gohappygo.fr/shared/ecosystem.config.js
// Deploy workflow symlinks shared/.env.production into current/ on each release.
module.exports = {
  apps: [{
    name: 'gohappygo-api',
    script: 'dist/src/main.js',
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
