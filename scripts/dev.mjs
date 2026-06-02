#!/usr/bin/env node
/**
 * scripts/dev.mjs
 *
 * Interactive service selector for ai-playground.
 * Auto-discovers all runnable packages from pnpm-workspace.yaml.
 *
 * Two discovery modes per package:
 *
 *   Default   — package has a `dev` script → shows as a single entry
 *   Selector  — package has a `selector` array in package.json →
 *               shows one entry per item, each pointing to a named script
 *
 * The `selector` field lets packages like structured-output expose
 * multiple named scripts (review, experiment) instead of a single dev entry.
 * Add it to any package.json to control exactly what appears in this list.
 *
 * Example in package.json:
 *   "selector": [
 *     { "label": "structured-output · review",     "script": "review"     },
 *     { "label": "structured-output · experiment", "script": "experiment" }
 *   ]
 */

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import readline from "readline";
import { fileURLToPath } from "url";

// ─── Root ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const ansi = {
    hideCursor: "\x1b[?25l",
    showCursor: "\x1b[?25h",
    moveUp: (n) => `\x1b[${n}A`,
    clearLine: "\x1b[2K\r",
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    brightWhite: "\x1b[97m",
};

const write = (str) => process.stdout.write(str);

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Parse glob patterns from pnpm-workspace.yaml.
 * No yaml library needed — the format is always this simple:
 *   packages:
 *     - "apps/*"
 *     - "services/*"
 */
function parseWorkspaceGlobs() {
    const yaml = fs.readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8");
    return yaml
        .split("\n")
        .filter(line => line.trim().startsWith("-"))
        .map(line =>
            line.trim()
                .replace(/^-\s*["']?/, "")
                .replace(/["']$/, "")
                .trim()
        );
}

/**
 * Resolve the selector entries for a single package.
 *
 * If the package.json has a `selector` array, use those entries —
 * each one becomes a separate row in the list.
 *
 * Otherwise, fall back to the `dev` script as a single entry.
 * Packages with neither are skipped entirely.
 */
function resolveEntries(pkg, pkgDir) {
    // Selector mode: package explicitly defines which scripts to expose
    if (Array.isArray(pkg.selector) && pkg.selector.length > 0) {
        return pkg.selector
            .filter(entry => {
                const valid = entry.label && entry.script && pkg.scripts?.[entry.script];
                if (!valid) {
                    console.warn(`[dev.mjs] Skipping invalid selector entry in ${pkg.name}:`, entry);
                }
                return valid;
            })
            .map(entry => ({
                label: entry.label,
                packageName: pkg.name,
                script: entry.script,
            }));
    }

    // Default mode: use the dev script
    if (pkg.scripts?.dev) {
        const label = pkg.name.includes("/")
            ? pkg.name.split("/")[1]
            : pkg.name;
        return [{ label, packageName: pkg.name, script: "dev" }];
    }

    // No dev script and no selector — skip this package
    return [];
}

/**
 * Walk all runnable workspace packages and collect selector entries.
 * Skips packages/* (shared libs, not runnable).
 * Returns entries sorted alphabetically by label.
 */
function discoverServices() {
    const globs = parseWorkspaceGlobs();
    const runnableGlobs = globs.filter(g => !g.startsWith("packages/"));
    const entries = [];

    for (const glob of runnableGlobs) {
        const pattern = path.join(ROOT, glob, "package.json");
        const matches = fs.globSync(pattern);

        for (const pkgJsonPath of matches) {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
            const pkgDir = path.dirname(pkgJsonPath);
            entries.push(...resolveEntries(pkg, pkgDir));
        }
    }

    return entries.sort((a, b) => a.label.localeCompare(b.label));
}

// ─── Render ───────────────────────────────────────────────────────────────────

// How many lines we printed last render — used to move cursor back up.
let linesRendered = 0;

/**
 * Build the full list of display lines.
 * Pure function — no side effects, no terminal writes.
 */
function buildLines(services, selectedIndex) {
    const lines = [];

    lines.push(`  ${ansi.bold}${ansi.cyan}⚡ AI Playground${ansi.reset}  ${ansi.dim}dev selector${ansi.reset}`);
    lines.push(`  ${ansi.dim}↑ ↓  navigate    Enter  run    Ctrl+C  exit${ansi.reset}`);
    lines.push(`  ${ansi.dim}${"─".repeat(46)}${ansi.reset}`);
    lines.push(""); // spacer

    for (let i = 0; i < services.length; i++) {
        const isSelected = i === selectedIndex;

        const cursor = isSelected
            ? `${ansi.bold}${ansi.cyan}›${ansi.reset}`
            : `${ansi.dim} ${ansi.reset}`;

        const label = isSelected
            ? `${ansi.bold}${ansi.brightWhite}${services[i].label}${ansi.reset}`
            : `${ansi.dim}${services[i].label}${ansi.reset}`;

        // Show the exact pnpm command only on the selected row
        const hint = isSelected
            ? `  ${ansi.dim}pnpm --filter ${services[i].packageName} ${services[i].script}${ansi.reset}`
            : "";

        lines.push(`  ${cursor} ${label}${hint}`);
    }

    lines.push(""); // bottom padding
    return lines;
}

/**
 * Render the selector in-place.
 *
 * First render  → print lines normally.
 * Re-renders    → move cursor UP by linesRendered, then clear + overwrite
 *                 each line individually.
 *
 * Never clears the whole screen — that breaks VS Code's integrated terminal.
 */
function render(services, selectedIndex) {
    const lines = buildLines(services, selectedIndex);
    const out = [];

    if (linesRendered > 0) {
        out.push(ansi.moveUp(linesRendered));
    }

    for (const line of lines) {
        out.push(`${ansi.clearLine}${line}\n`);
    }

    write(out.join(""));
    linesRendered = lines.length;
}

// ─── Launch ───────────────────────────────────────────────────────────────────

function launch(service) {
    write(ansi.showCursor);
    write("\n");
    console.log(
        `  ${ansi.bold}${ansi.green}▶ ${service.label}${ansi.reset}` +
        `  ${ansi.dim}pnpm --filter ${service.packageName} ${service.script}${ansi.reset}\n`
    );

    const child = spawn(
        "pnpm",
        ["--filter", service.packageName, service.script],
        { stdio: "inherit", shell: true }
    );

    child.on("exit", (code) => process.exit(code ?? 0));
}

// ─── Input ────────────────────────────────────────────────────────────────────

function listenForInput(services, state) {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    process.stdin.on("keypress", (_str, key) => {
        if (!key) return;

        if (key.ctrl && key.name === "c") {
            write(ansi.showCursor + "\n");
            process.exit(0);
        }

        if (key.name === "up") {
            state.selected = (state.selected - 1 + services.length) % services.length;
            render(services, state.selected);
        }

        if (key.name === "down") {
            state.selected = (state.selected + 1) % services.length;
            render(services, state.selected);
        }

        if (key.name === "return") {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            launch(services[state.selected]);
        }
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
    const services = discoverServices();

    if (services.length === 0) {
        console.error("No runnable services found (no package with a `dev` script or `selector` field).");
        process.exit(1);
    }

    const state = { selected: 0 };

    write(ansi.hideCursor);
    render(services, state.selected);
    listenForInput(services, state);

    // Always restore cursor on exit — including unexpected crashes
    process.on("exit", () => write(ansi.showCursor));
    process.on("SIGINT", () => {
        write(ansi.showCursor + "\n");
        process.exit(0);
    });
}

main();