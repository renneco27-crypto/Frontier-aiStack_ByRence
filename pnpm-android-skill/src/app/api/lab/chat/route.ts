// src/app/api/lab/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { callLabAI } from '@/lib/nvidiaService'
import {
  checkCharLimit,
  consumeChars,
  MAX_CHARS_PER_5_HOURS,
} from '@/lib/aiCharRateLimiter'
import { resolveRequestUser } from '@/lib/supabaseServer'

// Strict context & memory character limits:
// Memory is strictly restricted to ONLY the topic and the AI's last reply.
const MAX_TOPIC_CHARS = 120
const MAX_LAST_REPLY_CHARS = 350
const MAX_USER_PROMPT_CHARS = 350
const MAX_TOTAL_MEMORY_CHARS = 600
const MAX_REPLY_OUTPUT_CHARS = 650

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(3000),
})

/**
 * Strips any leaked JSON schema keys ("problem": null, "evaluation": null,
 * "suggestedActions": [...], outer {"reply": ...}) if the model ever bleeds
 * JSON or code structure into the reply text.
 */
function stripJsonBleed(input: string): string {
  if (!input) return ''
  let text = input.trim()

  // Remove markdown code fence wrappers if the entire reply was wrapped in ```json ... ```
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Strip leading {"reply": "..." wrapper if present
  text = text.replace(/^\{\s*"reply"\s*:\s*"/i, '')

  // Cut off anything starting at leaked sibling JSON fields
  const bleedPatterns = [
    /"\s*,\s*"problem"\s*:/i,
    /\n\s*"problem"\s*:\s*(?:null|\{)/i,
    /\b"?problem"?\s*:\s*null\b/i,
    /"\s*,\s*"evaluation"\s*:/i,
    /\n\s*"evaluation"\s*:\s*(?:null|\{)/i,
    /\b"?evaluation"?\s*:\s*null\b/i,
    /"\s*,\s*"suggestedActions"\s*:/i,
    /\n\s*"suggestedActions"\s*:\s*\[/i,
    /\b"?suggestedActions"?\s*:\s*\[/i,
    /\[\s*\{\s*"label"\s*:/i,
  ]

  for (const pattern of bleedPatterns) {
    const match = text.search(pattern)
    if (match !== -1) {
      text = text.slice(0, match)
    }
  }

  // Clean trailing JSON quotes/braces left behind after truncation
  text = text
    .replace(/",\s*$/, '')
    .replace(/"\s*\}\s*$/, '')
    .replace(/^\s*"/, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim()

  // Enforce strict output character limit so replies never snowball in length
  if (text.length > MAX_REPLY_OUTPUT_CHARS) {
    const sliced = text.slice(0, MAX_REPLY_OUTPUT_CHARS)
    const lastPeriod = Math.max(
      sliced.lastIndexOf('. '),
      sliced.lastIndexOf('? '),
      sliced.lastIndexOf('.\n'),
      sliced.lastIndexOf('?\n')
    )
    text = (lastPeriod > 220 ? sliced.slice(0, lastPeriod + 1) : sliced).trim()
  }

  return text
}

/**
 * Resiliently parses the AI's JSON response even when LaTeX commands
 * (e.g. \Delta, \frac, \times, \left, \right) contain unescaped backslashes.
 */
function parseLabAiResponse(raw: string, fallbackTopic: string) {
  const defaultActions = [
    { label: 'Explain Topic', action: `Can you explain ${fallbackTopic}?` },
    { label: 'Next Step', action: 'What should I do next?' },
  ]

  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const jsonBlockMatch = cleaned.match(/\{[\s\S]*\}/)
  const candidate = jsonBlockMatch ? jsonBlockMatch[0] : cleaned

  // Attempt 1: Standard JSON.parse
  try {
    return JSON.parse(candidate)
  } catch {
    // continue to LaTeX backslash repair
  }

  // Attempt 2: Repair unescaped LaTeX backslashes inside JSON strings
  // (e.g., \Delta, \frac, \times, \theta, \right, \neq, \beta, \sqrt, \left)
  try {
    const repaired = candidate.replace(
      /\\(?!["\\/]|u[0-9a-fA-F]{4}|n(?![a-zA-Z])|r(?![a-zA-Z])|t(?![a-zA-Z])|b(?![a-zA-Z])|f(?![a-zA-Z]))/g,
      '\\\\'
    )
    return JSON.parse(repaired)
  } catch {
    // continue to regex field extraction
  }

  // Attempt 3: Regex extraction of "reply" and "suggestedActions" so raw JSON never bleeds
  const replyMatch =
    candidate.match(/"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:problem|evaluation|suggestedActions)"/) ||
    candidate.match(/"reply"\s*:\s*"([\s\S]*?)"\s*\}/)

  const extractedReply = replyMatch ? stripJsonBleed(replyMatch[1]) : stripJsonBleed(cleaned)

  const extractedActions: Array<{ label: string; action: string }> = []
  const actionRegex = /\{\s*"label"\s*:\s*"([^"]+)"\s*,\s*"action"\s*:\s*"([^"]+)"\s*\}/g
  let actionMatch: RegExpExecArray | null
  while ((actionMatch = actionRegex.exec(candidate)) !== null) {
    extractedActions.push({
      label: actionMatch[1].trim(),
      action: actionMatch[2].trim(),
    })
  }

  return {
    reply: extractedReply,
    problem: null,
    evaluation: null,
    suggestedActions: extractedActions.length > 0 ? extractedActions.slice(0, 3) : defaultActions,
  }
}

const ScreenContextSchema = z.object({
  screen: z.enum(['math', 'code', 'gallery', 'enumeration']),
  topic: z.string().default('General Topic'),
  activeTab: z.string().optional(), // 'solver' | 'notebook' | 'ide' | 'gallery'
  mode: z.string().optional(), // 'scenario' | 'bug_hunter' | 'practice'
  problem: z.string().optional(),
  problemBreakdown: z
    .object({
      restate: z.string().optional(),
      given: z.array(z.string()).optional(),
      formula_master: z.string().optional(),
      formula_working: z.string().optional(),
    })
    .optional(),
  answer: z.string().optional(),
  currentStep: z.number().optional(),
  totalSteps: z.number().optional(),
  activeStepLatex: z.string().optional(),
  activeStepExplanation: z.string().optional(),
  symbolTable: z.array(
    z.object({
      symbol: z.string(),
      meaning: z.string(),
      unit: z.string().optional(),
    })
  ).optional(),
  solutionSteps: z.string().optional(),
  keyTakeaway: z.string().optional(),
  language: z.string().optional(),
  userCode: z.string().optional(),
  starterTemplate: z.string().optional(),
  expectedKeywords: z.array(z.string()).optional(),
  expectedOutput: z.string().optional(),
  bugDescriptions: z.array(z.string()).optional(),
  feedbackStatus: z.string().optional(),
  feedbackOutput: z.string().optional(),
}).optional()

const RequestSchema = z.object({
  kind: z.enum(['math', 'code', 'gallery', 'enumeration']),
  deckId: z.string().min(1),
  notes: z
    .array(
      z.object({
        front: z.string().max(1000),
        back: z.string().max(10000).optional(),
        subject: z.string().max(200).optional(),
      })
    )
    .max(60)
    .optional()
    .default([]),
  messages: z.array(MessageSchema).max(25),
  thoughtSummary: z.string().max(1500).optional(),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  language: z.string().optional(),
  action: z.enum(['start', 'reply']).default('reply'),
  screenContext: ScreenContextSchema,
})

function buildSystemPrompt(
  kind: 'math' | 'code' | 'gallery' | 'enumeration',
  ctx?: z.infer<typeof ScreenContextSchema>,
  lastReplyMemory?: string
): string {
  const safeTopic = (ctx?.topic || 'General Topic').slice(0, MAX_TOPIC_CHARS)
  const safeLastReply = lastReplyMemory ? stripJsonBleed(lastReplyMemory).slice(0, MAX_LAST_REPLY_CHARS) : ''

  if (kind === 'enumeration') {
    return `You are a concise Study Tutor defining terms for study flashcards and quizzes.
Active Context:
- Topic / Heading: "${safeTopic}"

STRICT RULES:
1. Provide a direct, natural 1-2 sentence definition or explanation of the given answer term specifically in the context of "${safeTopic}".
2. Strict length limit: under 35 words (max 220 characters).
3. Do NOT use emojis anywhere.
4. Return valid JSON ONLY matching this schema:
{
  "reply": "1-2 sentence concise explanation of the term in context (under 35 words).",
  "problem": null,
  "evaluation": null,
  "suggestedActions": []
}`
  }

  if (kind === 'gallery') {
    return `You are a concise Visual Study & Diagram Tutor connected to the student's Gallery.
Active Context (Strict Memory - Topic & Last Reply Only):
- Topic: "${safeTopic}"
${ctx?.problem ? `- Active Notes: ${ctx.problem.slice(0, 220)}` : ''}
${safeLastReply ? `- Your Last Reply: "${safeLastReply}"` : ''}

STRICT OUTPUT RULES:
1. Do NOT use emojis anywhere.
2. Keep "reply" under 45 words (max 300 characters). Never output JSON or CSS syntax inside "reply".
3. Return valid JSON ONLY matching this schema:
{
  "reply": "Short, clear visual explanation or study tip (under 45 words).",
  "problem": null,
  "evaluation": null,
  "suggestedActions": [
    { "label": "Give me images", "action": "Give me images from notes" },
    { "label": "Explain key diagram", "action": "Explain the main visual concept in my notes" }
  ]
}`
  }
  if (kind === 'math') {
    const bd = ctx?.problemBreakdown
    const breakdownLines: string[] = []
    if (bd?.restate) breakdownLines.push(`  Restated Problem: ${bd.restate.slice(0, 160)}`)
    if (bd?.given && bd.given.length > 0) breakdownLines.push(`  Given: ${bd.given.join(', ').slice(0, 140)}`)
    if (bd?.formula_master) breakdownLines.push(`  Master Formula: ${bd.formula_master.slice(0, 120)}`)
    if (bd?.formula_working) breakdownLines.push(`  Working Formula: ${bd.formula_working.slice(0, 120)}`)

    return `You are a concise, conversational Math & Physics tutor.
Active Context (Strict Memory - Topic & Last Reply Only):
- Topic Heading: "${safeTopic}"
${breakdownLines.length > 0 ? `- Problem Breakdown:\n${breakdownLines.join('\n')}` : ctx?.problem ? `- Problem: ${ctx.problem.slice(0, 220)}` : ''}
${ctx?.activeStepLatex ? `- Focused Step: ${ctx.activeStepLatex.slice(0, 120)} (${(ctx.activeStepExplanation || '').slice(0, 120)})` : ''}
${safeLastReply ? `- Your Last Reply: "${safeLastReply}"` : ''}

EXPLANATION & LENGTH RULES (CRITICAL):
1. STRICT LENGTH CAP: Keep "reply" concise and focused—under 95 words (max 550 characters). Do NOT write long essays.
2. STRUCTURED STEP-BY-STEP BREAKDOWN:
   - Use 2 to 3 short numbered steps with bold headers and bullet points ("• ").
   - Enclose formulas in inline LaTeX $...$ and double-escape all backslashes in JSON strings (e.g. "\\\\Delta x = \\\\frac{b-a}{n}").
3. NEVER include raw JSON keys ("problem", "evaluation", "suggestedActions") or code blocks inside the "reply" text.
4. End "reply" with one short follow-up question.
5. Only fill "problem" when the student explicitly asks for a new practice problem; otherwise set it to null.
6. Only fill "evaluation" when the student submitted an answer to check; otherwise set it to null.
7. Do NOT use emojis anywhere.
8. Return valid JSON ONLY matching this schema:
{
  "reply": "Concise step-by-step breakdown (under 95 words) ending with a short follow-up question.",
  "problem": null,
  "evaluation": null,
  "suggestedActions": [
    { "label": "Short action label", "action": "Prompt text when clicked" }
  ]
}`
  }

  // kind === 'code'
  const modeLabel = ctx?.mode || 'scenario'

  return `You are a concise, conversational Software Engineering tutor.
Active Context (Strict Memory - Topic & Last Reply Only):
- Topic Heading: "${safeTopic}"
- Language: ${ctx?.language || 'code'} (${modeLabel})
${ctx?.userCode ? `- Current Student Code:\n\`\`\`${ctx.language || 'text'}\n${ctx.userCode.slice(0, 600)}\n\`\`\`` : ''}
${ctx?.starterTemplate ? `- Target Solution:\n\`\`\`${ctx.language || 'text'}\n${ctx.starterTemplate.slice(0, 500)}\n\`\`\`` : ''}
${ctx?.expectedOutput ? `- Expected Output: ${ctx.expectedOutput.slice(0, 150)}` : ''}
${ctx?.feedbackOutput ? `- Execution Output: ${ctx.feedbackOutput.slice(0, 150)}` : ''}
${safeLastReply ? `- Your Last Reply: "${safeLastReply}"` : ''}

STRUCTURED WALKTHROUGH & LENGTH RULES (CRITICAL):
1. STRICT LENGTH CAP: Keep "reply" under 90 words (max 520 characters). Never output a dense wall of text.
2. Walk through logic using 2-3 short bullet points ("• ") with bold labels.
3. NEVER include raw JSON keys ("problem", "evaluation", "suggestedActions") inside "reply".
4. When the student asks to check their code, fill "evaluation"; otherwise set "evaluation" to null.
5. End "reply" with one short follow-up question.
6. Do NOT use emojis anywhere.
7. Return valid JSON ONLY matching this schema:
{
  "reply": "Concise walkthrough (under 90 words), ending with a short follow-up question.",
  "problem": null,
  "evaluation": null,
  "suggestedActions": [
    { "label": "Short action label", "action": "Prompt text when clicked" }
  ]
}`
}

export async function POST(req: NextRequest) {
  const user = await resolveRequestUser(req)

  // 1. Parse request payload
  let body: z.infer<typeof RequestSchema>
  try {
    const rawJson = await req.json()
    body = RequestSchema.parse(rawJson)
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid request body', details: err?.message }, { status: 400 })
  }

  if (!user && body.kind !== 'enumeration') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const rateKey =
    user?.id ||
    req.headers.get('x-account-id') ||
    req.headers.get('x-user-id') ||
    'guest-enumeration'

  // 2. Check Rate Limit (20k characters / 5 hours)
  const charLimitCheck = checkCharLimit(rateKey)
  if (!charLimitCheck.allowed) {
    const hoursRemaining = (charLimitCheck.resetInSeconds / 3600).toFixed(1)
    return NextResponse.json(
      {
        error: `Rate limit reached: You have exhausted your 20,000 AI character quota for this 5-hour window. Resets in ${hoursRemaining} hours.`,
        remainingChars: 0,
        resetAt: charLimitCheck.resetAt,
        resetInSeconds: charLimitCheck.resetInSeconds,
      },
      { status: 429 }
    )
  }

  // Extract ONLY the last assistant reply and the latest student prompt
  const topic = (body.screenContext?.topic || 'Current Topic').slice(0, MAX_TOPIC_CHARS)
  const lastAssistantMsg = [...body.messages].reverse().find((m) => m.role === 'assistant')
  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user')

  const lastAssistantReply = lastAssistantMsg
    ? stripJsonBleed(lastAssistantMsg.content).slice(0, MAX_LAST_REPLY_CHARS)
    : body.thoughtSummary
      ? stripJsonBleed(body.thoughtSummary).slice(0, MAX_LAST_REPLY_CHARS)
      : ''

  const systemPrompt = buildSystemPrompt(body.kind, body.screenContext, lastAssistantReply)

  // Build strictly bounded prompt with ONLY the topic, last assistant reply, and current student message
  let userPrompt = ''
  if (lastUserMsg) {
    const cleanUserText = lastUserMsg.content.trim().slice(0, MAX_USER_PROMPT_CHARS)
    const parts = [
      `TOPIC: ${topic}`,
      ...(lastAssistantReply ? [`LAST_TUTOR_REPLY: ${lastAssistantReply}`] : []),
      `STUDENT: ${cleanUserText}`,
    ]
    userPrompt = parts.join('\n').slice(0, MAX_TOTAL_MEMORY_CHARS)
  } else {
    userPrompt = `TOPIC: ${topic}\nSTUDENT: Explain the key formula and problem breakdown for "${topic}".`.slice(
      0,
      MAX_TOTAL_MEMORY_CHARS
    )
  }

  // 3. Call AI with fast Gemini primary + cached provider fallback
  let aiResult: { text: string; provider: string; model: string }
  try {
    aiResult = await callLabAI(systemPrompt, userPrompt)
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[lab/chat] AI generation failed:', msg)
    return NextResponse.json({ error: `AI provider error: ${msg}` }, { status: 502 })
  }

  // 4. Consume generated characters against the 20k / 5h quota
  const generatedLength = aiResult.text.length
  const quota = consumeChars(rateKey, generatedLength)

  // 5. Parse JSON output safely & strip any JSON/code bleeding
  const parsed = parseLabAiResponse(aiResult.text, topic)

  let replyText = stripJsonBleed(String(parsed.reply ?? ''))
  if (!replyText) {
    const ev = parsed.evaluation
    const pr = parsed.problem
    if (ev?.feedback) {
      replyText = stripJsonBleed(
        `Okay, let's go through it together. ${ev.feedback}${ev.hint ? ` Here's a hint: ${ev.hint}` : ''} Want to try the next step?`
      )
    } else if (pr?.question) {
      replyText = stripJsonBleed(
        `Alright, here's one to try. ${pr.question} Take it one step at a time. Want a hint to start?`
      )
    } else {
      replyText = `Let's break down ${topic} step by step. Which part would you like to focus on first?`
    }
  }

  const cleanActions = Array.isArray(parsed.suggestedActions)
    ? parsed.suggestedActions
        .filter((a: any) => a && typeof a.label === 'string' && typeof a.action === 'string')
        .slice(0, 3)
        .map((a: any) => ({
          label: a.label.slice(0, 36),
          action: a.action.slice(0, 160),
        }))
    : []

  return NextResponse.json({
    reply: replyText,
    problem: parsed.problem && typeof parsed.problem === 'object' ? parsed.problem : null,
    evaluation: parsed.evaluation && typeof parsed.evaluation === 'object' ? parsed.evaluation : null,
    suggestedActions: cleanActions,
    provider: aiResult.provider,
    model: aiResult.model,
    quota: {
      remainingChars: quota.remainingChars,
      usedChars: quota.usedChars,
      maxChars: MAX_CHARS_PER_5_HOURS,
      resetAt: quota.resetAt,
    },
  })
}
