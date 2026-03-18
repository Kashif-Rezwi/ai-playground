# Documentation

ai-playground is my personal AI engineering playground where I learn by building real systems.

It focuses on mastering LLMs, RAG, agents, and multi-agent architectures through practical implementation, with an emphasis on clean backend design, modularity, and scalability.

This is a no “vibe coding” zone — every component is built with intention, clarity, and a deep understanding of how things actually work.

## 🗺️ AI Playground Roadmap

### **Philosophy**
Each mini-app should be *minimal but complete* — no boilerplate, no abstraction layers. Just the concept, wired end-to-end, so you deeply understand what's happening.

---

## Phase 1 — Core LLM Primitives
*Understand the building blocks before anything advanced*

**1.1 — Basic Text Generation**
- Single-turn completion
- System prompts vs user prompts
- Role of temperature, top-p, max tokens
- What a context window actually means

**1.2 — Conversation & Memory**
- Multi-turn chat with message history
- How statelessness works (you send full history every time)
- Manual conversation trimming when context fills up

**1.3 — Streaming**
- Token-by-token streaming vs waiting for full response
- How SSE works under the hood
- Backpressure and buffering concepts

**1.4 — Structured Output**
- Forcing JSON output from an LLM
- Schema validation with Zod
- Why structured output matters for agentic systems

---

## Phase 2 — Tool Use & Function Calling
*This is where LLMs go from chatbots to agents*

**2.1 — Single Tool Calling**
- Defining a tool schema
- How the model decides when to call a tool
- The request → tool call → result → response loop

**2.2 — Multi-Tool Calling**
- Giving the model multiple tools to choose from
- Parallel tool calls in one turn
- How the model reasons about which tool to use

**2.3 — Human-in-the-Loop Tool Use**
- Pausing execution mid-tool-call for user confirmation
- Why this matters for safety-critical actions

**2.4 — Tool Use with External APIs**
- Calling a real external API as a tool (weather, search, etc.)
- Handling errors and retries gracefully
- Sanitizing and validating tool results before feeding back

---

## Phase 3 — RAG (Retrieval-Augmented Generation)
*Giving LLMs access to your own knowledge*

**3.1 — Embeddings from Scratch**
- What an embedding vector is conceptually
- How semantic similarity works (cosine similarity)
- Embedding a small set of documents manually

**3.2 — Vector Storage**
- Storing embeddings in a vector DB (pgvector, Pinecone, or even in-memory)
- Inserting, querying, and retrieving by similarity
- Understanding top-k retrieval

**3.3 — Naive RAG Pipeline**
- User query → embed query → retrieve chunks → inject into prompt → generate
- Chunking strategies (fixed size, sentence, paragraph)
- Why chunk size and overlap matter

**3.4 — Advanced RAG**
- Hybrid search (keyword + semantic)
- Re-ranking retrieved results
- Query rewriting before retrieval
- Handling multi-document sources

---

## Phase 4 — Agentic Patterns
*How modern AI systems actually work*

**4.1 — ReAct Pattern**
- Reasoning + Acting loop (Think → Act → Observe → Repeat)
- Implementing a basic ReAct agent from scratch
- Understanding when the loop terminates

**4.2 — Multi-Step Agent with Step Limits**
- Capping agent steps to prevent infinite loops
- Tracking intermediate steps and tool results
- Logging agent reasoning for observability

**4.3 — Supervisor / Worker Pattern**
- One agent orchestrating multiple sub-agents
- Task decomposition and delegation
- Aggregating results from parallel workers
- *(You've already built this in ReviewAI — now understand it from first principles)*

**4.4 — Reflection & Self-Critique**
- Agent reviews its own output before returning
- Critic-actor pattern
- When to loop back vs terminate

**4.5 — Long-Running Agents with State**
- Persisting agent state across steps (DB, Redis)
- Resuming interrupted agents
- Idempotency in agentic workflows

---

## Phase 5 — Memory Systems
*How agents remember things beyond a single session*

**5.1 — In-Context Memory**
- Stuffing relevant history into the prompt
- Summarizing old context when it gets too long

**5.2 — External Memory (Episodic)**
- Storing user interactions in a DB and retrieving relevant ones
- Semantic search over past conversations

**5.3 — Entity / Semantic Memory**
- Extracting and storing facts about users or topics
- Building a simple knowledge graph manually

**5.4 — Procedural Memory**
- Storing learned instructions or preferences
- Updating behavior based on past feedback

---

## Phase 6 — Prompt Engineering (Deep)
*Most engineers underinvest here*

**6.1 — Chain of Thought (CoT)**
- Making the model reason step-by-step before answering
- Zero-shot CoT vs few-shot CoT

**6.2 — Few-Shot Prompting**
- Providing examples in the prompt to shape output format
- How many examples is enough?

**6.3 — Meta-Prompting**
- Using an LLM to generate or improve prompts
- Self-improving prompt loops

**6.4 — Prompt Injection & Defense**
- How prompt injection attacks work
- Building defenses into your system prompt
- Why this matters for production agentic systems

---

## Phase 7 — Multimodal
*Beyond text*

**7.1 — Vision (Image Input)**
- Sending images to a vision model
- Document understanding (receipts, screenshots, diagrams)
- Structured extraction from images

**7.2 — Audio (Speech-to-Text & TTS)**
- Transcription with Whisper
- Text-to-speech output
- Building a basic voice interface

**7.3 — File Understanding**
- PDFs, CSVs as model input
- Chunking and parsing non-text documents

---

## Phase 8 — Evals & Observability
*How you know your AI system is actually working*

**8.1 — LLM Evals from Scratch**
- What makes a good eval?
- Building test cases for your AI outputs
- LLM-as-judge pattern

**8.2 — Tracing & Logging**
- Tracing every prompt, tool call, and response
- Using tools like LangSmith or Helicone
- Debugging agentic failures

**8.3 — Latency & Cost Tracking**
- Measuring token usage per request
- Optimizing prompt length for cost
- Caching strategies (prompt caching, semantic caching)

---

## Phase 9 — Modern Features & Frontier Concepts
*The cutting edge as of early 2026*

**9.1 — Extended Thinking / Reasoning Models**
- How models like o1, o3, Claude 3.7 Sonnet "think" before responding
- When to use reasoning models vs standard models
- Tradeoffs: latency vs quality

**9.2 — Computer Use / Browser Agents**
- Models that can control a UI
- Screenshot → action loops
- Building a basic browser automation agent

**9.3 — Code Execution in Sandboxes**
- Running model-generated code safely (E2B, Docker)
- Code interpreter pattern
- Validating output before trusting it

**9.4 — MCP (Model Context Protocol)**
- What MCP is and why it matters for tooling
- Building a simple MCP server
- How Claude Code and other tools use MCP

**9.5 — Prompt Caching**
- How provider-level prompt caching works
- Structuring prompts to maximize cache hits
- Cost savings in production

**9.6 — Fine-tuning vs Prompting**
- When fine-tuning is worth it vs just prompting better
- LoRA and PEFT concepts at a high level
- How distillation works

---

## One Rule to Follow

> For every mini-app — write a short `README` explaining **what the concept is**, **how you implemented it**, and **what you learned**. This doubles as portfolio content and forces deep understanding.

This roadmap should keep your playground busy for months. Want me to help you plan the first few mini-apps in detail?