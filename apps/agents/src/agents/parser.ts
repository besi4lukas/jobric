import { Agent } from 'agents'
import { generateObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import {
  EmailEnvelopeSchema,
  ParsedApplicationSchema,
  assertUserId,
  type Env,
} from '../types'

// ─── ParserAgent ───────────────────────────────────────────────────────────────
// Responsibility: Take a raw email and extract structured job application data.
// Uses Vercel AI SDK + Anthropic to do the heavy lifting. Stateless — D1 is the
// store of record, owned by OrchestratorAgent.
// ──────────────────────────────────────────────────────────────────────────────
export class ParserAgent extends Agent<Env> {
  async onRequest(req: Request): Promise<Response> {
    const envelope = EmailEnvelopeSchema.parse(await req.json())
    assertUserId(envelope.userId)
    const { from, subject, body } = envelope

    const { object: parsed } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      schema: ParsedApplicationSchema,
      system: `
        You are an expert at parsing job application emails.
        Extract structured data accurately. Pick the closest status from
        the schema's enum. If a field is not clearly present, omit it.
        Set confidence based on how clearly the email communicates the
        information — use "low" when the status is genuinely unclear.
      `,
      prompt: `
        Parse this job application email:

        FROM: ${from}
        SUBJECT: ${subject}
        BODY: ${body ?? '(body not available — parse from subject/sender only)'}
      `,
    })

    return Response.json(parsed)
  }
}
