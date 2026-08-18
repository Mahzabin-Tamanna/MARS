# Agent Advisor

A guided Q&A tool that recommends a coding model or agent based on your
priorities (performance, security, cost, latency, accuracy), scored
transparently against real SWE-bench Verified + CWEval benchmark results.

**Why this exists**
Most "which AI coding model should I use" advice is either a vendor's own marketing numbers or a single leaderboard score that doesn't reflect what actually matters for your specific use case. A model that tops a general benchmark might be slow, expensive, or prone to introducing security vulnerabilities — tradeoffs that get lost in a single ranking number.

**What it measures**
This tool is built on results from an independent research harness that evaluated multiple frontier and open-source models — both as raw API calls and wrapped in real coding agents (Claude Code, Codex CLI, OpenCode) — across two benchmarks:

SWE-bench Verified — real bug-fix tasks pulled from actual GitHub repositories, evaluated by applying each model's patch and running the project's real test suite in an isolated environment.
CWEval — coding tasks specifically designed to test whether generated code introduces common security vulnerabilities (SQL injection, unsafe deserialization, hardcoded credentials, and more).
For every model and agent, the harness tracked task resolution rate, cost per task, latency, security vulnerabilities introduced, and hallucination rate (references to code that doesn't exist).

**About the results**

The results shown here are from the author's own evaluation runs, run against a fixed set of tasks under identical conditions for every model and agent, so the comparison is apples-to-apples.


## Project structure

```
model-advisor/
├── index.html          entry HTML
├── vite.config.js       build config (base path lives here)
├── package.json         dependencies + deploy script
└── src/
    ├── main.jsx          React mount point
    └── ModelAdvisor.jsx  the actual application
```
