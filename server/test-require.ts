import { Database } from "bun:sqlite";
import Module from "node:module";

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
  if (id === "better-sqlite3") {
    return function (filename: string, options: any) {
      return new Database(filename, options);
    };
  }
  return originalRequire.apply(this, [id]);
};

try {
  const dbModule = require("better-sqlite3");
  const db = new dbModule("test.db");
  console.log("Success! Polyfilled better-sqlite3 using bun:sqlite");
} catch (e) {
  console.error("Failed:", e);
}
