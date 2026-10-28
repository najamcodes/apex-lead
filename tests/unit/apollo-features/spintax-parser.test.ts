import { describe, it, expect } from 'bun:test'
import { SpintaxParser } from '../../../server/src/services/cadences/SpintaxParser'

describe('SpintaxParser (Phase 5)', () => {
  it('should parse simple flat spintax variations', () => {
    const template = '{Hi|Hello|Hey} there!'
    const results = new Set<string>()

    for (let i = 0; i < 30; i++) {
      const parsed = SpintaxParser.parse(template)
      results.add(parsed)
      expect(['Hi there!', 'Hello there!', 'Hey there!']).toContain(parsed)
    }

    expect(results.size).toBeGreaterThan(1)
  })

  it('should recursively parse nested spintax choices', () => {
    const template = '{Good {morning|afternoon}|{Hey|Hi}} {first_name}!'
    const variables = { first_name: 'Marcus' }
    const validVariants = [
      'Good morning Marcus!',
      'Good afternoon Marcus!',
      'Hey Marcus!',
      'Hi Marcus!',
    ]

    for (let i = 0; i < 20; i++) {
      const parsed = SpintaxParser.parse(template, variables)
      expect(validVariants).toContain(parsed)
    }
  })

  it('should interpolate both single and double curly variable tokens', () => {
    const template = 'Hello {first_name}, I noticed {{company}} has great reviews in {location}.'
    const variables = {
      first_name: 'Sarah',
      company: 'Apex Plumbing',
      location: 'Dallas, TX',
    }

    const parsed = SpintaxParser.parse(template, variables)
    expect(parsed).toBe('Hello Sarah, I noticed Apex Plumbing has great reviews in Dallas, TX.')
  })

  it('should gracefully handle templates with no spintax or missing variables', () => {
    const template = 'Static email with {missing_var}!'
    const parsed = SpintaxParser.parse(template, {})
    expect(parsed).toBe('Static email with !')
  })
})
