export class SpintaxParser {
  /**
   * Recursively parses spintax patterns like "{Hi|Hello|{Hey|Greetings}} {first_name}, {quick question|wondering if}..."
   */
  public static parse(template: string, variables: Record<string, unknown> = {}): string {
    let result = template

    // 1. Resolve spintax variations containing '|' until none remain
    const spintaxRegex = /\{([^{}]+?\|[^{}]+?)\}/
    let maxIterations = 30
    while (spintaxRegex.test(result) && maxIterations > 0) {
      result = result.replace(spintaxRegex, (_, match) => {
        const options = match.split('|')
        return options[Math.floor(Math.random() * options.length)]
      })
      maxIterations--
    }

    // 2. Interpolate provided variable tokens (both {{var}} and {var})
    for (const [key, val] of Object.entries(variables)) {
      const cleanVal = val !== null && val !== undefined ? String(val) : ''
      const doubleRegex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi')
      const singleRegex = new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi')
      result = result.replace(doubleRegex, cleanVal).replace(singleRegex, cleanVal)
    }

    // 3. Clear unmapped variable placeholders like {unknown_field} or {{missing}}
    result = result.replace(/\{\{?[a-zA-Z0-9_]+\}?/g, '')

    return result
  }
}
