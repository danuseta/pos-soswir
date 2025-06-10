
module.exports = {
  apps: [{
    name: 'soswir-pos-backend',
    script: 'index.js',
    cwd: __dirname,
    
    instances: process.env.NODE_ENV === 'production' ? 'max' : 1, 
    exec_mode: 'cluster',
    
    autorestart: true,
    watch: process.env.NODE_ENV === 'development' ? ['routes', 'models', 'utils', 'middleware'] : false,
    ignore_watch: ['node_modules', 'logs', '*.log', 'uploads'],
    watch_options: {
      followSymlinks: false,
      usePolling: false,
      interval: 1000,
      persistent: true,
      ignoreInitial: true
    },
    
    max_memory_restart: process.env.NODE_ENV === 'production' ? '768M' : '512M',
    instance_var: 'INSTANCE_ID',
    
    env: {
      NODE_ENV: 'development',
      PORT: 3001,
      DEBUG: 'app:*',
      UV_THREADPOOL_SIZE: 128,
      NODE_OPTIONS: '--max-old-space-size=512 --optimize-for-size'
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3001,
      DEBUG: 'app:info,app:warn,app:error'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      DEBUG: '',
      UV_THREADPOOL_SIZE: 256,
      NODE_OPTIONS: '--max-old-space-size=768 --enable-source-maps=false'
    },
    
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z [WIB]',
    merge_logs: true,
    log_type: 'json',
    
    max_restarts: 15,
    min_uptime: '30s',
    kill_timeout: 10000,
    listen_timeout: 10000,
    shutdown_with_message: true,
    wait_ready: true,
    
    node_args: [
      '--max-old-space-size=768',
      '--optimize-for-size',
      '--enable-source-maps=false',
      '--no-warnings',
      '--trace-warnings'
    ],
    
    pmx: true,
    source_map_support: false,
    disable_source_map_support: true,
    
    increment_var: 'PORT',
    
    instance_var: 'INSTANCE_ID',
    
    uid: process.platform !== 'win32' ? 'www-data' : undefined,
    gid: process.platform !== 'win32' ? 'www-data' : undefined,
    
    cron_restart: '0 2 * * *',
    
    monitoring: {
      http: true,
      https: false,
      port: process.env.MONITORING_PORT || 9615
    }
  }],
  
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server.soswir.com'],
      ref: 'origin/main',
      repo: 'git@github.com:soswir/pos-backend.git',
      path: '/var/www/soswir-pos/backend',
      ssh_options: 'StrictHostKeyChecking=no',
      'pre-deploy-local': 'echo "🚀 Starting production deployment..."',
      'post-deploy': [
        'echo "📦 Installing dependencies..."',
        'npm ci --only=production',
        'echo "🔄 Reloading PM2 processes..."',
        'pm2 reload ecosystem.config.js --env production',
        'echo "✅ Production deployment completed!"'
      ].join(' && '),
      'pre-setup': [
        'echo "🛠️ Setting up production environment..."',
        'mkdir -p logs uploads temp',
        'chmod 755 logs uploads temp'
      ].join(' && ')
    },
    
    staging: {
      user: 'deploy',
      host: ['staging-server.soswir.com'],
      ref: 'origin/staging',
      repo: 'git@github.com:soswir/pos-backend.git',
      path: '/var/www/soswir-pos-staging/backend',
      ssh_options: 'StrictHostKeyChecking=no',
      'post-deploy': [
        'npm ci',
        'pm2 reload ecosystem.config.js --env staging'
      ].join(' && ')
    },
    
    development: {
      user: 'dev',
      host: ['dev-server.soswir.com'],
      ref: 'origin/development',
      repo: 'git@github.com:soswir/pos-backend.git',
      path: '/var/www/soswir-pos-dev/backend',
      'post-deploy': [
        'npm install',
        'pm2 reload ecosystem.config.js --env development'
      ].join(' && ')
    }
  }
}; 