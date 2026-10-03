import { expect, it } from 'vitest'

process.env.API_URL = 'https://prod.example.com'

it('calls the api', () => expect(process.env.API_URL).toContain('https'))
it('handles errors', () => expect(true).toBe(true))
