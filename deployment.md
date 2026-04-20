# Deployment Guide (Free 24/7 Uptime)

This guide outlines how to host your WXATA backend for free with 24/7 uptime using Koyeb and UptimeRobot. 
Other free tiers (like Render or Railway) put your server to sleep, but this combination bypasses that.

## 1. Prepare for Deployment
1. Ensure your bot data is pushed to a GitHub repository (excluding `botinfo.json` if it contains sensitive info, although Koyeb handles volumes).
2. Change your start script in `backend/package.json` to properly initialize the Bun process, e.g., `bun run index.ts`.

## 2. Deploy to Koyeb
[Koyeb](https://www.koyeb.com/) offers a free tier (1 service) with Docker natively.
1. Sign up for Koyeb using your GitHub account.
2. Go to the dashboard and create a new Web Service.
3. Choose **GitHub** and select your WXATA repository.
4. Set the builder to **Dockerfile** (if you have one) or **Buildpack**. Bun works out-of-the-box with Node buildpacks or a simple Dockerfile.
5. In the Environment Variables, add any necessary overrides (if you extract configs from `botinfo.json`).
6. Complete the setup. Note your assigned Koyeb domain (e.g., `wxata-bot-xyz.koyeb.app`).

## 3. Keep it Alive 24/7 (UptimeRobot)
To ensure the backend does not sleep from inactivity:
1. Sign up at [UptimeRobot](https://uptimerobot.com/).
2. Create a new Monitor.
3. Type: `HTTP(s)`
4. Name: `WXATA Bot`
5. URL: `<Your Koyeb URL>` (e.g., `https://wxata-bot-xyz.koyeb.app`)
6. Monitoring Interval: `5 minutes`
7. Click **Create Monitor**.

## 4. Frontend Deployment (Vercel)
For the frontend, the best free host is [Vercel](https://vercel.com/):
1. Import your GitHub repository to Vercel.
2. Set the Root Directory to `frontend`.
3. Vercel automatically detects Vite and sets the build command to `npm run build`.
4. Deploy.

Your frontend is now live and can connect to your deployed backend URL.
