import { CodeReview } from "./schema";
import { ReviewMode } from "./types";

const SEVERITY_ICON: Record<string, string> = {
    critical: "🔴",
    warning: "🟡",
    suggestion: "💡",
};

const RECOMMENDATION_COLOR: Record<string, string> = {
    approve: "\x1b[32m",            // green
    request_changes: "\x1b[33m",    // yellow
    needs_major_work: "\x1b[31m",   // red
};

// Pretty-prints a validated CodeReview to the terminal
export function printReview(review: CodeReview, mode: ReviewMode): void {
    const modeLabel = `\x1b[90m[${mode.toUpperCase()} MODE]\x1b[0m`;
    const recColor = RECOMMENDATION_COLOR[review.recommendation] ?? "";

    console.log(`\n${modeLabel} \x1b[1m✅ Validation passed\x1b[0m\n`);
    console.log(`\x1b[1mLanguage:\x1b[0m       ${review.language}`);
    console.log(`\x1b[1mScore:\x1b[0m          ${review.overallScore}/100`);
    console.log(`\x1b[1mRecommendation:\x1b[0m ${recColor}${review.recommendation}\x1b[0m`);
    console.log(`\x1b[1mSummary:\x1b[0m        ${review.summary}`);

    console.log(`\n\x1b[1mIssues (${review.issues.length}):\x1b[0m`);
    if (review.issues.length === 0) {
        console.log("  None found.");
    } else {
        review.issues.forEach((issue) => {
            const icon = SEVERITY_ICON[issue.severity] ?? "•";
            const line = issue.line != null ? ` \x1b[90m(line ${issue.line})\x1b[0m` : "";
            console.log(`  ${icon} \x1b[1m${issue.title}\x1b[0m${line}`);
            console.log(`     \x1b[90m${issue.description}\x1b[0m`);
        });
    }

    console.log(`\n\x1b[1mStrengths (${review.strengths.length}):\x1b[0m`);
    if (review.strengths.length === 0) {
        console.log("  None noted.");
    } else {
        review.strengths.forEach((s) => console.log(`  ✅ ${s}`));
    }

    console.log(`\n\x1b[1mMetrics:\x1b[0m`);
    console.log(`  Readability:     ${review.metrics.readability}/10`);
    console.log(`  Maintainability: ${review.metrics.maintainability}/10`);
    console.log(`  Testability:     ${review.metrics.testability}/10\n`);
}
