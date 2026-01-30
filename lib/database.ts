import type { DatabaseConfig } from "./config-store";

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    version?: string;
    database?: string;
    latency?: number;
  };
}

/**
 * Test database connection based on configuration
 */
export async function testDatabaseConnection(
  config: DatabaseConfig,
): Promise<ConnectionTestResult> {
  const startTime = Date.now();

  try {
    switch (config.type) {
      case "postgresql":
        return await testPostgreSQL(config, startTime);
      case "mysql":
        return await testMySQL(config, startTime);
      case "sqlite":
        return await testSQLite(config, startTime);
      case "mssql":
        return await testMSSQL(config, startTime);
      case "oracle":
        return await testOracle(config, startTime);
      default:
        return {
          success: false,
          message: `Unsupported database type: ${config.type}`,
        };
    }
  } catch (error) {
    const message =
      config.type === "sqlite"
        ? formatSqliteDriverError(error)
        : error instanceof Error
          ? error.message
          : "Unknown error occurred";

    return {
      success: false,
      message,
    };
  }
}

export interface DatabaseColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | null;
}

export interface DatabaseIndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface DatabaseConstraintSchema {
  name: string;
  type: "PRIMARY KEY" | "FOREIGN KEY" | "UNIQUE" | string;
  columns: string[];
  references?: {
    table: string;
    columns: string[];
  };
}

export interface DatabaseTableSchema {
  name: string;
  columns: DatabaseColumnSchema[];
  constraints?: DatabaseConstraintSchema[];
  indexes?: DatabaseIndexSchema[];
}

export interface DatabaseSchemaResult {
  database: {
    type: DatabaseConfig["type"];
    name: string;
  };
  tables: DatabaseTableSchema[];
  truncated: boolean;
}

type GetDatabaseSchemaOptions = {
  tables?: string[];
  includeIndexes?: boolean;
  includeConstraints?: boolean;
  maxTables?: number;
  abortSignal?: AbortSignal;
};

export async function getDatabaseSchema(
  config: DatabaseConfig,
  options: GetDatabaseSchemaOptions = {},
): Promise<DatabaseSchemaResult> {
  switch (config.type) {
    case "postgresql":
      return getPostgresDatabaseSchema(config, options);
    case "mysql":
      return getMySqlDatabaseSchema(config, options);
    case "sqlite": {
      try {
        return await getSqliteDatabaseSchema(config, options);
      } catch (error) {
        throw new Error(formatSqliteDriverError(error));
      }
    }
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

export type ExecuteReadOnlySQLInput = {
  sql: string;
  maxRows?: number;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
};

export type ExecuteReadOnlySQLResult = {
  success: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount: number;
  truncated?: boolean;
  executionTimeMs: number;
  error?: string;
};

export async function executeReadOnlySQL(
  config: DatabaseConfig,
  input: ExecuteReadOnlySQLInput,
): Promise<ExecuteReadOnlySQLResult> {
  const start = Date.now();

  try {
    const normalizedSql = normalizeAndValidateReadOnlySQL(
      input.sql,
      config.type,
    );
    const maxRows = clampInt(input.maxRows ?? 100, 1, 1000);
    const timeoutMs = clampInt(input.timeoutMs ?? 10000, 1000, 30000);

    if (input.abortSignal?.aborted) {
      throw new Error("Aborted");
    }

    switch (config.type) {
      case "postgresql":
        return await executePostgresReadOnlySQL(config, {
          sql: normalizedSql,
          maxRows,
          timeoutMs,
          abortSignal: input.abortSignal,
          start,
        });
      case "mysql":
        return await executeMySqlReadOnlySQL(config, {
          sql: normalizedSql,
          maxRows,
          timeoutMs,
          abortSignal: input.abortSignal,
          start,
        });
      case "sqlite":
        return await executeSqliteReadOnlySQL(config, {
          sql: normalizedSql,
          maxRows,
          timeoutMs,
          abortSignal: input.abortSignal,
          start,
        });
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  } catch (error) {
    const message =
      config.type === "sqlite"
        ? formatSqliteDriverError(error)
        : error instanceof Error
          ? error.message
          : "Unknown error";

    return {
      success: false,
      rowCount: 0,
      executionTimeMs: Date.now() - start,
      error: message,
    };
  }
}

/**
 * PostgreSQL connection test
 */
async function testPostgreSQL(
  config: DatabaseConfig,
  startTime: number,
): Promise<ConnectionTestResult> {
  const { Client } = await import("pg");

  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();

    // Get version info
    const versionResult = await client.query("SELECT version()");
    const version = versionResult.rows[0]?.version || "Unknown";

    // Get current database
    const dbResult = await client.query("SELECT current_database()");
    const database = dbResult.rows[0]?.current_database || config.database;

    await client.end();

    return {
      success: true,
      message: "Connection successful",
      details: {
        version: version.split(",")[0], // Get first part of version string
        database,
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    await client.end().catch(() => {}); // Ensure cleanup
    throw error;
  }
}

/**
 * MySQL connection test
 */
async function testMySQL(
  config: DatabaseConfig,
  startTime: number,
): Promise<ConnectionTestResult> {
  const mysql = await import("mysql2/promise");

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  });

  try {
    // Get version info
    const [versionRows] = await connection.execute(
      "SELECT VERSION() as version",
    );
    const version =
      (versionRows as { version: string }[])[0]?.version || "Unknown";

    // Get current database
    const [dbRows] = await connection.execute("SELECT DATABASE() as db");
    const database = (dbRows as { db: string }[])[0]?.db || config.database;

    await connection.end();

    return {
      success: true,
      message: "Connection successful",
      details: {
        version: `MySQL ${version}`,
        database,
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    await connection.end().catch(() => {});
    throw error;
  }
}

/**
 * SQLite connection test
 */
async function testSQLite(
  config: DatabaseConfig,
  startTime: number,
): Promise<ConnectionTestResult> {
  const Database = (await import("better-sqlite3")).default;

  // For SQLite, the database field is the file path
  const db = new Database(config.database, {
    readonly: true,
    timeout: 10000,
  });

  try {
    // Get SQLite version
    const versionStmt = db.prepare("SELECT sqlite_version() as version");
    const versionRow = versionStmt.get() as { version: string };
    const version = versionRow?.version || "Unknown";

    // Check if database is accessible
    db.prepare("SELECT 1").get();

    db.close();

    return {
      success: true,
      message: "Connection successful",
      details: {
        version: `SQLite ${version}`,
        database: config.database,
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * Microsoft SQL Server connection test
 */
async function testMSSQL(
  config: DatabaseConfig,
  startTime: number,
): Promise<ConnectionTestResult> {
  const sql = await import("mssql");

  const sqlConfig = {
    server: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    options: {
      encrypt: config.ssl,
      trustServerCertificate: true,
    },
    connectionTimeout: 10000,
  };

  const pool = new sql.default.ConnectionPool(sqlConfig);

  try {
    await pool.connect();

    // Get version info
    const versionResult = await pool
      .request()
      .query("SELECT @@VERSION as version");
    const version = versionResult.recordset[0]?.version || "Unknown";

    // Get current database
    const dbResult = await pool.request().query("SELECT DB_NAME() as db");
    const database = dbResult.recordset[0]?.db || config.database;

    await pool.close();

    return {
      success: true,
      message: "Connection successful",
      details: {
        version: version.split("\n")[0], // Get first line
        database,
        latency: Date.now() - startTime,
      },
    };
  } catch (error) {
    await pool.close().catch(() => {});
    throw error;
  }
}

/**
 * Oracle connection test
 */
async function testOracle(
  config: DatabaseConfig,
  startTime: number,
): Promise<ConnectionTestResult> {
  // Note: oracledb requires Oracle Instant Client to be installed
  // This is a best-effort implementation
  try {
    const oracledb = await import("oracledb");

    const connection = await oracledb.default.getConnection({
      user: config.username,
      password: config.password,
      connectString: `${config.host}:${config.port}/${config.database}`,
    });

    try {
      // Get version info
      const versionResult = await connection.execute(
        "SELECT * FROM V$VERSION WHERE BANNER LIKE 'Oracle%' AND ROWNUM = 1",
      );
      const version =
        (versionResult.rows as string[][])?.[0]?.[0] || "Oracle Database";

      await connection.close();

      return {
        success: true,
        message: "Connection successful",
        details: {
          version,
          database: config.database,
          latency: Date.now() - startTime,
        },
      };
    } catch (error) {
      await connection.close().catch(() => {});
      throw error;
    }
  } catch (error) {
    // Check if it's an Oracle client installation issue
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("NJS-045") ||
      errorMessage.includes("Oracle Client")
    ) {
      return {
        success: false,
        message:
          "Oracle Instant Client is not installed. Please install it to use Oracle connections.",
      };
    }
    throw error;
  }
}

type ExecuteInternalInput = {
  sql: string;
  maxRows: number;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  start: number;
};

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function formatSqliteDriverError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("Could not locate the bindings file") &&
    message.includes("better_sqlite3.node")
  ) {
    return "SQLite driver (better-sqlite3) native bindings are missing. Run `pnpm rebuild better-sqlite3` or reinstall dependencies with a supported Node.js version.";
  }

  return message;
}

function stripTrailingSemicolon(sql: string) {
  const trimmed = sql.trim();
  return trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
}

function getSqlFirstKeyword(sql: string) {
  const match = /^\s*([A-Za-z_]+)/.exec(sql);
  return match?.[1]?.toUpperCase() ?? "";
}

function normalizeAndValidateReadOnlySQL(
  sql: string,
  dbType: DatabaseConfig["type"],
) {
  if (!sql || !sql.trim()) {
    throw new Error("SQL is empty");
  }

  const normalized = stripTrailingSemicolon(sql);

  // Very simple multi-statement guard.
  if (normalized.includes(";")) {
    throw new Error("Multiple statements are not allowed");
  }

  const first = getSqlFirstKeyword(normalized);

  const allowedStarts = new Set(["SELECT", "WITH", "EXPLAIN"]);
  if (dbType === "mysql") {
    allowedStarts.add("SHOW");
    allowedStarts.add("DESCRIBE");
  }
  if (dbType === "sqlite") {
    allowedStarts.add("PRAGMA");
  }

  if (!allowedStarts.has(first)) {
    throw new Error(
      "Only read-only SQL is allowed (SELECT/WITH/EXPLAIN/SHOW/DESCRIBE/PRAGMA)",
    );
  }

  const blockedKeywords = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "TRUNCATE",
    "ALTER",
    "CREATE",
    "GRANT",
    "REVOKE",
    "MERGE",
    "REPLACE",
    "EXEC",
    "EXECUTE",
    "CALL",
  ];

  for (const keyword of blockedKeywords) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(normalized)) {
      throw new Error(`Blocked keyword detected: ${keyword}`);
    }
  }

  return normalized;
}

function hasLimitClause(sql: string) {
  return /\bLIMIT\s+\d+/i.test(sql);
}

function shouldApplyLimit(sql: string) {
  const first = getSqlFirstKeyword(sql);
  return first === "SELECT" || first === "WITH";
}

function applyLimitIfSupported(
  sql: string,
  dbType: DatabaseConfig["type"],
  limit: number,
) {
  if (!shouldApplyLimit(sql)) {
    return sql;
  }

  if (dbType === "postgresql" || dbType === "mysql" || dbType === "sqlite") {
    if (hasLimitClause(sql)) {
      return sql;
    }

    return `${sql}\nLIMIT ${limit}`;
  }

  return sql;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function pickTables(
  availableTables: string[],
  requestedTables: string[] | undefined,
) {
  if (!requestedTables || requestedTables.length === 0) {
    return availableTables;
  }

  const map = new Map(availableTables.map((t) => [t.toLowerCase(), t]));
  const resolved: string[] = [];

  for (const raw of requestedTables) {
    const key = raw.trim().toLowerCase();
    const table = map.get(key);
    if (table) {
      resolved.push(table);
    }
  }

  return uniqueStrings(resolved);
}

function splitSqlList(input: string) {
  const items: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of input) {
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (ch === "," && depth === 0) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function extractLastParenthesizedSection(input: string) {
  let depth = 0;
  let end = -1;

  for (let i = input.length - 1; i >= 0; i -= 1) {
    const ch = input[i];

    if (ch === ")") {
      if (depth === 0) {
        end = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "(") {
      depth -= 1;
      if (depth === 0 && end >= 0) {
        return input.slice(i + 1, end);
      }
    }
  }

  return null;
}

async function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    const onAbort = () => {
      reject(new Error("Aborted"));
    };

    if (abortSignal) {
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        abortSignal?.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        clearTimeout(timeoutId);
        abortSignal?.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

async function getPostgresDatabaseSchema(
  config: DatabaseConfig,
  options: GetDatabaseSchemaOptions,
): Promise<DatabaseSchemaResult> {
  const { Client } = await import("pg");

  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  const includeIndexes = options.includeIndexes ?? true;
  const includeConstraints = options.includeConstraints ?? true;
  const maxTables = clampInt(options.maxTables ?? 50, 1, 200);

  await client.connect();

  try {
    const tableResult = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );

    const availableTables = tableResult.rows.map((r) => r.table_name);
    const selectedTables = pickTables(availableTables, options.tables);

    const truncated = selectedTables.length > maxTables;
    const tablesToFetch = truncated
      ? selectedTables.slice(0, maxTables)
      : selectedTables;

    const tables: DatabaseTableSchema[] = [];

    for (const tableName of tablesToFetch) {
      if (options.abortSignal?.aborted) {
        throw new Error("Aborted");
      }

      const columnsResult = await client.query<{
        column_name: string;
        data_type: string;
        is_nullable: "YES" | "NO";
        column_default: string | null;
      }>(
        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [tableName],
      );

      const columns: DatabaseColumnSchema[] = columnsResult.rows.map((row) => ({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === "YES",
        defaultValue: row.column_default,
      }));

      const constraints = includeConstraints
        ? await getPostgresConstraints(client, tableName)
        : undefined;

      const indexes = includeIndexes
        ? await getPostgresIndexes(client, tableName)
        : undefined;

      tables.push({ name: tableName, columns, constraints, indexes });
    }

    return {
      database: {
        type: config.type,
        name: config.database,
      },
      tables,
      truncated,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function getPostgresConstraints(
  client: { query: Function },
  tableName: string,
): Promise<DatabaseConstraintSchema[]> {
  const result = await client.query(
    "SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name FROM information_schema.table_constraints tc LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema WHERE tc.table_schema = 'public' AND tc.table_name = $1 ORDER BY tc.constraint_name, kcu.ordinal_position",
    [tableName],
  );

  const map = new Map<string, DatabaseConstraintSchema>();

  for (const row of result.rows as Array<{
    constraint_name: string;
    constraint_type: string;
    column_name: string | null;
    foreign_table_name: string | null;
    foreign_column_name: string | null;
  }>) {
    const name = row.constraint_name;
    const existing = map.get(name) ?? {
      name,
      type: row.constraint_type,
      columns: [],
    };

    if (row.column_name && !existing.columns.includes(row.column_name)) {
      existing.columns.push(row.column_name);
    }

    if (
      row.constraint_type === "FOREIGN KEY" &&
      row.foreign_table_name &&
      row.foreign_column_name
    ) {
      existing.references ??= {
        table: row.foreign_table_name,
        columns: [],
      };

      if (!existing.references.columns.includes(row.foreign_column_name)) {
        existing.references.columns.push(row.foreign_column_name);
      }
    }

    map.set(name, existing);
  }

  return Array.from(map.values());
}

async function getPostgresIndexes(
  client: { query: Function },
  tableName: string,
): Promise<DatabaseIndexSchema[]> {
  const result = await client.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1 ORDER BY indexname",
    [tableName],
  );

  const indexes: DatabaseIndexSchema[] = [];

  for (const row of result.rows as Array<{
    indexname: string;
    indexdef: string;
  }>) {
    const unique = /CREATE\s+UNIQUE\s+INDEX/i.test(row.indexdef);
    const list = extractLastParenthesizedSection(row.indexdef);
    const columns = list ? splitSqlList(list) : [];

    indexes.push({
      name: row.indexname,
      unique,
      columns,
    });
  }

  return indexes;
}

async function getMySqlDatabaseSchema(
  config: DatabaseConfig,
  options: GetDatabaseSchemaOptions,
): Promise<DatabaseSchemaResult> {
  const mysql = await import("mysql2/promise");

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  });

  const includeIndexes = options.includeIndexes ?? true;
  const includeConstraints = options.includeConstraints ?? true;
  const maxTables = clampInt(options.maxTables ?? 50, 1, 200);

  try {
    const [tableRows] = await connection.execute(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name",
    );

    const availableTables = (tableRows as Array<{ table_name: string }>).map(
      (r) => r.table_name,
    );

    const selectedTables = pickTables(availableTables, options.tables);

    const truncated = selectedTables.length > maxTables;
    const tablesToFetch = truncated
      ? selectedTables.slice(0, maxTables)
      : selectedTables;

    const tables: DatabaseTableSchema[] = [];

    for (const tableName of tablesToFetch) {
      if (options.abortSignal?.aborted) {
        throw new Error("Aborted");
      }

      const [columnRows] = await connection.execute(
        "SELECT column_name, column_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position",
        [tableName],
      );

      const columns: DatabaseColumnSchema[] = (
        columnRows as Array<{
          column_name: string;
          column_type: string;
          is_nullable: "YES" | "NO";
          column_default: string | null;
        }>
      ).map((row) => ({
        name: row.column_name,
        type: row.column_type,
        nullable: row.is_nullable === "YES",
        defaultValue: row.column_default,
      }));

      const constraints = includeConstraints
        ? await getMySqlConstraints(connection, tableName)
        : undefined;

      const indexes = includeIndexes
        ? await getMySqlIndexes(connection, tableName)
        : undefined;

      tables.push({ name: tableName, columns, constraints, indexes });
    }

    return {
      database: {
        type: config.type,
        name: config.database,
      },
      tables,
      truncated,
    };
  } finally {
    await connection.end().catch(() => {});
  }
}

async function getMySqlConstraints(
  connection: { execute: Function },
  tableName: string,
): Promise<DatabaseConstraintSchema[]> {
  const [rows] = await connection.execute(
    "SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, kcu.referenced_table_name, kcu.referenced_column_name FROM information_schema.table_constraints tc LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name WHERE tc.table_schema = DATABASE() AND tc.table_name = ? AND tc.constraint_type IN ('PRIMARY KEY','FOREIGN KEY','UNIQUE') ORDER BY tc.constraint_name, kcu.ordinal_position",
    [tableName],
  );

  const map = new Map<string, DatabaseConstraintSchema>();

  for (const row of rows as Array<{
    constraint_name: string;
    constraint_type: string;
    column_name: string | null;
    referenced_table_name: string | null;
    referenced_column_name: string | null;
  }>) {
    const name = row.constraint_name;
    const existing = map.get(name) ?? {
      name,
      type: row.constraint_type,
      columns: [],
    };

    if (row.column_name && !existing.columns.includes(row.column_name)) {
      existing.columns.push(row.column_name);
    }

    if (
      row.constraint_type === "FOREIGN KEY" &&
      row.referenced_table_name &&
      row.referenced_column_name
    ) {
      existing.references ??= {
        table: row.referenced_table_name,
        columns: [],
      };

      if (!existing.references.columns.includes(row.referenced_column_name)) {
        existing.references.columns.push(row.referenced_column_name);
      }
    }

    map.set(name, existing);
  }

  return Array.from(map.values());
}

async function getMySqlIndexes(
  connection: { query: Function },
  tableName: string,
): Promise<DatabaseIndexSchema[]> {
  const escaped = tableName.replaceAll("`", "``");
  const [rows] = await connection.query(`SHOW INDEX FROM \`${escaped}\``);

  type IndexRow = {
    Key_name: string;
    Column_name: string;
    Non_unique: number;
    Seq_in_index: number;
  };

  const map = new Map<
    string,
    { unique: boolean; columns: Array<{ seq: number; column: string }> }
  >();

  for (const row of rows as IndexRow[]) {
    const key = row.Key_name;
    const entry = map.get(key) ?? {
      unique: row.Non_unique === 0,
      columns: [],
    };

    entry.columns.push({ seq: row.Seq_in_index, column: row.Column_name });
    map.set(key, entry);
  }

  const indexes: DatabaseIndexSchema[] = [];

  for (const [name, entry] of map.entries()) {
    indexes.push({
      name,
      unique: entry.unique,
      columns: entry.columns.sort((a, b) => a.seq - b.seq).map((c) => c.column),
    });
  }

  return indexes;
}

function escapeSqliteStringLiteral(value: string) {
  return value.replaceAll("'", "''");
}

async function getSqliteDatabaseSchema(
  config: DatabaseConfig,
  options: GetDatabaseSchemaOptions,
): Promise<DatabaseSchemaResult> {
  const Database = (await import("better-sqlite3")).default;

  const db = new Database(config.database, {
    readonly: true,
    timeout: 10000,
  });

  const includeIndexes = options.includeIndexes ?? true;
  const includeConstraints = options.includeConstraints ?? true;
  const maxTables = clampInt(options.maxTables ?? 50, 1, 200);

  try {
    const availableTables = (
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as Array<{ name: string }>
    ).map((row) => row.name);

    const selectedTables = pickTables(availableTables, options.tables);

    const truncated = selectedTables.length > maxTables;
    const tablesToFetch = truncated
      ? selectedTables.slice(0, maxTables)
      : selectedTables;

    const tables: DatabaseTableSchema[] = [];

    for (const tableName of tablesToFetch) {
      if (options.abortSignal?.aborted) {
        throw new Error("Aborted");
      }

      const tableLiteral = escapeSqliteStringLiteral(tableName);

      const columnRows = db
        .prepare(`PRAGMA table_info('${tableLiteral}')`)
        .all() as Array<{
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;

      const columns: DatabaseColumnSchema[] = columnRows.map((row) => ({
        name: row.name,
        type: row.type,
        nullable: row.notnull === 0,
        defaultValue: row.dflt_value,
      }));

      const constraints = includeConstraints
        ? getSqliteConstraints(db, tableName, columnRows)
        : undefined;

      const indexes = includeIndexes
        ? getSqliteIndexes(db, tableName)
        : undefined;

      tables.push({ name: tableName, columns, constraints, indexes });
    }

    return {
      database: {
        type: config.type,
        name: config.database,
      },
      tables,
      truncated,
    };
  } finally {
    db.close();
  }
}

function getSqliteConstraints(
  db: { prepare: Function },
  tableName: string,
  columnRows: Array<{ name: string; pk: number }>,
): DatabaseConstraintSchema[] {
  const constraints: DatabaseConstraintSchema[] = [];

  const pkColumns = columnRows
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);

  if (pkColumns.length > 0) {
    constraints.push({
      name: "PRIMARY",
      type: "PRIMARY KEY",
      columns: pkColumns,
    });
  }

  const tableLiteral = escapeSqliteStringLiteral(tableName);
  const fkRows = db
    .prepare(`PRAGMA foreign_key_list('${tableLiteral}')`)
    .all() as Array<{
    id: number;
    seq: number;
    table: string;
    from: string;
    to: string;
  }>;

  const fkMap = new Map<
    number,
    { table: string; columns: string[]; refColumns: string[] }
  >();

  for (const row of fkRows) {
    const entry = fkMap.get(row.id) ?? {
      table: row.table,
      columns: [],
      refColumns: [],
    };

    entry.columns[row.seq] = row.from;
    entry.refColumns[row.seq] = row.to;
    fkMap.set(row.id, entry);
  }

  for (const [id, entry] of fkMap.entries()) {
    constraints.push({
      name: `FK_${id}`,
      type: "FOREIGN KEY",
      columns: entry.columns.filter(Boolean),
      references: {
        table: entry.table,
        columns: entry.refColumns.filter(Boolean),
      },
    });
  }

  return constraints;
}

function getSqliteIndexes(
  db: { prepare: Function },
  tableName: string,
): DatabaseIndexSchema[] {
  const tableLiteral = escapeSqliteStringLiteral(tableName);

  const indexRows = db
    .prepare(`PRAGMA index_list('${tableLiteral}')`)
    .all() as Array<{ name: string; unique: number }>;

  const indexes: DatabaseIndexSchema[] = [];

  for (const row of indexRows) {
    const indexLiteral = escapeSqliteStringLiteral(row.name);
    const cols = db
      .prepare(`PRAGMA index_info('${indexLiteral}')`)
      .all() as Array<{ name: string }>;

    indexes.push({
      name: row.name,
      unique: row.unique === 1,
      columns: cols.map((c) => c.name),
    });
  }

  return indexes;
}

async function executePostgresReadOnlySQL(
  config: DatabaseConfig,
  input: ExecuteInternalInput,
): Promise<ExecuteReadOnlySQLResult> {
  const { Client } = await import("pg");

  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  try {
    // Best-effort statement timeout.
    await client
      .query("SET statement_timeout = $1", [input.timeoutMs])
      .catch(() => {});

    const limitedSql = applyLimitIfSupported(
      input.sql,
      config.type,
      input.maxRows + 1,
    );

    const result = await promiseWithTimeout(
      client.query(limitedSql),
      input.timeoutMs,
      input.abortSignal,
    );

    const allRows = (result.rows ?? []) as Record<string, unknown>[];
    const truncated = allRows.length > input.maxRows;
    const rows = truncated ? allRows.slice(0, input.maxRows) : allRows;

    const columns =
      result.fields?.map((f: { name: string }) => f.name) ??
      (rows[0] ? Object.keys(rows[0]) : []);

    return {
      success: true,
      columns,
      rows,
      rowCount: rows.length,
      truncated,
      executionTimeMs: Date.now() - input.start,
    };
  } finally {
    await client.end().catch(() => {});
  }
}

async function executeMySqlReadOnlySQL(
  config: DatabaseConfig,
  input: ExecuteInternalInput,
): Promise<ExecuteReadOnlySQLResult> {
  const mysql = await import("mysql2/promise");

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  });

  try {
    const limitedSql = applyLimitIfSupported(
      input.sql,
      config.type,
      input.maxRows + 1,
    );

    const [rows, fields] = await promiseWithTimeout(
      connection.query(limitedSql),
      input.timeoutMs,
      input.abortSignal,
    );

    const allRows = Array.isArray(rows)
      ? (rows as Array<Record<string, unknown>>)
      : [];

    const truncated = allRows.length > input.maxRows;
    const sliced = truncated ? allRows.slice(0, input.maxRows) : allRows;

    const columns = Array.isArray(fields)
      ? (fields as Array<{ name: string }>).map((f) => f.name)
      : sliced[0]
        ? Object.keys(sliced[0])
        : [];

    return {
      success: true,
      columns,
      rows: sliced,
      rowCount: sliced.length,
      truncated,
      executionTimeMs: Date.now() - input.start,
    };
  } finally {
    await connection.end().catch(() => {});
  }
}

async function executeSqliteReadOnlySQL(
  config: DatabaseConfig,
  input: ExecuteInternalInput,
): Promise<ExecuteReadOnlySQLResult> {
  const Database = (await import("better-sqlite3")).default;

  const db = new Database(config.database, {
    readonly: true,
    timeout: 10000,
  });

  try {
    const limitedSql = applyLimitIfSupported(
      input.sql,
      config.type,
      input.maxRows + 1,
    );

    if (input.abortSignal?.aborted) {
      throw new Error("Aborted");
    }

    const allRows = db.prepare(limitedSql).all() as Array<
      Record<string, unknown>
    >;

    const truncated = allRows.length > input.maxRows;
    const rows = truncated ? allRows.slice(0, input.maxRows) : allRows;
    const columns = rows[0] ? Object.keys(rows[0]) : [];

    return {
      success: true,
      columns,
      rows,
      rowCount: rows.length,
      truncated,
      executionTimeMs: Date.now() - input.start,
    };
  } finally {
    db.close();
  }
}
