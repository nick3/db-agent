declare module "oracledb" {
  interface Connection {
    execute(
      sql: string,
      binds?: unknown[],
      options?: unknown,
    ): Promise<{
      rows?: unknown[][];
      metaData?: unknown[];
    }>;
    close(): Promise<void>;
  }

  interface OracleDB {
    getConnection(config: {
      user: string;
      password: string;
      connectString: string;
    }): Promise<Connection>;
  }

  const oracledb: OracleDB;
  export default oracledb;
}
