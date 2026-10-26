import { registerNode } from '../engine/registry'
import { makeDescriptor, textField, mainOutput, mainInput } from './descriptors'
import type { NodeHandler } from '../engine/types'
import { randomUUID } from 'crypto'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

export function registerCodeNode() {
  const handler: NodeHandler = {
    type: 'code',
    async execute(ctx) {
      const code = ctx.config.code as string
      if (!code) {
        ctx.log('error', 'No code provided')
        return
      }

      let fn: (...args: any[]) => Promise<any>
      try {
        // Compile user script inside an async context
        fn = new AsyncFunction(
          'record',
          'input',
          'config',
          'emit',
          'log',
          'ctx',
          `'use strict';\n${code}`
        )
      } catch (compileErr) {
        ctx.log('error', `Code compilation failed: ${compileErr instanceof Error ? compileErr.message : String(compileErr)}`)
        return
      }

      for (const rec of ctx.incoming) {
        if (ctx.isCancelled()) break
        await ctx.isPaused()

        let emittedCount = 0
        const emit = (out: unknown) => {
          emittedCount++
          if (out && typeof out === 'object') {
            if (Array.isArray(out)) {
              for (const item of out) {
                if (item && typeof item === 'object') {
                  ctx.emit({
                    ...rec,
                    id: randomUUID(),
                    data: { ...(item as Record<string, unknown>) },
                  })
                }
              }
            } else {
              ctx.emit({
                ...rec,
                data: { ...rec.data, ...(out as Record<string, unknown>) },
              })
            }
          }
        }

        const logHelper = (msgOrLevel: string, maybeMsg?: string) => {
          if (maybeMsg !== undefined) {
            ctx.log(msgOrLevel as 'info' | 'warn' | 'error', maybeMsg)
          } else {
            ctx.log('info', String(msgOrLevel))
          }
        }

        try {
          const inputData = ctx.input && Object.keys(ctx.input).length > 0 ? ctx.input : rec.data
          const result = await fn(
            rec.data,
            inputData,
            ctx.config,
            emit,
            logHelper,
            { ...ctx, currentRecord: rec }
          )

          // If function returned false or null explicitly, skip/drop record
          if (result === false || result === null) {
            continue
          }

          // If return value is provided and user didn't already emit manually
          if (result !== undefined && emittedCount === 0) {
            if (Array.isArray(result)) {
              for (const item of result) {
                if (item && typeof item === 'object') {
                  ctx.emit({
                    ...rec,
                    id: randomUUID(),
                    data: { ...(item as Record<string, unknown>) },
                  })
                }
              }
            } else if (typeof result === 'object') {
              ctx.emit({
                ...rec,
                data: { ...rec.data, ...(result as Record<string, unknown>) },
              })
            }
          } else if (emittedCount === 0) {
            // Default pass-through if nothing returned and nothing emitted
            ctx.emit(rec)
          }
        } catch (execErr) {
          ctx.log('error', `Execution error on record ${rec.id}: ${execErr instanceof Error ? execErr.message : String(execErr)}`)
        }
      }
    },
  }

  const defaultTemplate = `// Process input data and return output
return {
  ...input,
  // Add or modify custom properties here
};`

  const descriptor = makeDescriptor({
    type: 'code',
    name: 'Custom JS / Code',
    description: 'Execute custom JavaScript on each record to transform input data and output new fields or records.',
    category: 'Transform',
    icon: 'Code',
    color: '#6366f1',
    inputs: [mainInput],
    outputs: [mainOutput],
    configSchema: {
      code: textField(
        'JavaScript Code',
        true,
        'Available variables: input (node input), record (current data), config, emit(data), log(msg).\nReturn an object/array, or call emit() to output data.',
        defaultTemplate
      ),
    },
    help: 'Examples:\n// 1. Return transformed object:\nreturn { ...input, phone_clean: (input.phone || "").replace(/\\D/g, "") };\n\n// 2. Filter out record:\nif (!input.email) return null;\n\n// 3. Emit multiple records:\nreturn [{ item: 1 }, { item: 2 }];',
  })

  registerNode(handler, descriptor)
}
