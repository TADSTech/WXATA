/**
 * PM2 Ecosystem Config for WXATA
 *
 * Docker:  CMD ["pm2-runtime", "ecosystem.config.cjs"]  (no-daemon mode)
 * Bare VPS: pm2 start ecosystem.config.cjs
 *
 * Exit code semantics (see backend/index.ts QUICK_ACTION handler):
 *   0  → restart requested by dashboard  → PM2 restarts automatically
 *   1  → unhandled crash                 → PM2 restarts automatically
 *   2  → terminate requested by dashboard → PM2 stops, does NOT restart
 */

module.exports = {
  apps: [
    {
      name: 'wxata',

      // Path is relative to this file's location (repo/project root)
      script: 'backend/index.ts',

      // Bun as the TypeScript interpreter
      interpreter: 'bun',
      interpreter_args: 'run',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: '5000',
        // /data is the persistent volume mount point (Docker & Render disk).
        // connection.ts and index.ts already check for /data automatically.
      },

      // Restart policy
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,

      // Exit code 2 = intentional stop from dashboard → do NOT restart
      stop_exit_codes: [2],

      // Logs (relative to cwd, which is the repo root)
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
