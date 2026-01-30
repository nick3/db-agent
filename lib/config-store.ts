import { create } from "zustand";
import { persist } from "zustand/middleware";

// LLM Provider Configuration
export type OpenAICompatibleApiMode = "responses" | "chat";

export interface LLMConfig {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "custom";
  baseUrl: string;
  apiKey: string;
  modelName: string;

  /**
   * OpenAI / OpenAI-compatible API mode (primarily for custom providers).
   * - responses: /v1/responses
   * - chat: /v1/chat/completions
   */
  apiMode?: OpenAICompatibleApiMode;

  isActive: boolean;
  createdAt: number;
}

// Database Configuration
export interface DatabaseConfig {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  isActive: boolean;
  createdAt: number;
}

interface ConfigStore {
  // LLM Configs (server-sourced)
  llmConfigs: LLMConfig[];
  setLLMConfigs: (configs: LLMConfig[]) => void;
  addLLMConfig: (config: Omit<LLMConfig, "id" | "createdAt">) => void;
  updateLLMConfig: (id: string, config: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => void;
  setActiveLLM: (id: string) => void;

  // Database Configs
  dbConfigs: DatabaseConfig[];
  setDBConfigs: (configs: DatabaseConfig[]) => void;
  addDBConfig: (config: Omit<DatabaseConfig, "id" | "createdAt">) => void;
  updateDBConfig: (id: string, config: Partial<DatabaseConfig>) => void;
  deleteDBConfig: (id: string) => void;
  setActiveDB: (id: string) => void;

  // Connection test states
  testingConnection: string | null;
  setTestingConnection: (id: string | null) => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      // LLM State
      llmConfigs: [],
      setLLMConfigs: (configs) => set({ llmConfigs: configs }),
      addLLMConfig: (config) =>
        set((state) => ({
          llmConfigs: [
            ...state.llmConfigs,
            {
              ...config,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
          ],
        })),
      updateLLMConfig: (id, config) =>
        set((state) => ({
          llmConfigs: state.llmConfigs.map((c) =>
            c.id === id ? { ...c, ...config } : c,
          ),
        })),
      deleteLLMConfig: (id) =>
        set((state) => ({
          llmConfigs: state.llmConfigs.filter((c) => c.id !== id),
        })),
      setActiveLLM: (id) =>
        set((state) => ({
          llmConfigs: state.llmConfigs.map((c) => ({
            ...c,
            isActive: c.id === id,
          })),
        })),

      // Database State
      dbConfigs: [],
      setDBConfigs: (configs) => set({ dbConfigs: configs }),
      addDBConfig: (config) =>
        set((state) => ({
          dbConfigs: [
            ...state.dbConfigs,
            {
              ...config,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
            },
          ],
        })),
      updateDBConfig: (id, config) =>
        set((state) => ({
          dbConfigs: state.dbConfigs.map((c) =>
            c.id === id ? { ...c, ...config } : c,
          ),
        })),
      deleteDBConfig: (id) =>
        set((state) => ({
          dbConfigs: state.dbConfigs.filter((c) => c.id !== id),
        })),
      setActiveDB: (id) =>
        set((state) => ({
          dbConfigs: state.dbConfigs.map((c) => ({
            ...c,
            isActive: c.id === id,
          })),
        })),

      // Connection testing
      testingConnection: null,
      setTestingConnection: (id) => set({ testingConnection: id }),
    }),
    {
      name: "db-agent-config",
      partialize: (state) => ({
        // LLM configs are server-sourced; only persist DB configs locally.
        dbConfigs: state.dbConfigs.map((c) => ({ ...c, password: "" })), // Don't persist passwords
      }),
    },
  ),
);
