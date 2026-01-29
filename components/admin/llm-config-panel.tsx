"use client";

import { useState } from "react";
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
import { useConfigStore, type LLMConfig } from "@/lib/config-store";
import { cn } from "@/lib/utils";

const providers = [
  { value: "anthropic", label: "Anthropic", color: "text-orange-400", defaultUrl: "https://api.anthropic.com" },
  { value: "openai", label: "OpenAI", color: "text-emerald-400", defaultUrl: "https://api.openai.com/v1" },
  { value: "custom", label: "Custom", color: "text-purple-400", defaultUrl: "" },
] as const;

const defaultModels: Record<string, string[]> = {
  anthropic: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-haiku-20241022"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  custom: [],
};

export function LLMConfigPanel() {
  const { llmConfigs, addLLMConfig, updateLLMConfig, deleteLLMConfig, setActiveLLM } = useConfigStore();
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

  const handleProviderChange = (provider: LLMConfig["provider"]) => {
    const providerInfo = providers.find((p) => p.value === provider);
    setFormData({
      ...formData,
      provider,
      baseUrl: providerInfo?.defaultUrl || "",
      modelName: defaultModels[provider]?.[0] || "",
    });
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.apiKey || !formData.modelName) return;

    if (editingId) {
      updateLLMConfig(editingId, formData);
      setEditingId(null);
    } else {
      addLLMConfig(formData as Omit<LLMConfig, "id" | "createdAt">);
      setIsAdding(false);
    }
    resetForm();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-xl font-bold text-white">
            <Sparkles className="h-5 w-5 text-emerald-400" />
            LLM Providers
          </h2>
          <p className="mt-1 text-sm text-[#6a6a7a]">
            Configure your AI model providers and API credentials
          </p>
        </div>
        {!isAdding && !editingId && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/20"
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
                <span className="text-sm font-medium text-emerald-400">
                  {editingId ? "EDIT_CONFIG" : "NEW_CONFIG"}
                </span>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Name */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6a6a7a]">
                    <Box className="h-3 w-3" />
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Production Claude"
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Provider */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6a6a7a]">
                    <Zap className="h-3 w-3" />
                    Provider
                  </label>
                  <div className="flex gap-2">
                    {providers.map((provider) => (
                      <button
                        key={provider.value}
                        onClick={() => handleProviderChange(provider.value)}
                        className={cn(
                          "flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                          formData.provider === provider.value
                            ? `border-current bg-current/10 ${provider.color}`
                            : "border-[#1a1a2e] text-[#4a4a5a] hover:border-[#2a2a3e] hover:text-[#6a6a7a]"
                        )}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Base URL */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6a6a7a]">
                    <Globe className="h-3 w-3" />
                    Base URL
                  </label>
                  <input
                    type="url"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    placeholder="https://api.example.com"
                    className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Model Name */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6a6a7a]">
                    <Sparkles className="h-3 w-3" />
                    Model Name
                  </label>
                  {formData.provider !== "custom" && defaultModels[formData.provider || "anthropic"]?.length > 0 ? (
                    <select
                      value={formData.modelName}
                      onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {defaultModels[formData.provider || "anthropic"].map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.modelName}
                      onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                      placeholder="e.g., gpt-4"
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  )}
                </div>

                {/* API Key */}
                <div className="space-y-2 md:col-span-2">
                  <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#6a6a7a]">
                    <Key className="h-3 w-3" />
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey["form"] ? "text" : "password"}
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-4 py-3 pr-12 font-mono text-sm text-white placeholder-[#3a3a4a] outline-none transition-all focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey({ ...showApiKey, form: !showApiKey["form"] })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a4a5a] hover:text-[#6a6a7a]"
                    >
                      {showApiKey["form"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-amber-400/70">
                    <AlertCircle className="h-3 w-3" />
                    API keys are stored locally and never sent to our servers
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 rounded-lg border border-[#1a1a2e] px-4 py-2 text-sm text-[#6a6a7a] transition-all hover:border-[#2a2a3e] hover:text-[#8a8a9a]"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.apiKey || !formData.modelName}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-xl border border-dashed border-[#1a1a2e] bg-[#0a0a0f]/50 p-12 text-center"
            >
              <Sparkles className="mx-auto h-12 w-12 text-[#2a2a3a]" />
              <h3 className="mt-4 text-lg font-medium text-[#4a4a5a]">No providers configured</h3>
              <p className="mt-2 text-sm text-[#3a3a4a]">
                Add your first LLM provider to start using the AI assistant
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-all hover:bg-emerald-500/20"
              >
                <Plus className="h-4 w-4" />
                Add Your First Provider
              </button>
            </motion.div>
          ) : (
            llmConfigs.map((config, index) => {
              const providerInfo = providers.find((p) => p.value === config.provider);
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
                      : "border-[#1a1a2e] hover:border-[#2a2a3e]"
                  )}
                >
                  {config.isActive && (
                    <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg border",
                        config.isActive
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-[#1a1a2e] bg-[#0a0a0f]"
                      )}>
                        <Sparkles className={cn(
                          "h-6 w-6",
                          config.isActive ? "text-emerald-400" : "text-[#4a4a5a]"
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">{config.name}</h3>
                          {config.isActive && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                              <Zap className="h-2.5 w-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span className={cn("font-medium", providerInfo?.color)}>
                            {providerInfo?.label}
                          </span>
                          <span className="text-[#3a3a4a]">•</span>
                          <span className="font-mono text-[#6a6a7a]">{config.modelName}</span>
                          <span className="text-[#3a3a4a]">•</span>
                          <span className="font-mono text-[#4a4a5a]">{config.baseUrl}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      {!config.isActive && (
                        <button
                          onClick={() => setActiveLLM(config.id)}
                          className="rounded-lg border border-[#1a1a2e] bg-[#0a0a0f] px-3 py-1.5 text-xs font-medium text-[#6a6a7a] transition-all hover:border-emerald-500/30 hover:text-emerald-400"
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
                        onClick={() => deleteLLMConfig(config.id)}
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
