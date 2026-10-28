/**
 * Cookie utilities for Katal web framework
 */

export interface CookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none';
}

export function parseCookies(cookieHeader: string = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

import type { RequestContext } from 'katal';

export type CookieContext = RequestContext | {
  req?: { header?: (name: string) => string | undefined };
  request?: { headers?: Headers };
  headers?: Headers;
  header?: (name: string, value: string) => void;
};

export function getCookie(c: CookieContext, name: string): string | undefined {
  let cookieHeader = '';
  const ctx = c as {
    req?: { header?: (name: string) => string | undefined };
    request?: { headers?: Headers };
    headers?: Headers;
  };
  if (ctx?.req?.header) {
    cookieHeader = ctx.req.header('cookie') || '';
  } else if (ctx?.request?.headers?.get) {
    cookieHeader = ctx.request.headers.get('cookie') || '';
  } else if (ctx?.headers?.get) {
    cookieHeader = ctx.headers.get('cookie') || '';
  }
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}

export function setCookie(c: CookieContext, name: string, value: string, options: CookieOptions = {}): void {
  let cookieStr = `${name}=${encodeURIComponent(value)}`;
  if (options.path) cookieStr += `; Path=${options.path}`;
  if (options.maxAge !== undefined) cookieStr += `; Max-Age=${options.maxAge}`;
  if (options.expires) cookieStr += `; Expires=${options.expires.toUTCString()}`;
  if (options.domain) cookieStr += `; Domain=${options.domain}`;
  if (options.secure) cookieStr += `; Secure`;
  if (options.httpOnly) cookieStr += `; HttpOnly`;
  if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`;

  const ctx = c as { header?: (name: string, value: string) => void };
  if (typeof ctx?.header === 'function') {
    ctx.header('Set-Cookie', cookieStr);
  }
}
