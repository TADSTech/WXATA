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
      interpreter: '/home/ubuntu/.bun/bin/bun',
      interpreter_args: 'run',

      // Environment
      env: {
        NODE_ENV: 'production',
        PORT: '5000',
        // /data is the persistent volume mount point (Docker & Render disk).
        // connection.ts and index.ts already check for /data automatically.
      },

      // Restart policy
      // max_restarts is intentionally high — the bot should ALWAYS come back.
      // PM2 uses exponential backoff via restart_delay so it won't spin-loop.
      autorestart: true,
      watch: false,
      max_restarts: 50,          // was 10 — too low, caused permanent death after crash bursts
      min_uptime: '10s',         // process must stay up 10s to count as a successful start
      restart_delay: 5000,       // wait 5s between restarts (prevents spin-loop)
      exp_backoff_restart_delay: 100, // exponential backoff: 100ms → doubles each restart up to restart_delay

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
