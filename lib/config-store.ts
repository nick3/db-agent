import { create } from "zustand";
import { persist } from "zustand/middleware";

// LLM Provider Configuration
export interface LLMConfig {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "custom";
  baseUrl: string;
  apiKey: string;
  modelName: string;
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
  // LLM Configs
  llmConfigs: LLMConfig[];
  addLLMConfig: (config: Omit<LLMConfig, "id" | "createdAt">) => void;
  updateLLMConfig: (id: string, config: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => void;
  setActiveLLM: (id: string) => void;

  // Database Configs
  dbConfigs: DatabaseConfig[];
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
            c.id === id ? { ...c, ...config } : c
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
            c.id === id ? { ...c, ...config } : c
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
        llmConfigs: state.llmConfigs.map((c) => ({ ...c, apiKey: "" })), // Don't persist API keys
        dbConfigs: state.dbConfigs.map((c) => ({ ...c, password: "" })), // Don't persist passwords
      }),
    }
  )
);
