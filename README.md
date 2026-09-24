# AI Playground

A minimal, stable, scalable monorepo setup designed to house future apps, services, and shared packages. 

## Architecture Philosophy

- **packages**: Shared logic, utilities, UI components, and configs.
- **services**: Backend runtime services, APIs, and background workers.
- **apps**: Frontend applications, CLIs, and specific end-user use-cases.

## Project Setup

This workspace uses `npm` and `TurboRepo` for fast, scalable dependency management and task execution.

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development environment:
   ```bash
   npm run dev
   ```

## Included Tooling

- **TypeScript** - Strict mode by default.
- **TurboRepo** - For caching and running tasks efficiently.
- **ESLint & Prettier** - Code quality and formatting.

## Documentation

- [AI Playground Roadmap](./docs/roadmap.md)
