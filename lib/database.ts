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
  config: DatabaseConfig
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      success: false,
      message: errorMessage,
    };
  }
}

/**
 * PostgreSQL connection test
 */
async function testPostgreSQL(
  config: DatabaseConfig,
  startTime: number
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
  startTime: number
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
    const [versionRows] = await connection.execute("SELECT VERSION() as version");
    const version = (versionRows as { version: string }[])[0]?.version || "Unknown";

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
  startTime: number
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
  startTime: number
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
    const versionResult = await pool.request().query("SELECT @@VERSION as version");
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
  startTime: number
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
        "SELECT * FROM V$VERSION WHERE BANNER LIKE 'Oracle%' AND ROWNUM = 1"
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
    const errorMessage =
      error instanceof Error ? error.message : String(error);
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
