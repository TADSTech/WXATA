const API_BASE = (() => {
  const url = localStorage.getItem("wxata_backend_url");
  if (url) {
    try {
      const u = new URL(url);
      // Convert wss:// to https:// for REST API calls
      if (u.protocol === "wss:") u.protocol = "https:";
      else if (u.protocol === "ws:") u.protocol = "http:";
      return u.origin;
    } catch {}
  }
  // Fallback to backend server from env
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      if (u.protocol === "wss:") u.protocol = "https:";
      else if (u.protocol === "ws:") u.protocol = "http:";
      return u.origin;
    } catch {}
  }
  return window.location.origin;
})();

export interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  trigger: string;
  aliases: string[];
  type: string;
  target: string;
  response: string;
  code: string;
  default_argument: string;
  author_id: string;
  author_username: string;
  status: string;
  downloads: number;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MarketplaceUser {
  id: string;
  username: string;
  email: string;
  bio: string;
  created_at: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("wxata_marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchPlugins(params: Record<string, string> = {}): Promise<{ plugins: MarketplacePlugin[]; total: number }> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/marketplace/plugins?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch plugins");
  return res.json();
}

export async function fetchPlugin(id: string): Promise<{ plugin: MarketplacePlugin }> {
  const res = await fetch(`${API_BASE}/api/marketplace/plugins/${id}`);
  if (!res.ok) throw new Error("Plugin not found");
  return res.json();
}

export async function downloadPlugin(id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/marketplace/plugins/${id}/download`);
  if (!res.ok) throw new Error("Download failed");
  return res.blob();
}

export async function registerUser(username: string, email: string, password: string): Promise<{ user: MarketplaceUser; token: string }> {
  const res = await fetch(`${API_BASE}/api/marketplace/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
}

export async function loginUser(username: string, password: string): Promise<{ user: MarketplaceUser; token: string }> {
  const res = await fetch(`${API_BASE}/api/marketplace/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function publishPlugin(plugin: Partial<MarketplacePlugin>): Promise<{ plugin: MarketplacePlugin }> {
  const res = await fetch(`${API_BASE}/api/marketplace/plugins`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(plugin),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Publish failed");
  return data;
}

export async function fetchMyPlugins(): Promise<{ plugins: MarketplacePlugin[] }> {
  const res = await fetch(`${API_BASE}/api/marketplace/my-plugins`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch your plugins");
  return res.json();
}

export function getMarketplaceUser(): MarketplaceUser | null {
  const raw = localStorage.getItem("wxata_marketplace_user");
  return raw ? JSON.parse(raw) : null;
}

export function setMarketplaceUser(user: MarketplaceUser, token: string) {
  localStorage.setItem("wxata_marketplace_user", JSON.stringify(user));
  localStorage.setItem("wxata_marketplace_token", token);
}

export function clearMarketplaceUser() {
  localStorage.removeItem("wxata_marketplace_user");
  localStorage.removeItem("wxata_marketplace_token");
}
