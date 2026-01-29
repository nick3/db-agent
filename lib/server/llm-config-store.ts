import "server-only";

import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { LLMConfig } from "@/lib/config-store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "llm-configs.json");

type LLMConfigCreateInput = Omit<LLMConfig, "id" | "createdAt" | "isActive"> & {
  id?: string;
  createdAt?: number;
  isActive?: boolean;
};

type LLMConfigUpdateInput = Partial<Omit<LLMConfig, "id" | "createdAt">> & {
  id: string;
  createdAt?: number;
};

type LLMConfigInput = LLMConfigCreateInput | LLMConfigUpdateInput;

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, "[]", "utf8");
  }
}

async function readConfigs(): Promise<LLMConfig[]> {
  await ensureDataFile();

  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LLMConfig[]) : [];
  } catch {
    return [];
  }
}

async function writeConfigs(configs: LLMConfig[]) {
  await ensureDataFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(configs, null, 2), "utf8");
}

function normalizeActive(configs: LLMConfig[], activeId: string) {
  return configs.map((config) => ({
    ...config,
    isActive: config.id === activeId,
  }));
}

export async function listLLMConfigs(): Promise<LLMConfig[]> {
  return readConfigs();
}

export async function getActiveLLMConfig(): Promise<LLMConfig | null> {
  const configs = await readConfigs();
  return configs.find((config) => config.isActive) ?? null;
}

export async function upsertLLMConfig(
  input: LLMConfigInput,
): Promise<LLMConfig> {
  const configs = await readConfigs();
  const now = Date.now();
  const id = input.id ?? randomUUID();
  const existingIndex = configs.findIndex((config) => config.id === id);
  const base = existingIndex >= 0 ? configs[existingIndex] : undefined;

  if (!base) {
    if (!input.name || !input.provider || !input.apiKey || !input.modelName) {
      throw new Error("Missing required fields for new LLM config");
    }

    const next: LLMConfig = {
      id,
      name: input.name,
      provider: input.provider,
      baseUrl: input.baseUrl ?? "",
      apiKey: input.apiKey,
      modelName: input.modelName,
      apiMode: input.apiMode,
      isActive: input.isActive ?? false,
      createdAt: input.createdAt ?? now,
    };

    configs.push(next);

    const finalConfigs = next.isActive
      ? normalizeActive(configs, next.id)
      : configs;

    await writeConfigs(finalConfigs);
    return next;
  }

  const next: LLMConfig = {
    ...base,
    ...input,
    id,
    name: input.name ?? base.name,
    provider: input.provider ?? base.provider,
    baseUrl: input.baseUrl ?? base.baseUrl,
    apiKey: input.apiKey ?? base.apiKey,
    modelName: input.modelName ?? base.modelName,
    createdAt: base.createdAt ?? input.createdAt ?? now,
    isActive: input.isActive ?? base.isActive ?? false,
  };

  configs[existingIndex] = next;

  const finalConfigs = next.isActive
    ? normalizeActive(configs, next.id)
    : configs;
  await writeConfigs(finalConfigs);
  return next;
}

export async function deleteLLMConfig(id: string): Promise<boolean> {
  const configs = await readConfigs();
  const next = configs.filter((config) => config.id !== id);

  if (next.length === configs.length) {
    return false;
  }

  await writeConfigs(next);
  return true;
}

export async function setActiveLLMConfig(
  id: string,
): Promise<LLMConfig | null> {
  const configs = await readConfigs();
  const target = configs.find((config) => config.id === id);

  if (!target) {
    return null;
  }

  const next = normalizeActive(configs, id);
  await writeConfigs(next);
  return { ...target, isActive: true };
}
