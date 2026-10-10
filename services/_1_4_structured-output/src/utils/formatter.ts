import { CodeReview } from "./schema";

// Padded severity labels so issue titles align
const SEVERITY_LABELS = {
    critical: "[CRITICAL]  ",
    warning: "[WARNING]   ",
    suggestion: "[SUGGESTION]",
} as const;

// 0-10 scale → a 10-char mini bar
function metricBar(score: number): string {
    const filled = Math.max(0, Math.min(10, Math.round(score)));
    return "▓".repeat(filled) + "░".repeat(10 - filled) + ` ${score}/10`;
}

// Pretty-print a validated review as a readable terminal report — NOT raw JSON (doc requirement #6)
export function formatReview(review: CodeReview): string {
    const rule = "─".repeat(58);
    const lines: string[] = [];

    lines.push(rule);
    lines.push(`  CODE REVIEW · ${review.language} · Score: ${review.overallScore}/100`);
    lines.push(`  Recommendation: ${review.recommendation.toUpperCase()}`);
    lines.push(rule);
    lines.push("");

    lines.push("  SUMMARY");
    lines.push(`  ${review.summary}`);
    lines.push("");

    lines.push(`  ISSUES (${review.issues.length})`);
    if (review.issues.length === 0) {
        lines.push("  (none listed)");
    }
    for (const issue of review.issues) {
        const lineRef = issue.line !== null ? `line ${issue.line}` : "line n/a";
        lines.push(`  ${SEVERITY_LABELS[issue.severity]} ${lineRef} — ${issue.title}`);
        lines.push(`               ${issue.description}`);
    }
    lines.push("");

    lines.push("  STRENGTHS");
    if (review.strengths.length === 0) {
        lines.push("  (none listed)");
    }
    for (const strength of review.strengths) {
        lines.push(`  + ${strength}`);
    }
    lines.push("");

    lines.push("  METRICS");
    lines.push(`  readability       ${metricBar(review.metrics.readability)}`);
    lines.push(`  maintainability   ${metricBar(review.metrics.maintainability)}`);
    lines.push(`  testability       ${metricBar(review.metrics.testability)}`);
    lines.push(rule);

    return lines.join("\n");
}
