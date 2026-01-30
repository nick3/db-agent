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
  Sparkles,
  Globe,
  Key,
  Box,
} from "lucide-react";
import {
  useConfigStore,
  type LLMConfig,
  type OpenAICompatibleApiMode,
} from "@/lib/config-store";
import { logger } from "@/lib/logger/client";
import { cn } from "@/lib/utils";

const providers = [
  {
    value: "anthropic",
    label: "Anthropic",
    color: "text-orange-400",
    defaultUrl: "https://api.anthropic.com",
  },
  {
    value: "openai",
    label: "OpenAI",
    color: "text-emerald-400",
    defaultUrl: "https://api.openai.com/v1",
  },
  {
    value: "custom",
    label: "Custom",
    color: "text-purple-400",
    defaultUrl: "",
  },
] as const;

const defaultModels: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-3-5-haiku-20241022",
  ],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  custom: [],
};

function getDefaultApiMode(
  provider: LLMConfig["provider"],
): OpenAICompatibleApiMode | undefined {
  switch (provider) {
    case "openai":
      return "responses";
    case "custom":
      return "chat";
    default:
      return undefined;
  }
}

function getResolvedApiMode(
  provider: LLMConfig["provider"] | undefined,
  apiMode: LLMConfig["apiMode"] | undefined,
): OpenAICompatibleApiMode | undefined {
  if (!provider || provider === "anthropic") {
    return undefined;
  }

  return (apiMode ?? getDefaultApiMode(provider)) as
    | OpenAICompatibleApiMode
    | undefined;
}

function getApiModeLabel(apiMode: OpenAICompatibleApiMode) {
  return apiMode === "responses" ? "Responses" : "Chat Completions";
}

export function LLMConfigPanel() {
  const { llmConfigs, setLLMConfigs } = useConfigStore();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState<Partial<LLMConfig>>({
    name: "",
    provider: "anthropic",
    baseUrl: providers[0].defaultUrl,
    apiKey: "",
    modelName: defaultModels.anthropic[0],
    isActive: false,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      provider: "anthropic",
      baseUrl: providers[0].defaultUrl,
      apiKey: "",
      modelName: defaultModels.anthropic[0],
      isActive: false,
    });
  };

  const loadConfigs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/llm-configs");
      if (!response.ok) {
        throw new Error("Failed to load LLM configs");
      }
      const data = (await response.json()) as { configs?: LLMConfig[] };
      setLLMConfigs(data.configs ?? []);
    } catch (error) {
      logger.error({ err: error }, "Failed to load LLM configs");
    }
  }, [setLLMConfigs]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const handleProviderChange = (provider: LLMConfig["provider"]) => {
    const providerInfo = providers.find((p) => p.value === provider);
    setFormData({
      ...formData,
      provider,
      baseUrl: providerInfo?.defaultUrl || "",
      modelName: defaultModels[provider]?.[0] || "",
      apiMode: getDefaultApiMode(provider),
    });
  };

  const handleSubmit = async () => {
    if (
      !formData.name ||
      !formData.apiKey ||
      !formData.modelName ||
      !formData.provider
    )
      return;

    const payload = {
      name: formData.name,
      provider: formData.provider,
      baseUrl: formData.baseUrl ?? "",
      apiKey: formData.apiKey,
      modelName: formData.modelName,
      apiMode: getResolvedApiMode(formData.provider, formData.apiMode),
    };

    try {
      const response = await fetch("/api/admin/llm-configs", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId
            ? {
                ...payload,
                id: editingId,
              }
            : payload,
        ),
      });

      if (!response.ok) {
        throw new Error("Failed to save LLM config");
      }

      await loadConfigs();

      if (editingId) {
        setEditingId(null);
      } else {
        setIsAdding(false);
      }
      resetForm();
    } catch (error) {
      logger.error({ err: error }, "Failed to save LLM config");
    }
  };

  const handleEdit = (config: LLMConfig) => {
    setFormData(config);
    setEditingId(config.id);
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch("/api/admin/llm-configs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete LLM config");
      }

      await loadConfigs();
    } catch (error) {
      logger.error({ err: error }, "Failed to delete LLM config");
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const response = await fetch("/api/admin/llm-configs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, setActive: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to set active LLM config");
      }

      await loadConfigs();
    } catch (error) {
      logger.error({ err: error }, "Failed to set active LLM config");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 font-bold text-white text-xl">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            LLM Providers
          </h2>
          <p className="mt-1 text-[#6a6a7a] text-sm">
            Configure your AI model providers and API credentials
          </p>
        </div>
        {!isAdding && !editingId && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-400 text-sm transition-all hover:bg-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            Add Provider
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
            <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-transparent p-6">
              <div className="mb-6 flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="font-medium text-emerald-400 text-sm">
                  {editingId ? "EDIT_CONFIG" : "NEW_CONFIG"}
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="llm-config-name"
                    className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                  >
                    <Box className="h-3 w-3" />
                    Configuration Name
                  </label>
                  <input
                    id="llm-config-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Production Claude"
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Provider */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider">
                    <Zap className="h-3 w-3" />
                    Provider
                  </div>
                  <div className="flex gap-2">
                    {providers.map((provider) => (
                      <button
                        key={provider.value}
                        onClick={() => handleProviderChange(provider.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-4 py-3 font-medium text-sm transition-all",
                          formData.provider === provider.value
                            ? `border-current bg-current/10 ${provider.color}`
                            : "border-[#1a1a2e] text-[#4a4a5a] hover:border-[#2a2a3e] hover:text-[#6a6a7a]",
                        )}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base URL */}
                <div className="space-y-2">
                  <label
                    htmlFor="llm-base-url"
                    className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                  >
                    <Globe className="h-3 w-3" />
                    Base URL
                  </label>
                  <input
                    id="llm-base-url"
                    type="url"
                    value={formData.baseUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, baseUrl: e.target.value })
                    }
                    placeholder="https://api.example.com"
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Model Name */}
                <div className="space-y-2">
                  <label
                    htmlFor="llm-model-name"
                    className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                  >
                    <Sparkles className="h-3 w-3" />
                    Model Name
                  </label>
                  {formData.provider !== "custom" &&
                  defaultModels[formData.provider || "anthropic"]?.length >
                    0 ? (
                    <select
                      id="llm-model-name"
                      value={formData.modelName}
                      onChange={(e) =>
                        setFormData({ ...formData, modelName: e.target.value })
                      }
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {defaultModels[formData.provider || "anthropic"].map(
                        (model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <input
                      id="llm-model-name"
                      type="text"
                      value={formData.modelName}
                      onChange={(e) =>
                        setFormData({ ...formData, modelName: e.target.value })
                      }
                      placeholder="e.g., gpt-4"
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  )}
                </div>

                {(formData.provider === "openai" ||
                  formData.provider === "custom") && (
                  <div className="space-y-2 md:col-span-2">
                    <label
                      htmlFor="llm-api-mode"
                      className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                    >
                      <Zap className="h-3 w-3" />
                      API Mode
                    </label>
                    <select
                      id="llm-api-mode"
                      value={
                        getResolvedApiMode(
                          formData.provider,
                          formData.apiMode,
                        ) ?? "chat"
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          apiMode: e.target.value as OpenAICompatibleApiMode,
                        })
                      }
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="responses">
                        Responses (/v1/responses)
                      </option>
                      <option value="chat">
                        Chat Completions (/v1/chat/completions)
                      </option>
                    </select>
                    <p className="text-[#3a3a4a] text-xs">
                      Select the API shape your gateway/provider supports.
                    </p>
                  </div>
                )}

                {/* API Key */}
                <div className="space-y-2 md:col-span-2">
                  <label
                    htmlFor="llm-api-key"
                    className="flex items-center gap-2 font-medium text-[#6a6a7a] text-xs uppercase tracking-wider"
                  >
                    <Key className="h-3 w-3" />
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      id="llm-api-key"
                      type={showApiKey["form"] ? "text" : "password"}
                      value={formData.apiKey}
                      onChange={(e) =>
                        setFormData({ ...formData, apiKey: e.target.value })
                      }
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 pr-12 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowApiKey({
                          ...showApiKey,
                          form: !showApiKey["form"],
                        })
                      }
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-[#4a4a5a] hover:text-[#6a6a7a]"
                    >
                      {showApiKey["form"] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 text-amber-400/70 text-xs">
                    <AlertCircle className="h-3 w-3" />
                    API keys are stored on the server and only used to call your
                    provider
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-end gap-3">
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
                  onClick={() => void handleSubmit()}
                  disabled={
                    !formData.name || !formData.apiKey || !formData.modelName
                  }
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-medium text-black text-sm transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {editingId ? "Update" : "Save"} Configuration
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {llmConfigs.length === 0 && !isAdding ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-[#1a1a2e] border-dashed bg-[#0a0a0f]/50 p-12 text-center"
            >
              <Sparkles className="mx-auto h-12 w-12 text-[#2a2a3a]" />
              <h3 className="mt-4 font-medium text-[#4a4a5a] text-lg">
                No providers configured
              </h3>
              <p className="mt-2 text-[#3a3a4a] text-sm">
                Add your first LLM provider to start using the AI assistant
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-400 text-sm transition-all hover:bg-emerald-500/20"
              >
                <Plus className="h-4 w-4" />
                Add Your First Provider
              </button>
            </motion.div>
          ) : (
            llmConfigs.map((config, index) => {
              const providerInfo = providers.find(
                (p) => p.value === config.provider,
              );
              const apiMode = getResolvedApiMode(
                config.provider,
                config.apiMode,
              );
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
                      ? "border-emerald-500/30 shadow-[0_0_30px_-10px_rgba(16,185,129,0.2)]"
                      : "border-[#1a1a2e] hover:border-[#2a2a3e]",
                  )}
                >
                  {config.isActive && (
                    <div className="absolute -top-px right-6 left-6 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-lg border",
                          config.isActive
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : "border-[#1a1a2e] bg-[#0a0a0f]",
                        )}
                      >
                        <Sparkles
                          className={cn(
                            "h-6 w-6",
                            config.isActive
                              ? "text-emerald-400"
                              : "text-[#4a4a5a]",
                          )}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">
                            {config.name}
                          </h3>
                          {config.isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-[10px] text-emerald-400 uppercase tracking-wider">
                              <Zap className="h-2.5 w-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span
                            className={cn("font-medium", providerInfo?.color)}
                          >
                            {providerInfo?.label}
                          </span>
                          <span className="text-[#3a3a4a]">•</span>
                          <span className="font-mono text-[#6a6a7a]">
                            {config.modelName}
                          </span>
                          {apiMode && (
                            <>
                              <span className="text-[#3a3a4a]">•</span>
                              <span className="text-[#6a6a7a]">
                                {getApiModeLabel(apiMode)}
                              </span>
                            </>
                          )}
                          <span className="text-[#3a3a4a]">•</span>
                          <span className="font-mono text-[#4a4a5a]">
                            {config.baseUrl}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {!config.isActive && (
                        <button
                          onClick={() => void handleSetActive(config.id)}
                          className="rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-3 py-1.5 font-medium text-[#6a6a7a] text-xs transition-all hover:border-emerald-500/30 hover:text-emerald-400"
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
