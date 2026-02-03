import { tool } from "ai";
import { z } from "zod";
import type { DatabaseConfig } from "@/lib/config-store";
import { executeReadOnlySQL, getDatabaseSchema } from "@/lib/database";

export function createDbTools(dbConfig: DatabaseConfig) {
  return {
    get_db_schema: tool({
      description: `获取当前数据库的 schema（表/列/约束/索引）。\n当前连接: ${dbConfig.name} (${dbConfig.type})`,
      inputSchema: z.object({
        tables: z
          .array(z.string())
          .optional()
          .describe("指定表名列表；不传则获取全部（内部会做数量限制）"),
        includeIndexes: z
          .boolean()
          .optional()
          .default(true)
          .describe("是否包含索引信息"),
        includeConstraints: z
          .boolean()
          .optional()
          .default(true)
          .describe("是否包含主键/外键/唯一约束等信息"),
        maxTables: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .default(50)
          .describe("最多返回多少张表的 schema"),
      }),
      execute: async (input, { abortSignal }) => {
        return getDatabaseSchema(dbConfig, {
          ...input,
          abortSignal,
        });
      },
    }),

    execute_sql: tool({
      description: `在当前数据库上执行只读 SQL（默认禁止 DDL/DML）。\n当前连接: ${dbConfig.name} (${dbConfig.type})`,
      inputSchema: z.object({
        sql: z.string().describe("要执行的 SQL（只读）"),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .default(100)
          .describe("最大返回行数"),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .max(30000)
          .optional()
          .default(10000)
          .describe("查询超时（毫秒）"),
      }),
      execute: async (input, { abortSignal }) => {
        return executeReadOnlySQL(dbConfig, { ...input, abortSignal });
      },
    }),
  };
}
