# Agent Advisor

A guided Q&A tool that recommends a coding model or agent based on your
priorities (performance, security, cost, latency, accuracy), scored
transparently against real SWE-bench Verified + CWEval benchmark results.



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
