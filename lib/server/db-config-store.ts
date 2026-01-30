import "server-only";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DatabaseConfig } from "@/lib/config-store";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "db-configs.json");

type DBConfigCreateInput = Omit<
  DatabaseConfig,
  "id" | "createdAt" | "isActive"
> & {
  id?: string;
  createdAt?: number;
  isActive?: boolean;
};

type DBConfigUpdateInput = Partial<Omit<DatabaseConfig, "id" | "createdAt">> & {
  id: string;
  createdAt?: number;
};

type DBConfigInput = DBConfigCreateInput | DBConfigUpdateInput;

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, "[]", "utf8");
  }
}

async function readConfigs(): Promise<DatabaseConfig[]> {
  await ensureDataFile();

  try {
    const raw = await fs.readFile(FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DatabaseConfig[]) : [];
  } catch {
    return [];
  }
}

async function writeConfigs(configs: DatabaseConfig[]) {
  await ensureDataFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(configs, null, 2), "utf8");
}

function normalizeActive(configs: DatabaseConfig[], activeId: string) {
  return configs.map((config) => ({
    ...config,
    isActive: config.id === activeId,
  }));
}

function getEffectivePassword(
  base: DatabaseConfig | undefined,
  input: DBConfigInput,
) {
  // If password is omitted or an empty string in an update, keep the existing password.
  if ("password" in input) {
    const next = input.password;
    if (typeof next === "string" && next.length > 0) {
      return next;
    }
  }

  return base?.password ?? "";
}

export async function listDBConfigs(): Promise<DatabaseConfig[]> {
  return readConfigs();
}

export async function getDBConfig(id: string): Promise<DatabaseConfig | null> {
  const configs = await readConfigs();
  return configs.find((config) => config.id === id) ?? null;
}

export async function getActiveDBConfig(): Promise<DatabaseConfig | null> {
  const configs = await readConfigs();
  return configs.find((config) => config.isActive) ?? null;
}

export async function upsertDBConfig(
  input: DBConfigInput,
): Promise<DatabaseConfig> {
  const configs = await readConfigs();
  const now = Date.now();
  const id = input.id ?? randomUUID();
  const existingIndex = configs.findIndex((config) => config.id === id);
  const base = existingIndex >= 0 ? configs[existingIndex] : undefined;

  if (!base) {
    if (!input.name || !input.type || !input.database) {
      throw new Error("Missing required fields for new DB config");
    }

    const next: DatabaseConfig = {
      id,
      name: input.name,
      type: input.type,
      host: input.host ?? "",
      port: input.port ?? 5432,
      username: input.username ?? "",
      password: input.password ?? "",
      database: input.database,
      ssl: input.ssl ?? false,
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

  const next: DatabaseConfig = {
    ...base,
    ...input,
    id,
    name: input.name ?? base.name,
    type: input.type ?? base.type,
    host: input.host ?? base.host,
    port: input.port ?? base.port,
    username: input.username ?? base.username,
    password: getEffectivePassword(base, input),
    database: input.database ?? base.database,
    ssl: input.ssl ?? base.ssl,
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

export async function deleteDBConfig(id: string): Promise<boolean> {
  const configs = await readConfigs();
  const next = configs.filter((config) => config.id !== id);

  if (next.length === configs.length) {
    return false;
  }

  await writeConfigs(next);
  return true;
}

export async function setActiveDBConfig(
  id: string,
): Promise<DatabaseConfig | null> {
  const configs = await readConfigs();
  const target = configs.find((config) => config.id === id);

  if (!target) {
    return null;
  }

  const next = normalizeActive(configs, id);
  await writeConfigs(next);
  return { ...target, isActive: true };
}
