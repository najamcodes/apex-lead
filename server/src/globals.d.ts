import type { RequestContext as _RC, Router as _R } from 'katal';

declare module 'wappalyzer-core';
declare module 'node-fetch';

declare global {
  // eslint-disable-next-line no-var
  var __APEX_DATA_SOURCE__: import('typeorm').DataSource | undefined;
}

declare module 'katal' {
  interface RequestContext {
    req: {
      raw: Request;
      url: string;
      method: string;
      path: string;
      header: (name: string) => string | undefined;
      param: (name?: string) => any;
      query: (name?: string) => any;
      json: () => Promise<any>;
      valid: (target: string) => any;
    };
    set(key: string, val: any): void;
    get(key: string): any;
    header(key: string, val: string): void;
    status(code: number): void;
    json(data?: any, status?: number, headers?: Record<string, string>): any;
    text(data?: any, status?: number, headers?: Record<string, string>): any;
    html(data: string, status?: number): Response;
    res?: {
      status: number;
      headers: Headers;
    };
  }

  type RouteContext = RequestContext;
  type Context = RequestContext;
  type Next = () => Promise<any>;
  type Handler = (c: RequestContext, next: Next) => Promise<any> | any;

  interface Router<TRoutes extends Record<string, any> = {}> {
    get(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    post(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    put(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    delete(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    patch(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
  }

  interface Application<TRoutes extends Record<string, any> = {}> {
    get(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    post(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    put(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    delete(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
    patch(path: string, handler: ((c: RequestContext, next?: Next) => any) | (new (...args: any[]) => any), options?: any): this;
  }
}
