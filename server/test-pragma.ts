import { Database } from "bun:sqlite";

const db = new Database(":memory:");
db.run("CREATE TABLE test (id INT)");
const res = db.prepare('PRAGMA index_list("test")').all();
console.log("Result is array?", Array.isArray(res));
console.log("Result value:", res);
