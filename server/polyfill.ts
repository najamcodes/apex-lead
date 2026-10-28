// @ts-ignore -- bun:sqlite is only available in Bun runtime
import { Database } from "bun:sqlite";
import Module from "node:module";
import { Router, RequestContext, Controller, fastJson, fastText } from "katal";

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

// ─────────────────────────────────────────────────────────────────────────────
// Native Katal Router & RequestContext Enhancements
// ─────────────────────────────────────────────────────────────────────────────

// 1. RequestContext state and helper properties
if (!Object.getOwnPropertyDescriptor(RequestContext.prototype, 'req')) {
  Object.defineProperty(RequestContext.prototype, 'req', {
    get() {
      const ctx = this;
      return {
        raw: ctx.request,
        url: ctx.request.url,
        method: ctx.request.method,
        path: new URL(ctx.request.url).pathname,
        header: (name: string) => ctx.request.headers.get(name) ?? undefined,
        param: (name?: string) => name ? ctx.params?.[name] : (ctx.params || {}),
        query: (name?: string) => name ? ctx.query?.[name] : (ctx.query || {}),
        json: async () => {
          if (ctx.body !== undefined && ctx.body !== null) return ctx.body;
          if (typeof ctx.request?.json === 'function') {
            try {
              ctx.body = await ctx.request.json();
              return ctx.body;
            } catch {
              return {};
            }
          }
          return {};
        },
        valid: (target: string) => {
          if (target === 'param' || target === 'params') return ctx.params || {};
          if (target === 'query') return ctx.query || {};
          if (target === 'json' || target === 'body') return ctx.body || {};
          return null;
        },
      };
    },
    configurable: true,
  });
}

(RequestContext.prototype as any).set = function (key: string, val: any) {
  if (!this.state) this.state = {};
  this.state[key] = val;
  if (key === 'user') this.user = val;
};

(RequestContext.prototype as any).get = function (key: string) {
  if (key === 'user' && this.user) return this.user;
  return this.state?.[key];
};

(RequestContext.prototype as any).header = function (key: string, val: string) {
  if (this.response && this.response.headers) {
    this.response.headers.set(key, val);
  }
};

(RequestContext.prototype as any).status = function (code: number) {
  this.statusCode = code;
};

// Polymorphic response generator on RequestContext
const originalJson = RequestContext.prototype.json;
(RequestContext.prototype as any).json = function (data?: any, status: number = 200, headers?: Record<string, string>) {
  if (data !== undefined) {
    const res = fastJson(data, status);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        res.headers.set(k, v);
      }
    }
    return res;
  }
  return originalJson ? originalJson.call(this) : this.request.json();
};

const originalText = RequestContext.prototype.text;
(RequestContext.prototype as any).text = function (data?: any, status: number = 200, headers?: Record<string, string>) {
  if (data !== undefined) {
    const res = fastText(String(data), status);
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        res.headers.set(k, v);
      }
    }
    return res;
  }
  return originalText ? originalText.call(this) : this.request.text();
};

(RequestContext.prototype as any).html = function (data: string, status: number = 200) {
  return new Response(String(data), {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
};

// 2. Enhance native Katal Router & Application methods to accept both function handlers and Controller classes
const httpMethods = ['get', 'post', 'put', 'delete', 'patch'] as const;
for (const method of httpMethods) {
  const orig = Router.prototype[method];
  (Router.prototype as any)[method] = function (path: string, handlerOrController: any, options?: any) {
    if (typeof handlerOrController === 'function' && !(handlerOrController.prototype instanceof Controller)) {
      this.addRoute(method.toUpperCase(), path, handlerOrController, options?.middleware || options);
      return this;
    }
    return orig.call(this, path, handlerOrController, options);
  };
}


