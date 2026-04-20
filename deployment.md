# Deployment Guide (Free Tier Alternatives)

Since Koyeb no longer offers a purely free tier suitable for long-running scripts without a credit card, you can use a combination of **Render** (for the backend) and **Cloudflare Pages / Vercel** (for the frontend).

## Important Warning: Ephemeral Storage
Free hosts like Render or Railway use **ephemeral filesystems**. When your server goes to sleep (after 15 minutes of inactivity) or deploys a new update, the local files are reset. 

* **What this means for WXATA:** Your WhatsApp connection data (`backend/auth_info`) mapping your bot to your phone might be erased on restart, requiring you to scan the QR code or use the pairing code again. 
* **Fix (Future):** You can update the Baileys auth state to save directly to Firebase Firestore instead of local files.

---

## 1. Frontend Deployment (Cloudflare Pages)
For your React/Vite dashboard, **Cloudflare Pages** is entirely free, incredibly fast, and doesn't sleep.

1. Push your code to GitHub.
2. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **Create application** -> **Pages**.
3. **Connect to Git** and select your WXATA repository.
4. **Build Settings:**
   - Framework preset: `Vite`
   - Build command: `bun run build` (or `npm run build`)
   - Build output directory: `dist`
   - Root directory: `frontend`
5. Click **Save and Deploy**.

---

## 2. Backend Deployment (Render)
[Render](https://render.com/) offers a robust free tier for Web Services capable of running Bun/Node backends.

1. Go to your Render Dashboard and click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. **Settings:**
   - Root Directory: `backend`
   - Environment: `Node` (or `Docker` if you add a Dockerfile for Bun)
   - Build Command: `bun install`
   - Start Command: `bun run index.ts`
4. **Free Tier:** Select the Free instance type.
5. Click **Create Web Service**.

> **Note:** Render needs an HTTP port bound to pass health checks. If WXATA is currently pure WebSocket/Baileys, ensure a fake HTTP listener is running on `process.env.PORT || 3000` to appease Render's deployment check.

---

## 3. Keeping the Backend Awake (UptimeRobot)
Render's free tier sleeps after 15 minutes of receiving no inbound traffic.

1. Sign up at [UptimeRobot](https://uptimerobot.com/).
2. Create a new Monitor.
3. **Type:** `HTTP(s)`
4. **URL:** `https://wxata.onrender.com`
5. **Interval:** `5 minutes`
6. Click **Create Monitor**.

This will ping your backend every 5 minutes, preventing Render from putting the WhatsApp bot to sleep.