# AI Playground

This repository is a practical AI engineering curriculum. Each numbered service demonstrates one LLM concept end to end, with an emphasis on understanding the implementation before introducing shared abstractions.

## Repository shape

- `services/_1_*` and `services/_2_*`: focused learning labs for generation, memory, streaming, structured output, and tool calling.
- `packages/*`: reserved for code shared by more than one workspace.
- `configs`: shared TypeScript, ESLint, and Prettier configuration.
- `docs`: the learning roadmap and architecture documentation.

The labs intentionally keep some implementation details local so each concept remains easy to study. They are runnable examples, not one combined production service.

## Prerequisites

- [Node.js](https://nodejs.org/) LTS
- An API key in `.env` as required by the service being run

Install dependencies from the repository root:

```bash
npm install
```

Copy `.env.example` to `.env`, then choose a workflow.

## Development workflows

Run the interactive selector. It starts one workspace at a time:

```bash
npm run dev
```

Run a workspace directly from the root:

```bash
npm run dev:text-gen
npm run dev:convo
npm run dev:streaming
npm run dev:structured
npm run dev:single-tool
npm run dev:multi-tool
```

Default backend ports are `3101` through `3106` for the numbered services in roadmap order. Set `PORT` to override a service's default.

## Validation

Root commands run the checks provided by each workspace:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
```

Some labs do not yet expose every validation script. The root commands use npm's `--if-present` behavior while those workspace contracts are being normalized.

## Documentation

- [AI Playground Roadmap](./docs/roadmap.md)
