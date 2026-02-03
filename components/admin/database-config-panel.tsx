"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Eye,
  EyeOff,
  Zap,
  AlertCircle,
  Database,
  Server,
  User,
  Lock,
  Globe,
  Hash,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  Cable,
  Clock,
  Info,
} from "lucide-react";
import { useConfigStore, type DatabaseConfig } from "@/lib/config-store";
import { logger } from "@/lib/logger/client";
import { cn } from "@/lib/utils";

const dbTypes = [
  {
    value: "postgresql",
    label: "PostgreSQL",
    color: "text-sky-400",
    icon: "🐘",
    defaultPort: 5432,
  },
  {
    value: "mysql",
    label: "MySQL",
    color: "text-orange-400",
    icon: "🐬",
    defaultPort: 3306,
  },
  {
    value: "sqlite",
    label: "SQLite",
    color: "text-blue-400",
    icon: "📁",
    defaultPort: 0,
  },
  {
    value: "mssql",
    label: "SQL Server",
    color: "text-red-400",
    icon: "🔷",
    defaultPort: 1433,
  },
  {
    value: "oracle",
    label: "Oracle",
    color: "text-amber-400",
    icon: "🔶",
    defaultPort: 1521,
  },
] as const;

interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    version?: string;
    database?: string;
    latency?: number;
  };
}

export function DatabaseConfigPanel() {
  const { dbConfigs, setDBConfigs } = useConfigStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Connection test states
  const [testingConnection, setTestingConnection] = useState<string | null>(
    null,
  );
  const [connectionResults, setConnectionResults] = useState<
    Record<string, ConnectionTestResult>
  >({});
  const [testingForm, setTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] =
    useState<ConnectionTestResult | null>(null);

  const [formData, setFormData] = useState<Partial<DatabaseConfig>>({
    name: "",
    type: "postgresql",
    host: "localhost",
    port: 5432,
    username: "",
    password: "",
    database: "",
    ssl: false,
    isActive: false,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "postgresql",
      host: "localhost",
      port: 5432,
      username: "",
      password: "",
      database: "",
      ssl: false,
      isActive: false,
    });
    setFormTestResult(null);
  };

  const loadConfigs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/db-configs");
      if (!response.ok) {
        throw new Error("Failed to load DB configs");
      }

      const data = (await response.json()) as { configs?: DatabaseConfig[] };
      setDBConfigs(data.configs ?? []);
    } catch (error) {
      logger.error({ err: error }, "Failed to load DB configs");
    }
  }, [setDBConfigs]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const handleTypeChange = (type: DatabaseConfig["type"]) => {
    const dbInfo = dbTypes.find((db) => db.value === type);
    setFormData({
      ...formData,
      type,
      port: dbInfo?.defaultPort || 5432,
      host: type === "sqlite" ? "" : formData.host,
    });
    setFormTestResult(null);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.database) return;
    if (formData.type !== "sqlite" && (!formData.host || !formData.username))
      return;

    const payload = {
      name: formData.name,
      type: formData.type,
      host: formData.host ?? "",
      port: formData.port ?? 5432,
      username: formData.username ?? "",
      password: formData.password ?? "",
      database: formData.database,
      ssl: formData.ssl ?? false,
      isActive: formData.isActive ?? false,
    };

    try {
      const response = await fetch("/api/admin/db-configs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload,
        ),
      });

      if (!response.ok) {
        throw new Error("Failed to save DB config");
      }

      await loadConfigs();

      if (editingId) {
        setEditingId(null);
      } else {
        setIsAdding(false);
      }

      resetForm();
    } catch (error) {
      logger.error({ err: error }, "Failed to save DB config");
    }
  };

  const handleEdit = (config: DatabaseConfig) => {
    setFormData(config);
    setEditingId(config.id);
    setIsAdding(false);
    setFormTestResult(null);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch("/api/admin/db-configs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete DB config");
      }

      await loadConfigs();
    } catch (error) {
      logger.error({ err: error }, "Failed to delete DB config");
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const response = await fetch("/api/admin/db-configs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, setActive: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to set active DB config");
      }

      await loadConfigs();
    } catch (error) {
      logger.error({ err: error }, "Failed to set active DB config");
    }
  };

  // Test connection for existing config
  const testConnection = async (config: DatabaseConfig) => {
    setTestingConnection(config.id);
    setConnectionResults((prev) => ({
      ...prev,
      [config.id]: undefined as unknown as ConnectionTestResult,
    }));

    try {
      const response = await fetch("/api/admin/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: config.id }),
      });

      const result: ConnectionTestResult = await response.json();
      setConnectionResults((prev) => ({ ...prev, [config.id]: result }));
    } catch (error) {
      setConnectionResults((prev) => ({
        ...prev,
        [config.id]: {
          success: false,
          message: error instanceof Error ? error.message : "Network error",
        },
      }));
    } finally {
      setTestingConnection(null);
    }
  };

  // Test connection for form (new/editing)
  const testFormConnection = async () => {
    if (!formData.database) return;
    if (formData.type !== "sqlite" && (!formData.host || !formData.username))
      return;

    setTestingForm(true);
    setFormTestResult(null);

    try {
      const response = await fetch("/api/admin/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          database: formData.database,
          ssl: formData.ssl,
        }),
      });

      const result: ConnectionTestResult = await response.json();
      setFormTestResult(result);
    } catch (error) {
      setFormTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Network error",
      });
    } finally {
      setTestingForm(false);
    }
  };

  const isSQLite = formData.type === "sqlite";
  const canTestForm =
    formData.database && (isSQLite || (formData.host && formData.username));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 font-bold text-white text-xl">
            <Database className="h-5 w-5 text-sky-400" />
            Database Connections
          </h2>
          <p className="mt-1 text-[#6a6a7a] text-sm">
            Configure your database connections for natural language queries
          </p>
        </div>
        {!isAdding && !editingId && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 font-medium text-sky-400 text-sm transition-all hover:bg-sky-500/20"
          >
            <Plus className="h-4 w-4" />
            Add Database
          </motion.button>
        )}
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-sky-500/20 bg-gradient-to-b from-sky-500/5 to-transparent p-6">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                <span className="font-medium text-sky-400 text-sm">
                  {editingId ? "EDIT_CONNECTION" : "NEW_CONNECTION"}
                </span>
              </div>

              {/* Database Type Selection */}
              <div className="mb-6 space-y-2">
                <div className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider">
                  <Server className="h-3 w-3" />
                  Database Type
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {dbTypes.map((db) => (
                    <button
                      key={db.value}
                      onClick={() => handleTypeChange(db.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-all",
                        formData.type === db.value
                          ? `border-current bg-current/10 ${db.color}`
                          : "border-[#1a1a2e] text-[#4a4a5a] hover:border-[#2a2a3e] hover:text-[#6a6a7a]",
                      )}
                    >
                      <span className="text-2xl">{db.icon}</span>
                      <span className="font-medium text-xs">{db.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Connection Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="db-connection-name"
                    className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                  >
                    <Database className="h-3 w-3" />
                    Connection Name
                  </label>
                  <input
                    id="db-connection-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Production DB"
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                {/* Database Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="db-database-name"
                    className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                  >
                    <Hash className="h-3 w-3" />
                    {isSQLite ? "File Path" : "Database Name"}
                  </label>
                  <input
                    id="db-database-name"
                    type="text"
                    value={formData.database}
                    onChange={(e) => {
                      setFormData({ ...formData, database: e.target.value });
                      setFormTestResult(null);
                    }}
                    placeholder={
                      isSQLite ? "/path/to/database.db" : "my_database"
                    }
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>

                {!isSQLite && (
                  <>
                    {/* Host */}
                    <div className="space-y-2">
                      <label
                        htmlFor="db-host"
                        className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                      >
                        <Globe className="h-3 w-3" />
                        Host / IP Address
                      </label>
                      <input
                        id="db-host"
                        type="text"
                        value={formData.host}
                        onChange={(e) => {
                          setFormData({ ...formData, host: e.target.value });
                          setFormTestResult(null);
                        }}
                        placeholder="localhost or 192.168.1.100"
                        className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>

                    {/* Port */}
                    <div className="space-y-2">
                      <label
                        htmlFor="db-port"
                        className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                      >
                        <Hash className="h-3 w-3" />
                        Port
                      </label>
                      <input
                        id="db-port"
                        type="number"
                        value={formData.port}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            port: parseInt(e.target.value, 10) || 0,
                          });
                          setFormTestResult(null);
                        }}
                        placeholder="5432"
                        className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                      <label
                        htmlFor="db-username"
                        className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                      >
                        <User className="h-3 w-3" />
                        Username
                      </label>
                      <input
                        id="db-username"
                        type="text"
                        value={formData.username}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            username: e.target.value,
                          });
                          setFormTestResult(null);
                        }}
                        placeholder="db_user"
                        className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label
                        htmlFor="db-password"
                        className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                      >
                        <Lock className="h-3 w-3" />
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="db-password"
                          type={showPassword["form"] ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            });
                            setFormTestResult(null);
                          }}
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 pr-12 text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword({
                              ...showPassword,
                              form: !showPassword["form"],
                            })
                          }
                          className="absolute top-1/2 right-3 -translate-y-1/2 text-[#4a4a5a] hover:text-[#6a6a7a]"
                        >
                          {showPassword["form"] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* SSL Toggle */}
                    <div className="flex items-center gap-4 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, ssl: !formData.ssl });
                          setFormTestResult(null);
                        }}
                        className={cn(
                          "relative h-6 w-11 rounded-full transition-colors",
                          formData.ssl ? "bg-sky-500" : "bg-[#1a1a2e]",
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                            formData.ssl && "translate-x-5",
                          )}
                        />
                      </button>
                      <div className="flex items-center gap-2">
                        <Shield
                          className={cn(
                            "h-4 w-4",
                            formData.ssl ? "text-sky-400" : "text-[#4a4a5a]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            formData.ssl ? "text-white" : "text-[#6a6a7a]",
                          )}
                        >
                          Enable SSL/TLS Connection
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Connection Test Result */}
              <AnimatePresence>
                {formTestResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "mt-6 rounded-lg border p-4",
                      formTestResult.success
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-red-500/30 bg-red-500/10",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {formTestResult.success ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle className="h-5 w-5 shrink-0 text-red-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-medium",
                            formTestResult.success
                              ? "text-emerald-400"
                              : "text-red-400",
                          )}
                        >
                          {formTestResult.success
                            ? "Connection Successful!"
                            : "Connection Failed"}
                        </p>
                        <p className="mt-1 text-[#8a8a9a] text-sm">
                          {formTestResult.message}
                        </p>
                        {formTestResult.details && (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs">
                            {formTestResult.details.version && (
                              <div className="flex items-center gap-1.5">
                                <Info className="h-3 w-3 text-[#4a4a5a]" />
                                <span className="text-[#6a6a7a]">Version:</span>
                                <span className="font-mono text-[#a0a0b0]">
                                  {formTestResult.details.version}
                                </span>
                              </div>
                            )}
                            {formTestResult.details.database && (
                              <div className="flex items-center gap-1.5">
                                <Database className="h-3 w-3 text-[#4a4a5a]" />
                                <span className="text-[#6a6a7a]">
                                  Database:
                                </span>
                                <span className="font-mono text-[#a0a0b0]">
                                  {formTestResult.details.database}
                                </span>
                              </div>
                            )}
                            {formTestResult.details.latency !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-[#4a4a5a]" />
                                <span className="text-[#6a6a7a]">Latency:</span>
                                <span className="font-mono text-[#a0a0b0]">
                                  {formTestResult.details.latency}ms
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Security Notice */}
              <div className="mt-6">
                <p className="flex items-center gap-1.5 text-amber-400/70 text-xs">
                  <AlertCircle className="h-3 w-3" />
                  Credentials are stored on the server. For production, use
                  environment variables or a secrets manager.
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between">
                {/* Test Connection Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={testFormConnection}
                  disabled={!canTestForm || testingForm}
                  className="flex items-center gap-2 rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-2 font-medium text-[#8a8a9a] text-sm transition-all hover:border-emerald-500/30 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testingForm ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Cable className="h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </motion.button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 rounded-lg border border-[#1a1a2e] px-4 py-2 text-[#6a6a7a] text-sm transition-all hover:border-[#2a2a3e] hover:text-[#8a8a9a]"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    disabled={
                      !formData.name ||
                      !formData.database ||
                      (!isSQLite && (!formData.host || !formData.username))
                    }
                    className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 font-medium text-black text-sm transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {editingId ? "Update" : "Save"} Connection
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {dbConfigs.length === 0 && !isAdding ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-[#1a1a2e] border-dashed bg-[#0a0a0f]/50 p-12 text-center"
            >
              <Database className="mx-auto h-12 w-12 text-[#2a2a3a]" />
              <h3 className="mt-4 font-medium text-[#4a4a5a] text-lg">
                No databases configured
              </h3>
              <p className="mt-2 text-[#3a3a4a] text-sm">
                Add your first database connection to start querying with
                natural language
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 font-medium text-sky-400 text-sm transition-all hover:bg-sky-500/20"
              >
                <Plus className="h-4 w-4" />
                Add Your First Database
              </button>
            </motion.div>
          ) : (
            dbConfigs.map((config, index) => {
              const dbInfo = dbTypes.find((db) => db.value === config.type);
              const isTesting = testingConnection === config.id;
              const result = connectionResults[config.id];

              return (
                <motion.div
                  key={config.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "group relative rounded-xl border bg-[#0f0f18] p-5 transition-all",
                    config.isActive
                      ? "border-sky-500/30 shadow-[0_0_30px_-10px_rgba(14,165,233,0.2)]"
                      : "border-[#1a1a2e] hover:border-[#2a2a3e]",
                  )}
                >
                  {config.isActive && (
                    <div className="absolute -top-px right-6 left-6 h-px bg-gradient-to-r from-transparent via-sky-500 to-transparent" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-lg border text-2xl",
                          config.isActive
                            ? "border-sky-500/30 bg-sky-500/10"
                            : "border-[#1a1a2e] bg-[#0a0a0f]",
                        )}
                      >
                        {dbInfo?.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">
                            {config.name}
                          </h3>
                          {config.isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 font-medium text-[10px] text-sky-400 uppercase tracking-wider">
                              <Zap className="h-2.5 w-2.5" />
                              Active
                            </span>
                          )}
                          {result?.success && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-[10px] text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Connected
                            </span>
                          )}
                          {result && !result.success && (
                            <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-[10px] text-red-400">
                              <XCircle className="h-2.5 w-2.5" />
                              Failed
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span className={cn("font-medium", dbInfo?.color)}>
                            {dbInfo?.label}
                          </span>
                          <span className="text-[#3a3a4a]">•</span>
                          {config.type === "sqlite" ? (
                            <span className="font-mono text-[#6a6a7a]">
                              {config.database}
                            </span>
                          ) : (
                            <>
                              <span className="font-mono text-[#6a6a7a]">
                                {config.host}:{config.port}
                              </span>
                              <span className="text-[#3a3a4a]">•</span>
                              <span className="font-mono text-[#4a4a5a]">
                                {config.database}
                              </span>
                              {config.ssl && (
                                <>
                                  <span className="text-[#3a3a4a]">•</span>
                                  <span className="flex items-center gap-1 text-emerald-400">
                                    <Shield className="h-3 w-3" />
                                    SSL
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        {/* Connection test details */}
                        {result?.details && (
                          <div className="mt-3 flex flex-wrap gap-4 text-xs">
                            {result.details.version && (
                              <div className="flex items-center gap-1.5">
                                <Info className="h-3 w-3 text-[#4a4a5a]" />
                                <span className="font-mono text-[#6a6a7a]">
                                  {result.details.version}
                                </span>
                              </div>
                            )}
                            {result.details.latency !== undefined && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-[#4a4a5a]" />
                                <span className="font-mono text-[#6a6a7a]">
                                  {result.details.latency}ms
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Connection error message */}
                        {result && !result.success && (
                          <p className="mt-2 text-red-400/80 text-xs">
                            {result.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => testConnection(config)}
                        disabled={isTesting}
                        className="flex items-center gap-2 rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-3 py-1.5 font-medium text-[#6a6a7a] text-xs transition-all hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-50"
                      >
                        {isTesting ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Cable className="h-3 w-3" />
                        )}
                        Test
                      </button>
                      {!config.isActive && (
                        <button
                          onClick={() => void handleSetActive(config.id)}
                          className="rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-3 py-1.5 font-medium text-[#6a6a7a] text-xs transition-all hover:border-sky-500/30 hover:text-sky-400"
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(config)}
                        className="rounded-lg border border-[#1a1a2e] p-2 text-[#4a4a5a] transition-all hover:border-[#2a2a3e] hover:text-[#8a8a9a]"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => void handleDelete(config.id)}
                        className="rounded-lg border border-[#1a1a2e] p-2 text-[#4a4a5a] transition-all hover:border-red-500/30 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
