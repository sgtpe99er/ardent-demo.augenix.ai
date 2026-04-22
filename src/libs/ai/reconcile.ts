/**
 * Ardent Advisors AI - Vendor Statement Reconciliation
 *
 * Orchestrates 3 parallel AI runs + 1 consensus run using the Vercel
 * AI Gateway. Prompt files live in /prompts at the project root.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

// Models - use strong reasoning models for runs; a slightly heavier one for consensus
const RUN_MODEL = process.env.AA_RECON_RUN_MODEL ?? 'openai/gpt-4.1-mini';
const CONSENSUS_MODEL = process.env.AA_RECON_CONSENSUS_MODEL ?? 'openai/gpt-4.1';

export interface ReconInvoice {
  invoice_number: string;
  lk_code: string;
  amount: number;
  invoice_date: string;
  status: string;
}

export interface ReconMatch {
  invoice_number: string;
  lk_code: string;
  system_amount: number;
  statement_amount: number;
  difference: number;
  status: 'matched' | 'flagged';
  confidence: number;
  reasoning: string;
  oddity_flag: string | null;
}

export interface ReconResult {
  matches: ReconMatch[];
  overall_match_rate: number;
  summary: string;
  warnings: string[];
  consensus_notes?: string;
}

export interface ReconRunBundle {
  runs: { label: string; model: string; result: ReconResult; duration_ms: number }[];
  consensus: { model: string; result: ReconResult; duration_ms: number };
}

// ------------- prompt loading (cached) ----------------------------------

let cachedPrompts: { system: string; user: string; consensus: string } | null = null;

async function loadPrompts() {
  if (cachedPrompts) return cachedPrompts;
  const promptsDir = path.join(process.cwd(), 'prompts');
  const [system, user, consensus] = await Promise.all([
    readFile(path.join(promptsDir, 'system-prompt.md'), 'utf8'),
    readFile(path.join(promptsDir, 'user-prompt-template.md'), 'utf8'),
    readFile(path.join(promptsDir, 'consensus-prompt.md'), 'utf8'),
  ]);
  cachedPrompts = { system, user, consensus };
  return cachedPrompts;
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ------------- gateway call ---------------------------------------------

async function callGateway(params: {
  model: string;
  system?: string;
  user: string;
  temperature?: number;
}): Promise<{ content: string; duration_ms: number }> {
  if (!AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is not configured');
  }
  const started = Date.now();
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (params.system) messages.push({ role: 'system', content: params.system });
  messages.push({ role: 'user', content: params.user });

  const response = await fetch(`${AI_GATEWAY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages,
      temperature: params.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI Gateway ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? '';
  return { content, duration_ms: Date.now() - started };
}

function parseJson<T>(raw: string): T {
  // strip ```json fences if present
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : raw;
  return JSON.parse(body) as T;
}

// ------------- public: run full reconciliation --------------------------

export interface RunReconciliationInput {
  vendor_name: string;
  period_start: string;
  period_end: string;
  statement_total: number;
  statement_text: string;
  invoices: ReconInvoice[];
}

export async function runReconciliation(input: RunReconciliationInput): Promise<ReconRunBundle> {
  const prompts = await loadPrompts();

  const userPrompt = fillTemplate(prompts.user, {
    vendor_name: input.vendor_name,
    period_start: input.period_start,
    period_end: input.period_end,
    statement_total: input.statement_total.toFixed(2),
    system_invoices_json: JSON.stringify(input.invoices, null, 2),
    statement_text: input.statement_text,
  });

  // 3 parallel runs with slightly varied temperatures to encourage
  // independent reasoning paths while keeping output deterministic-ish.
  const runTemps = [0.1, 0.3, 0.5];
  const runPromises = runTemps.map(async (t, idx) => {
    const { content, duration_ms } = await callGateway({
      model: RUN_MODEL,
      system: prompts.system,
      user: userPrompt,
      temperature: t,
    });
    return {
      label: `run_${idx + 1}`,
      model: RUN_MODEL,
      result: parseJson<ReconResult>(content),
      duration_ms,
    };
  });
  const runs = await Promise.all(runPromises);

  // consensus
  const consensusUser = fillTemplate(prompts.consensus, {
    run1_json: JSON.stringify(runs[0].result),
    run2_json: JSON.stringify(runs[1].result),
    run3_json: JSON.stringify(runs[2].result),
  });
  const consensusResp = await callGateway({
    model: CONSENSUS_MODEL,
    user: consensusUser,
    temperature: 0.1,
  });
  const consensus = {
    model: CONSENSUS_MODEL,
    result: parseJson<ReconResult>(consensusResp.content),
    duration_ms: consensusResp.duration_ms,
  };

  return { runs, consensus };
}
