import vm from 'node:vm'

export class SandboxedCodeRunner {
  private static readonly TIMEOUT_MS = 300

  /**
   * Safely executes a user-defined JS transform snippet on a record dictionary.
   */
  public static executeTransform(code: string, record: Record<string, unknown>): Record<string, unknown> {
    if (!code || typeof code !== 'string') {
      throw new Error('Sandboxed code must evaluate to a function')
    }

    // 1. Sanitize input record to prevent prototype pollution from host
    const sanitize = (obj: unknown): unknown => {
      if (obj === null || typeof obj !== 'object') return obj
      if (Array.isArray(obj)) {
        return obj.map(sanitize)
      }
      const clean: Record<string, unknown> = Object.create(null)
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
        clean[key] = typeof value === 'object' && value !== null ? sanitize(value) : value
      }
      return clean
    }

    const safeInput = sanitize(record) as Record<string, unknown>

    // 2. Wrap snippet in an isolated sandbox context
    const sandbox: Record<string, unknown> = {
      __inputRecord__: safeInput,
      console: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
      Math,
      Date,
      JSON,
      RegExp,
      Array,
      String,
      Number,
      Boolean,
    }

    const context = vm.createContext(sandbox)

    // 3. Compile and evaluate the script
    const scriptText = `
      "use strict";
      const __fn__ = (${code.trim()});
      if (typeof __fn__ !== 'function') {
        throw new Error('Sandboxed code must evaluate to a function');
      }
      const __res__ = __fn__(__inputRecord__);
      __res__;
    `

    const script = new vm.Script(scriptText)

    try {
      const rawOutput = script.runInContext(context, {
        timeout: this.TIMEOUT_MS,
        displayErrors: true,
      })

      if (rawOutput === null || typeof rawOutput !== 'object') {
        return safeInput
      }

      // 4. Return clean host object without polluted prototypes
      const cleanResult: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(rawOutput as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
        cleanResult[key] = val
      }
      return cleanResult
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('must evaluate to a function')) {
        throw err
      }
      throw new Error(`Sandboxed code transform failed: ${message}`)
    }
  }
}
