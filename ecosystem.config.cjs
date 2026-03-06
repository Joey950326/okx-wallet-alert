module.exports = {
  apps: [
    {
      name: "okx-wallet-alert",
      cwd: "C:/Users/Joey/code/projects/okx-wallet-alert",
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
}
