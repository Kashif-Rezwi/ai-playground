import readline from "readline";
import { ReviewMode } from "./types";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const ansi = {
    hideCursor: "\x1b[?25l",
    showCursor: "\x1b[?25h",
    moveUp: (n: number) => `\x1b[${n}A`,
    clearLine: "\x1b[2K\r",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    brightWhite: "\x1b[97m",
};

const write = (str: string) => process.stdout.write(str);

// ─── Options ──────────────────────────────────────────────────────────────────

interface Option {
    label: string;
    description: string;
    value: ReviewMode;
}

const OPTIONS: Option[] = [
    { label: "Prompt Only", description: "instruction-following, no enforcement", value: "prompt" },
    { label: "JSON Mode", description: "guarantees valid JSON syntax", value: "json" },
    { label: "Schema Enforced", description: "guarantees valid JSON + correct shape", value: "schema" },
];

// ─── Render ───────────────────────────────────────────────────────────────────

function buildLines(selectedIndex: number): string[] {
    const lines: string[] = [];

    lines.push(`  ${ansi.bold}? Select review mode:${ansi.reset}`);
    lines.push("");

    for (let i = 0; i < OPTIONS.length; i++) {
        const isSelected = i === selectedIndex;

        const cursor = isSelected
            ? `${ansi.bold}${ansi.cyan}›${ansi.reset}`
            : `${ansi.dim} ${ansi.reset}`;

        const label = isSelected
            ? `${ansi.bold}${ansi.brightWhite}${OPTIONS[i].label}${ansi.reset}`
            : `${ansi.dim}${OPTIONS[i].label}${ansi.reset}`;

        const desc = `  ${ansi.dim}— ${OPTIONS[i].description}${ansi.reset}`;

        lines.push(`  ${cursor} ${label}${desc}`);
    }

    lines.push("");

    return lines;
}

function render(selectedIndex: number, linesRendered: number): number {
    const lines = buildLines(selectedIndex);
    const out: string[] = [];

    // Move cursor back up to overwrite previous render (skip on first render)
    if (linesRendered > 0) {
        out.push(ansi.moveUp(linesRendered));
    }

    for (const line of lines) {
        out.push(`${ansi.clearLine}${line}\n`);
    }

    write(out.join(""));
    return lines.length; // return new linesRendered count
}

// ─── Selector ─────────────────────────────────────────────────────────────────

export async function selectMode(): Promise<ReviewMode> {
    return new Promise((resolve) => {
        let selected = 0;
        let linesRendered = 0;

        // Initial render
        write(ansi.hideCursor);
        linesRendered = render(selected, linesRendered);

        // Enable keypress events
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);

        // Named handler so we can remove exactly this listener after selection
        function onKeypress(_str: string, key: { name: string; ctrl: boolean }) {
            if (!key) return;

            if (key.ctrl && key.name === "c") {
                cleanup();
                process.exit(0);
            }

            if (key.name === "up") {
                selected = (selected - 1 + OPTIONS.length) % OPTIONS.length;
                linesRendered = render(selected, linesRendered);
            }

            if (key.name === "down") {
                selected = (selected + 1) % OPTIONS.length;
                linesRendered = render(selected, linesRendered);
            }

            if (key.name === "return") {
                const chosen = OPTIONS[selected];
                cleanup();

                // Print a single confirmation line so the user sees what was chosen
                console.log(`  ${ansi.dim}› ${chosen.label}${ansi.reset}\n`);

                resolve(chosen.value);
            }
        }

        function cleanup() {
            // Remove only our listener — don't affect anything else using stdin
            process.stdin.removeListener("keypress", onKeypress);
            if (process.stdin.isTTY) process.stdin.setRawMode(false);
            process.stdin.pause();
            write(ansi.showCursor);
        }

        process.stdin.on("keypress", onKeypress);
    });
}