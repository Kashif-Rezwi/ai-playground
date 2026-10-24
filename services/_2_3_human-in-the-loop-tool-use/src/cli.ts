/**
 * cli.ts — Human-in-the-Loop CLI Adapter
 *
 * This file is deliberately an HTTP-only adapter. It NEVER imports from
 * chat.service.ts, approval.service.ts, or any other service module.
 * All state lives in the running server; the CLI only drives it via HTTP.
 *
 * Usage (with server already running):
 *   npm run cli
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ── Config ────────────────────────────────────────────────────────────────

const BASE_URL = `http://localhost:${process.env.PORT ?? 3107}/api/chat`;

// How often to poll /runs/:runId while waiting for a resumed run (ms)
const POLL_INTERVAL_MS = 800;

// ── Tiny HTTP helpers ─────────────────────────────────────────────────────

async function post<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as T;
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  const json = await res.json() as T;
  if (!res.ok) {
    const err = (json as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json;
}

// ── Types (mirrors server response shapes — no import from service layer) ──

interface ApprovalView {
  approvalId: string;
  toolName: string;
  toolArguments: string;
  status: string;
  expiresAt: number;
}

interface RunView {
  runId: string;
  status: string;
  approvals: ApprovalView[];
  finalAnswer?: string;
  tokenCount?: number;
  retries?: number;
  error?: string;
}

// ── Poll until the run leaves pending_approval ────────────────────────────

async function waitForRunCompletion(runId: string): Promise<RunView> {
  while (true) {
    const run = await get<RunView>(`/runs/${runId}`);
    if (run.status !== 'pending_approval' && run.status !== 'running') {
      return run;
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ── Pretty printers ───────────────────────────────────────────────────────

function printBanner() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  Human-in-the-Loop Tool Use CLI        ║');
  console.log('║  Type your message. Ctrl+C to exit.    ║');
  console.log('╚════════════════════════════════════════╝\n');
}

function printRun(run: RunView) {
  const statusEmoji: Record<string, string> = {
    completed: '✅',
    rejected:  '⚠️ ',
    failed:    '❌',
    cancelled: '🚫',
    expired:   '⏰',
  };
  const emoji = statusEmoji[run.status] ?? '❓';
  console.log(`\n${emoji}  Run ${run.runId.slice(0, 8)}… — ${run.status.toUpperCase()}`);
  if (run.finalAnswer) {
    console.log(`\n💬 Assistant:\n${run.finalAnswer}`);
  }
  if (run.error) {
    console.log(`\n⚠️  Error: ${run.error}`);
  }
  if (run.tokenCount !== undefined) {
    console.log(`\n📊 Tokens used: ${run.tokenCount} | Retries: ${run.retries ?? 0}`);
  }
}

function printApprovals(approvals: ApprovalView[]) {
  const pending = approvals.filter(a => a.status === 'pending');
  if (pending.length === 0) return;

  console.log(`\n🔐 The model wants to call ${pending.length} tool(s). Review each below:\n`);
  for (let i = 0; i < pending.length; i++) {
    const a = pending[i];
    const ttlSecs = Math.max(0, Math.round((a.expiresAt - Date.now()) / 1000));
    let args: string;
    try {
      args = JSON.stringify(JSON.parse(a.toolArguments), null, 2);
    } catch {
      args = a.toolArguments;
    }
    console.log(`  [${i + 1}/${pending.length}] Tool: ${a.toolName}`);
    console.log(`        Args: ${args.replace(/\n/g, '\n              ')}`);
    console.log(`        TTL:  ${ttlSecs}s remaining`);
    console.log(`        ID:   ${a.approvalId}`);
    console.log();
  }
}

// ── Core interaction loop ─────────────────────────────────────────────────

async function handleRun(run: RunView, rl: readline.Interface): Promise<void> {
  // If the run completed on the first call (no tool use needed), just print.
  if (run.status !== 'pending_approval') {
    printRun(run);
    return;
  }

  // There are pending approvals — ask the human for each one.
  printApprovals(run.approvals);

  const pendingApprovals = run.approvals.filter(a => a.status === 'pending');

  for (const approval of pendingApprovals) {
    let answer: string;
    do {
      answer = (await rl.question(`  Approve "${approval.toolName}"? (y/n): `)).trim().toLowerCase();
    } while (answer !== 'y' && answer !== 'n');

    const route = answer === 'y' ? 'approve' : 'reject';
    try {
      console.log(`  → Posting decision: ${route}…`);
      const response = await post<{ approval: ApprovalView; run?: RunView; message?: string }>(
        `/approvals/${approval.approvalId}/${route}`
      );

      // If this was the last approval, the server resumes the run synchronously
      // and returns the completed run inline. Print it and short-circuit.
      if (response.run) {
        printRun(response.run);
        return;
      }

      // Otherwise, more approvals still pending in this batch — continue loop.
      if (response.message) {
        console.log(`  ℹ️  ${response.message}`);
      }
    } catch (err) {
      console.error(`  ❌ Decision failed: ${(err as Error).message}`);
    }
  }

  // All approvals submitted. The last one triggered resumption.
  // Poll until the run exits pending_approval (should be quick since we
  // awaited the last POST, but handle edge cases with polling).
  console.log('\n⏳ Waiting for run to complete…');
  const completed = await waitForRunCompletion(run.runId);
  printRun(completed);
}

// ── Main entry ────────────────────────────────────────────────────────────

async function main() {
  // Verify the server is reachable before entering the loop
  try {
    await fetch(`http://localhost:${process.env.PORT ?? 3107}/api/health`);
  } catch {
    console.error('❌ Cannot reach server. Make sure it is running: npm run dev');
    process.exit(1);
  }

  printBanner();

  const rl = readline.createInterface({ input, output });

  // Handle Ctrl+C gracefully
  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });

  while (true) {
    const userPrompt = (await rl.question('You: ')).trim();
    if (!userPrompt) continue;

    console.log('\n⏳ Thinking…');

    try {
      const run = await post<RunView>('/generate', { userPrompt });
      await handleRun(run, rl);
    } catch (err) {
      console.error(`\n❌ Error: ${(err as Error).message}`);
    }

    console.log('\n' + '─'.repeat(44) + '\n');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
