import { Agent } from 'agents'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { ParsedApplicationSchema, type Env } from '../types'

// ─── ParserAgent ───────────────────────────────────────────────────────────────
// Responsibility: Take a raw email and extract structured job application data.
// Uses Vercel AI SDK + Anthropic to do the heavy lifting.
//
// Each parse result is stored in this agent's SQLite for audit/replay.
// ──────────────────────────────────────────────────────────────────────────────
export class ParserAgent extends Agent<Env> {
  async onRequest(req: Request): Promise<Response> {
    const { from, subject, body } = await req.json<{
      from: string
      subject: string
      body?: string
    }>()

    // ── LLM Call via Vercel AI SDK ──────────────────────────────────────────
    // generateObject forces Claude to respond in the exact shape of our Zod schema.
    // No JSON.parse, no error handling for malformed output — the SDK handles it.
    const { object: parsed } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: ParsedApplicationSchema,
      system: `
        You are an expert at parsing job application emails.
        Extract structured data accurately. 
        If a field is not clearly present, omit it or use "unknown".
        Set confidence based on how clearly the email communicates the information.
      `,
      prompt: `
        Parse this job application email:

        FROM: ${from}
        SUBJECT: ${subject}
        BODY: ${body ?? '(body not available — parse from subject/sender only)'}
      `,
    })

    // Store parsed result in this agent's built-in SQLite
    this.sql`
      INSERT INTO parsed_emails (company, role, status, confidence, parsed_at)
      VALUES (
        ${parsed.company},
        ${parsed.role},
        ${parsed.status},
        ${parsed.confidence},
        ${new Date().toISOString()}
      )
    `

    return Response.json(parsed)
  }
}
