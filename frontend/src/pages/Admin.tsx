import { useState, useEffect } from "react";
import {
  listUserCodes,
  insertUserCode,
  updateUserCode,
  deleteUserCode,
  listAllExtensions,
  updateExtension,
  deleteExtension,
  listServiceConfig,
  upsertServiceConfig,
  listApiKeys,
} from "../firebase";

// Inline error banner component used throughout the admin panel
function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 mt-3 p-3 rounded text-sm bg-red-900/50 text-red-200 border border-red-500">
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-300 hover:text-red-100 ml-2 font-bold leading-none"
        >
          ✕
        </button>
      )}
    </div>
  );
}

interface UserCode {
  id: string;
  code: string;
  used: boolean;
  suspended: boolean;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
}

interface Extension {
  id: string;
  name: string;
  description: string;
  trigger: string;
  response: string;
  code?: string;
  author: string;
  authorUid: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  downloads: number;
  untrusted?: boolean;
  disabled?: boolean;
}

export default function Admin() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [codesList, setCodesList] = useState<UserCode[]>([]);
  const [pendingExtensions, setPendingExtensions] = useState<Extension[]>([]);
  const [approvedExtensions, setApprovedExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [extLoading, setExtLoading] = useState(true);

  // Edit Modal State
  const [adminEditingExt, setAdminEditingExt] = useState<Extension | null>(
    null,
  );
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    trigger: "",
    response: "",
    code: "",
  });

  // Simplified protection for the admin panel demonstration
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPass, setAdminPass] = useState("");

  // Inline error banners for codes and extensions operations
  const [codesError, setCodesError] = useState("");
  const [extError, setExtError] = useState("");
  const [editError, setEditError] = useState("");

  // License key generator state
  const [licenseUsername, setLicenseUsername] = useState("");
  const [generatedLicenseKey, setGeneratedLicenseKey] = useState("");
  const [licenseError, setLicenseError] = useState("");
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseCopied, setLicenseCopied] = useState(false);

  // API Service Config state
  const [serviceConfig, setServiceConfig] = useState<
    Array<{ key: string; value: string; description: string }>
  >([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [editingConfig, setEditingConfig] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<
    Array<{
      id: string;
      owner_email: string;
      owner_name: string;
      messages_sent: number;
      messages_limit: number;
      paid_credits: number;
      active: boolean;
      created_at: string;
    }>
  >([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeysError, setApiKeysError] = useState("");

  const fetchCodes = async () => {
    try {
      const data = await listUserCodes();
      const fetched: UserCode[] = (data || []).map((row: any) => ({
        id: row.id,
        code: row.code,
        used: row.used,
        suspended: row.suspended ?? false,
        createdAt: row.created_at,
        usedBy: row.used_by,
        usedAt: row.used_at,
      }));
      setCodesList(fetched);
    } catch (err: any) {
      setCodesError("Failed to fetch codes: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  };

  const fetchExtensions = async () => {
    try {
      const data = await listAllExtensions();
      const fetchedPending: Extension[] = [];
      const fetchedApproved: Extension[] = [];
      (data || []).forEach((row: any) => {
        const ext: Extension = {
          id: row.id,
          name: row.name,
          description: row.description,
          trigger: row.trigger,
          response: row.response,
          code: row.code,
          author: row.author,
          authorUid: row.author_uid,
          status: row.status,
          createdAt: row.created_at,
          downloads: row.downloads,
          untrusted: row.untrusted,
          disabled: row.disabled,
        };
        if (ext.status === "pending") fetchedPending.push(ext);
        if (ext.status === "approved") fetchedApproved.push(ext);
      });
      setPendingExtensions(fetchedPending);
      setApprovedExtensions(fetchedApproved);
    } catch (err: any) {
      setExtError(
        "Failed to fetch extensions: " + (err?.message ?? String(err)),
      );
    } finally {
      setExtLoading(false);
    }
  };

  const fetchServiceConfig = async () => {
    setConfigLoading(true);
    try {
      const data = await listServiceConfig();
      setServiceConfig(data || []);
    } catch (err: any) {
      setConfigError(
        "Failed to fetch config: " + (err?.message ?? String(err)),
      );
    } finally {
      setConfigLoading(false);
    }
  };

  const saveConfigValue = async (key: string, value: string) => {
    setConfigSaving(true);
    try {
      await upsertServiceConfig(key, value);
      setEditingConfig(null);
      fetchServiceConfig();
    } catch (err: any) {
      setConfigError("Failed to save config: " + (err?.message ?? String(err)));
    } finally {
      setConfigSaving(false);
    }
  };

  const fetchApiKeys = async () => {
    setApiKeysLoading(true);
    try {
      const data = await listApiKeys();
      setApiKeys(data || []);
    } catch (err: any) {
      setApiKeysError(
        "Failed to fetch API keys: " + (err?.message ?? String(err)),
      );
    } finally {
      setApiKeysLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchCodes();
      fetchExtensions();
      fetchServiceConfig();
      fetchApiKeys();
    }
  }, [isAdminUnlocked]);

  const handleExtStatus = async (
    id: string,
    status: "approved" | "rejected",
  ) => {
    try {
      await updateExtension(id, { status });
      fetchExtensions(); // Refresh the list
    } catch (e: any) {
      setExtError(
        "Failed to update extension status: " + (e?.message ?? String(e)),
      );
    }
  };

  const handleToggleExtField = async (
    id: string,
    field: "untrusted" | "disabled",
    currentValue: boolean | undefined,
  ) => {
    try {
      await updateExtension(id, { [field]: !currentValue });
      fetchExtensions();
    } catch (e: any) {
      setExtError("Failed to update extension: " + (e?.message ?? String(e)));
    }
  };

  const handleDeleteExt = async (id: string) => {
    if (
      confirm(
        "Are you sure you want to permanently delete this extension from the marketplace?",
      )
    ) {
      try {
        await deleteExtension(id);
        fetchExtensions();
      } catch (e: any) {
        setExtError("Failed to delete extension: " + (e?.message ?? String(e)));
      }
    }
  };

  const handleEditExtClick = (ext: Extension) => {
    setAdminEditingExt(ext);
    setEditForm({
      name: ext.name,
      description: ext.description,
      trigger: ext.trigger,
      response: ext.response || "",
      code: ext.code || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!adminEditingExt) return;
    try {
      await updateExtension(adminEditingExt.id, {
        name: editForm.name,
        description: editForm.description,
        trigger: editForm.trigger,
        response: editForm.response,
        code: editForm.code,
      });
      setAdminEditingExt(null);
      setEditError("");
      fetchExtensions();
    } catch (e: any) {
      setEditError("Failed to save edit: " + (e?.message ?? String(e)));
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPass = import.meta.env.VITE_ADMIN_PASS as string | undefined;
    // Falls back to ROOT_ACCESS if env var not set (dev convenience)
    if (adminPass === (correctPass || "ROOT_ACCESS")) {
      setIsAdminUnlocked(true);
    } else {
      alert("Unauthorized");
    }
  };

  const handleGenerateLicenseKey = async () => {
    if (!licenseUsername.trim()) return;
    setLicenseLoading(true);
    setLicenseError("");
    setGeneratedLicenseKey("");
    try {
      const backendUrl =
        (import.meta.env.VITE_BACKEND_URL as string | undefined)
          ?.replace(/^wss?:\/\//, "https://")
          ?.replace(/\/ws$/, "") ?? "http://localhost:5000";
      const res = await fetch(`${backendUrl}/admin/generate-license`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminPass}`,
        },
        body: JSON.stringify({ username: licenseUsername.trim() }),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as { key: string };
      setGeneratedLicenseKey(data.key);
    } catch (err: unknown) {
      setLicenseError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleCopyLicenseKey = () => {
    if (!generatedLicenseKey) return;
    navigator.clipboard.writeText(generatedLicenseKey);
    setLicenseCopied(true);
    setTimeout(() => setLicenseCopied(false), 2000);
  };

  const handleRevokeCode = async (id: string, currentSuspended: boolean) => {
    const action = currentSuspended ? "reinstate" : "suspend";
    if (
      !confirm(`${action === "suspend" ? "Suspend" : "Reinstate"} this code?`)
    )
      return;
    try {
      await updateUserCode(id, {
        suspended: !currentSuspended,
      });
      fetchCodes();
    } catch (e: any) {
      setCodesError("Failed to update code: " + (e?.message ?? String(e)));
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm("Permanently delete this code? This cannot be undone."))
      return;
    try {
      await deleteUserCode(id);
      fetchCodes();
    } catch (e: any) {
      setCodesError("Failed to delete code: " + (e?.message ?? String(e)));
    }
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "WX-";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const saveCode = async () => {
    if (!code) return;
    try {
      await insertUserCode({
        code,
        used: false,
        suspended: false,
        created_at: new Date().toISOString(),
      });
      setMessage(`Code ${code} saved successfully!`);
      setCode("");
      fetchCodes(); // Refresh the list
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  if (!isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-bg-base text-accent-primary flex items-center justify-center font-mono p-4">
        <div className="border border-border-strong p-8 bg-bg-base w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6 text-accent-light drop-shadow-[0_0_10px_var(--accent-subtle)]">
            ROOT ADMIN PANEL
          </h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Admin Passphrase"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              className="w-full bg-transparent border-b border-border-strong py-2 text-center text-text-main focus:outline-none focus:border-accent-light transition-colors"
            />
            <button
              type="submit"
              className="w-full border border-border-strong text-accent-light hover:bg-accent-primary hover:text-text-main py-3 transition-colors"
            >
              AUTHENTICATE
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-main p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-accent-light border-b border-border-subtle pb-4">
          WXATA Registration Manager
        </h1>

        {/* Code Generator Card */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg flex flex-col md:flex-row gap-6 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-indigo-400">
              Generate Access Code
            </h2>
            <p className="text-text-muted text-sm mb-4">
              Create a unique token to allow a new user to securely register on
              the platform.
            </p>
            <div className="flex items-center gap-4 mb-4">
              <input
                type="text"
                readOnly
                value={code}
                placeholder="Click generate ->"
                className="flex-1 bg-bg-base border border-border-subtle focus:border-border-strong text-accent-light px-4 py-3 rounded outline-none"
              />
              <button
                onClick={generateRandomCode}
                className="bg-accent-subtle hover:bg-accent-subtle text-accent-light px-6 py-3 rounded border border-border-strong transition-colors"
              >
                Generate
              </button>
            </div>
            <button
              onClick={saveCode}
              disabled={!code}
              className="w-full bg-accent-primary hover:bg-accent-hover text-text-main font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Push to Database
            </button>

            {message && (
              <div
                className={`mt-4 p-3 rounded text-sm ${message.startsWith("Error") ? "bg-red-900/50 text-red-200 border border-red-500" : "bg-accent-subtle text-accent-light border border-border-strong"}`}
              >
                {message}
              </div>
            )}
          </div>
        </div>

        {/* License Key Generator Card */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-indigo-400">
              Generate License Key
            </h2>
            <p className="text-text-muted text-sm mb-4">
              Generate a HMAC-signed license key for a buyer. Deliver this key
              to them for use in their{" "}
              <code className="text-accent-light">LICENSE_KEY</code> environment
              variable.
            </p>
            <div className="flex items-center gap-4 mb-4">
              <input
                type="text"
                value={licenseUsername}
                onChange={(e) => setLicenseUsername(e.target.value)}
                placeholder="Enter buyer username"
                className="flex-1 bg-bg-base border border-border-subtle focus:border-border-strong text-accent-light px-4 py-3 rounded outline-none"
              />
              <button
                onClick={handleGenerateLicenseKey}
                disabled={!licenseUsername.trim() || licenseLoading}
                className="bg-accent-subtle hover:bg-accent-subtle text-accent-light px-6 py-3 rounded border border-border-strong transition-colors disabled:opacity-50"
              >
                {licenseLoading ? "Generating..." : "Generate"}
              </button>
            </div>
            {generatedLicenseKey && (
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLicenseKey}
                  className="flex-1 bg-bg-base border border-border-subtle text-accent-light px-4 py-3 rounded outline-none font-mono text-xs"
                />
                <button
                  onClick={handleCopyLicenseKey}
                  className="bg-accent-subtle hover:bg-accent-subtle text-accent-light px-4 py-3 rounded border border-border-strong transition-colors text-sm"
                >
                  {licenseCopied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            )}
            {licenseError && (
              <div className="mt-2 p-3 rounded text-sm bg-red-900/50 text-red-200 border border-red-500">
                {licenseError}
              </div>
            )}
          </div>
        </div>

        {/* API Service Config */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <div className="flex items-center justify-between mb-4 border-b border-border-strong pb-3">
            <div>
              <h2 className="text-xl font-bold text-indigo-400">
                API Service Config
              </h2>
              <p className="text-text-muted text-xs mt-1">
                Configure the WhatsApp Send API service variables
              </p>
            </div>
            <button
              onClick={fetchServiceConfig}
              className="text-xs text-text-muted hover:text-accent-light border border-border-strong px-3 py-1 rounded transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
          {configError && (
            <ErrorBanner
              message={configError}
              onDismiss={() => setConfigError("")}
            />
          )}
          {configLoading ? (
            <p className="text-text-muted text-sm">Loading config...</p>
          ) : serviceConfig.length === 0 ? (
            <p className="text-text-muted text-sm">
              No config entries found. Make sure the service_config table exists
              in Supabase.
            </p>
          ) : (
            <div className="space-y-3">
              {serviceConfig.map((cfg) => (
                <div
                  key={cfg.key}
                  className="flex items-center gap-3 border border-border-strong/50 rounded-lg p-3 bg-bg-base/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-accent-light text-sm font-bold">
                      {cfg.key}
                    </div>
                    {cfg.description && (
                      <div className="text-text-muted text-xs mt-0.5">
                        {cfg.description}
                      </div>
                    )}
                  </div>
                  {editingConfig?.key === cfg.key ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingConfig.value}
                        onChange={(e) =>
                          setEditingConfig({
                            key: cfg.key,
                            value: e.target.value,
                          })
                        }
                        className="bg-bg-base border border-accent-primary text-accent-light px-3 py-1.5 rounded text-sm font-mono outline-none w-32"
                        autoFocus
                      />
                      <button
                        onClick={() =>
                          saveConfigValue(
                            editingConfig.key,
                            editingConfig.value,
                          )
                        }
                        disabled={configSaving}
                        className="text-xs bg-accent-primary hover:bg-accent-hover text-bg-base px-3 py-1.5 rounded font-bold disabled:opacity-50"
                      >
                        {configSaving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingConfig(null)}
                        className="text-xs text-text-muted hover:text-text-main px-2 py-1.5"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-text-main text-sm bg-bg-base border border-border-subtle px-3 py-1 rounded">
                        {cfg.value}
                      </span>
                      <button
                        onClick={() =>
                          setEditingConfig({ key: cfg.key, value: cfg.value })
                        }
                        className="text-xs text-text-muted hover:text-accent-light border border-border-strong px-3 py-1 rounded transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Issued Codes Register */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4 border-b border-border-strong pb-3">
            <h2 className="text-xl font-bold text-indigo-400">
              Issued Codes Register
            </h2>
            <button
              onClick={fetchCodes}
              className="text-xs text-text-muted hover:text-accent-light border border-border-strong px-3 py-1 rounded transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {codesError && (
            <ErrorBanner
              message={codesError}
              onDismiss={() => setCodesError("")}
            />
          )}

          {/* Stats summary */}
          {!loading &&
            codesList.length > 0 &&
            (() => {
              const total = codesList.length;
              const used = codesList.filter(
                (c) => c.used && !c.suspended,
              ).length;
              const available = codesList.filter(
                (c) => !c.used && !c.suspended,
              ).length;
              const suspended = codesList.filter((c) => c.suspended).length;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    {
                      label: "Total",
                      value: total,
                      color: "text-text-main",
                      bg: "bg-bg-base border-border-strong",
                    },
                    {
                      label: "Available",
                      value: available,
                      color: "text-green-400",
                      bg: "bg-green-500/10 border-green-500/30",
                    },
                    {
                      label: "Used",
                      value: used,
                      color: "text-blue-400",
                      bg: "bg-blue-500/10 border-blue-500/30",
                    },
                    {
                      label: "Suspended",
                      value: suspended,
                      color: "text-red-400",
                      bg: "bg-red-500/10 border-red-500/30",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`border rounded-lg p-3 text-center ${s.bg}`}
                    >
                      <div className={`text-2xl font-black ${s.color}`}>
                        {s.value}
                      </div>
                      <div className="text-xs text-text-muted uppercase tracking-widest mt-0.5">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

          {loading ? (
            <p className="text-text-muted">Loading token database...</p>
          ) : codesList.length === 0 ? (
            <p className="text-text-muted">No codes issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-strong text-xs uppercase tracking-wider">
                    <th className="py-3 px-2">Access Token</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Claimed By</th>
                    <th className="py-3 px-2">Used At</th>
                    <th className="py-3 px-2">Created</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codesList.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border-strong/30 hover:bg-bg-panel-hover/30 transition-colors"
                    >
                      <td className="py-3 px-2 font-mono font-bold text-accent-light tracking-wider">
                        {c.code}
                      </td>
                      <td className="py-3 px-2">
                        {c.suspended ? (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-xs font-bold">
                            SUSPENDED
                          </span>
                        ) : c.used ? (
                          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-1 rounded text-xs font-bold">
                            USED
                          </span>
                        ) : (
                          <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs font-bold">
                            AVAILABLE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-text-muted text-xs font-mono">
                        {c.usedBy || <span className="opacity-30">—</span>}
                      </td>
                      <td className="py-3 px-2 text-text-muted text-xs">
                        {c.usedAt ? (
                          new Date(c.usedAt).toLocaleString()
                        ) : (
                          <span className="opacity-30">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-text-muted text-xs">
                        {new Date(c.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right space-x-1">
                        <button
                          onClick={() => handleRevokeCode(c.id, c.suspended)}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                            c.suspended
                              ? "bg-green-900/30 text-green-400 border-green-500/50 hover:bg-green-800/50"
                              : "bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-800/50"
                          }`}
                        >
                          {c.suspended ? "Reinstate" : "Suspend"}
                        </button>
                        <button
                          onClick={() => handleDeleteCode(c.id)}
                          className="text-[10px] bg-red-900/30 hover:bg-red-800/50 border border-red-500/50 text-red-400 px-2 py-1 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Extensions List */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-indigo-400 border-b border-border-strong pb-2">
            Pending Marketplace Extensions
          </h2>
          {extError && (
            <ErrorBanner message={extError} onDismiss={() => setExtError("")} />
          )}
          {extLoading ? (
            <p className="text-text-muted">Loading extensions database...</p>
          ) : pendingExtensions.length === 0 ? (
            <p className="text-text-muted">
              No pending extensions awaiting approval.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-strong">
                    <th className="py-3 px-2">Name / Desc</th>
                    <th className="py-3 px-2">Trigger & Response</th>
                    <th className="py-3 px-2">Author (UID)</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingExtensions.map((ext) => (
                    <tr
                      key={ext.id}
                      className="border-b border-border-strong/50 hover:bg-bg-panel-hover/30"
                    >
                      <td className="py-3 px-2">
                        <div className="font-bold text-accent-light">
                          {ext.name}
                        </div>
                        <div className="text-text-muted text-xs truncate max-w-xs">
                          {ext.description}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs">
                          <span className="text-text-muted">Trigger:</span>{" "}
                          <span className="font-mono text-accent-light px-1">
                            !{ext.trigger}
                          </span>
                          <br />
                          <span className="text-text-muted">Resp:</span>{" "}
                          <span className="font-mono text-text-muted">
                            {ext.response || "<script>"}
                          </span>
                        </div>
                        {ext.code && (
                          <div className="text-green-500 text-[10px] mt-1">
                            Contains JS Code
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-text-muted">
                        {ext.author}
                        <br />
                        <span className="font-mono text-[10px] opacity-50">
                          {ext.authorUid}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right space-x-2">
                        <button
                          onClick={() => handleEditExtClick(ext)}
                          className="text-xs bg-accent-subtle hover:bg-accent-subtle border border-border-strong text-accent-light px-3 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleExtStatus(ext.id, "approved")}
                          className="text-xs bg-green-900/30 hover:bg-green-800/50 border border-green-500/50 text-green-400 px-3 py-1 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeleteExt(ext.id)}
                          className="text-xs bg-red-900/30 hover:bg-red-800/50 border border-red-500/50 text-red-400 px-3 py-1 rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Approved Marketplace Extensions */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-accent-light border-b border-border-strong pb-2">
            Active Marketplace Extensions
          </h2>
          {extError && (
            <ErrorBanner message={extError} onDismiss={() => setExtError("")} />
          )}
          {extLoading ? (
            <p className="text-text-muted">Loading extensions database...</p>
          ) : approvedExtensions.length === 0 ? (
            <p className="text-text-muted">No approved extensions exist yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-strong">
                    <th className="py-3 px-2">Extension</th>
                    <th className="py-3 px-2">Status Tags</th>
                    <th className="py-3 px-2 text-right">Admin Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedExtensions.map((ext) => (
                    <tr
                      key={ext.id}
                      className="border-b border-border-strong/50 hover:bg-bg-panel-hover/30"
                    >
                      <td className="py-3 px-2">
                        <div className="font-bold text-accent-light">
                          {ext.name}
                        </div>
                        <div className="text-text-muted text-xs">
                          Installs: {ext.downloads || 0}
                        </div>
                      </td>
                      <td className="py-3 px-2 space-y-1">
                        {ext.untrusted && (
                          <span className="inline-block bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[10px] font-bold mr-2">
                            ⚠️ UNTRUSTED
                          </span>
                        )}
                        {ext.disabled ? (
                          <span className="inline-block bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                            INSTALL DISABLED
                          </span>
                        ) : (
                          <span className="inline-block bg-accent-subtle text-accent-light border border-border-strong px-2 py-0.5 rounded text-[10px] font-bold">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex flex-col gap-1 items-end">
                          <div className="space-x-1">
                            <button
                              onClick={() =>
                                handleToggleExtField(
                                  ext.id,
                                  "untrusted",
                                  ext.untrusted,
                                )
                              }
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${ext.untrusted ? "bg-bg-panel-hover text-text-muted border-gray-600" : "bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-800/50"}`}
                            >
                              {ext.untrusted
                                ? "Mark Trusted"
                                : "Mark Untrusted"}
                            </button>
                            <button
                              onClick={() =>
                                handleToggleExtField(
                                  ext.id,
                                  "disabled",
                                  ext.disabled,
                                )
                              }
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${ext.disabled ? "bg-bg-panel-hover text-text-muted border-gray-600" : "bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-800/50"}`}
                            >
                              {ext.disabled
                                ? "Enable Install"
                                : "Disable Install"}
                            </button>
                            <button
                              onClick={() => handleEditExtClick(ext)}
                              className="text-[10px] bg-accent-subtle hover:bg-accent-subtle border border-border-strong text-accent-light px-2 py-1 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteExt(ext.id)}
                              className="text-[10px] bg-red-900/30 hover:bg-red-800/50 border border-red-500/50 text-red-400 px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* API Keys Overview */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4 border-b border-border-strong pb-3">
            <div>
              <h2 className="text-xl font-bold text-indigo-400">
                API Keys Overview
              </h2>
              <p className="text-text-muted text-xs mt-1">
                Developers using the WhatsApp Send API
              </p>
            </div>
            <button
              onClick={fetchApiKeys}
              className="text-xs text-text-muted hover:text-accent-light border border-border-strong px-3 py-1 rounded transition-colors"
            >
              ↻ Refresh
            </button>
          </div>
          {apiKeysError && (
            <ErrorBanner
              message={apiKeysError}
              onDismiss={() => setApiKeysError("")}
            />
          )}
          {apiKeysLoading ? (
            <p className="text-text-muted">Loading API keys...</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-text-muted">No API keys issued yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="border rounded-lg p-3 text-center bg-bg-base border-border-strong">
                  <div className="text-2xl font-black text-text-main">
                    {apiKeys.length}
                  </div>
                  <div className="text-xs text-text-muted uppercase tracking-widest mt-0.5">
                    Total Keys
                  </div>
                </div>
                <div className="border rounded-lg p-3 text-center bg-blue-500/10 border-blue-500/30">
                  <div className="text-2xl font-black text-blue-400">
                    {apiKeys.reduce((s, k) => s + k.messages_sent, 0)}
                  </div>
                  <div className="text-xs text-text-muted uppercase tracking-widest mt-0.5">
                    Messages Sent
                  </div>
                </div>
                <div className="border rounded-lg p-3 text-center bg-green-500/10 border-green-500/30">
                  <div className="text-2xl font-black text-green-400">
                    {apiKeys.filter((k) => k.active).length}
                  </div>
                  <div className="text-xs text-text-muted uppercase tracking-widest mt-0.5">
                    Active Keys
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-text-muted border-b border-border-strong text-xs uppercase tracking-wider">
                      <th className="py-3 px-2">Email</th>
                      <th className="py-3 px-2">Name</th>
                      <th className="py-3 px-2">Sent</th>
                      <th className="py-3 px-2">Limit</th>
                      <th className="py-3 px-2">Credits</th>
                      <th className="py-3 px-2">Status</th>
                      <th className="py-3 px-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((k) => (
                      <tr
                        key={k.id}
                        className="border-b border-border-strong/30 hover:bg-bg-panel-hover/30 transition-colors"
                      >
                        <td className="py-3 px-2 text-accent-light text-xs font-mono">
                          {k.owner_email}
                        </td>
                        <td className="py-3 px-2 text-text-muted text-xs">
                          {k.owner_name || "—"}
                        </td>
                        <td className="py-3 px-2 text-text-main font-bold">
                          {k.messages_sent}
                        </td>
                        <td className="py-3 px-2 text-text-muted">
                          {k.messages_limit}
                        </td>
                        <td className="py-3 px-2 text-green-400 font-bold">
                          {k.paid_credits}
                        </td>
                        <td className="py-3 px-2">
                          {k.active ? (
                            <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-xs font-bold">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-bold">
                              SUSPENDED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-text-muted text-xs">
                          {new Date(k.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {adminEditingExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-sm">
          <div className="bg-bg-panel border border-border-strong p-6 rounded-lg w-full max-w-2xl shadow-[0_0_20px_var(--accent-subtle)] max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-accent-light border-b border-border-subtle pb-4">
              Edit Extension: {adminEditingExt.name}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Extension Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Description
                </label>
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1">
                    Trigger Command
                  </label>
                  <input
                    type="text"
                    value={editForm.trigger}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        trigger: e.target.value,
                      }))
                    }
                    className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">
                    Bot Response
                  </label>
                  <input
                    type="text"
                    value={editForm.response}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        response: e.target.value,
                      }))
                    }
                    className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Custom JS / TypeScript Execution (Advanced)
                </label>
                <textarea
                  rows={6}
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                  className="w-full bg-bg-base font-mono text-sm border border-border-subtle focus:border-border-strong text-green-400 p-3 rounded outline-none"
                />
              </div>

              <div className="flex flex-col gap-4 pt-4 border-t border-border-strong">
                {editError && (
                  <ErrorBanner
                    message={editError}
                    onDismiss={() => setEditError("")}
                  />
                )}
                <div className="flex gap-4">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-accent-primary hover:bg-accent-hover text-text-main font-bold py-3 px-4 rounded transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setAdminEditingExt(null);
                      setEditError("");
                    }}
                    className="flex-1 bg-bg-panel-hover hover:bg-gray-700 text-text-muted font-bold py-3 px-4 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
