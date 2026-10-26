// @ts-ignore -- bun:sqlite is only available in Bun runtime
import { Database } from "bun:sqlite";
import Module from "node:module";

const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function (id: string) {
  if (id === "better-sqlite3") {
    return function (filename: string, _options?: any) {
      const db = new Database(filename, { create: true });
      (db as any).pragma = function (source: string, options?: any) {
        const result = this.prepare(`PRAGMA ${source}`).all();
        if (options && options.simple) {
          if (result && result.length > 0) return Object.values(result[0] as any)[0];
          return undefined;
        }
        return result;
      };
      const origPrepare = db.prepare.bind(db);
      (db as any).prepare = function (sql: string) {
        const stmt = origPrepare(sql);
        const isReader = /^\s*(SELECT|PRAGMA|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql);
        (stmt as any).reader = isReader;
        const origAll = stmt.all.bind(stmt);
        stmt.all = function (...params: any[]) {
          try {
            const res = origAll(...params);
            // console.log("ALL returned:", res);
            return res || []; // FORCE ARRAY!
          } catch (e) {
            console.error("ALL error:", e);
            return [];
          }
        };
        const origRun = stmt.run.bind(stmt);
        stmt.run = function (...params: any[]) {
          try {
            return origRun(...params);
          } catch (e) {
            console.error("RUN error:", e);
            throw e;
          }
        };
        return stmt;
      };
      return db;
    };
  }
  return originalRequire.apply(this, [id]);
};
