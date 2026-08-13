import React, { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import { Upload, RotateCcw, ArrowRight, ArrowLeft, ChevronDown, ChevronUp, FileText } from "lucide-react";

// ---------------------------------------------------------------------------
// Synthetic sample data — matches the exact schema of leaderboard_combined.csv
// Clearly labeled as sample data in the UI. Replace by uploading a real CSV.
// ---------------------------------------------------------------------------
const SAMPLE_CSV = `subject,type,provider,model,performance_pct,avg_cost_usd,avg_latency_s,avg_cwe_introduced,hallucination_rate_pct,total_tasks,cweval_func_pass_pct,cweval_security_pass_pct,cweval_total_runs
claude_code,agent,anthropic,claude-sonnet-5,76.2,0.21,71.0,0.10,2.1,21,79.4,66.7,63
claude_code_opus_5,agent,anthropic,claude-opus-5,85.7,0.32,58.0,0.08,1.6,21,88.9,74.6,63
claude_api,base,anthropic,claude-sonnet-5,47.6,0.07,9.2,0.05,4.8,21,71.4,60.3,75
claude_opus_5,base,anthropic,claude-opus-5,52.4,0.09,11.4,0.03,3.8,21,74.6,65.1,63
codex_cli,agent,openai,gpt-5.3-codex,47.6,0.18,44.0,0.14,3.3,21,73.0,52.4,63
gpt_api,base,openai,gpt-4.1,33.3,0.03,6.1,0.09,6.2,21,68.3,57.1,63
gemini_api,base,google,gemini-3.1-pro-preview,66.7,0.14,40.7,0.00,2.9,21,76.2,36.5,63
opencode_base,agent,google,gemini-3.1-pro-preview,23.8,0.10,27.3,0.02,5.1,21,60.3,38.1,63
mistral_large3,base,mistral,mistral-large-3,38.1,0.05,11.0,0.00,7.4,12,55.6,44.4,12
deepseek_v3,base,deepseek,deepseek-v3.2,33.3,0.02,8.7,0.11,8.9,21,60.3,50.8,12
kimi_2_7,base,moonshot,kimi-k2p7-code,28.6,0.04,13.9,0.16,9.7,21,65.1,65.1,63
opencode_sonnet5,agent,anthropic,claude-sonnet-5,81.0,0.11,233.6,0.00,1.9,21,76.2,66.7,63
opencode_opus_5,agent,anthropic,claude-opus-5,76.2,0.15,154.1,0.00,1.4,21,74.6,74.6,63
opencode_gpt5codex,agent,openai,gpt-5.3-codex,52.4,0.05,95.0,0.00,3.0,21,79.4,68.3,63
opencode_kimi,agent,moonshot,kimi-k2.5,61.9,0.28,96.2,0.00,4.4,21,71.4,73.0,63
opencode_kimi27,agent,moonshot,kimi-k2p7-code,52.4,0.04,202.1,0.00,5.0,21,65.1,63.5,63
opencode_deepseek,agent,deepseek,deepseek-v3.2,42.9,0.03,88.4,0.05,6.6,21,63.5,63.5,63
opencode_qwen,agent,qwen,qwen3-coder-next,38.1,0.06,120.3,0.08,7.1,21,63.5,63.5,63
`;

const NUMERIC_FIELDS = [
  "performance_pct", "avg_cost_usd", "avg_latency_s", "avg_cwe_introduced",
  "hallucination_rate_pct", "total_tasks", "cweval_func_pass_pct",
  "cweval_security_pass_pct", "cweval_total_runs",
];

function parseCSV(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data.map((row) => {
    const out = { ...row };
    NUMERIC_FIELDS.forEach((f) => {
      const v = parseFloat(row[f]);
      out[f] = Number.isFinite(v) ? v : null;
    });
    return out;
  }).filter((r) => r.subject);
}

// 0-100 normalization within the current dataset. `invert` = true means lower raw value is better.
function normalize(rows, field, invert) {
  const vals = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (vals.length === 0) return () => 50;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  if (max === min) return () => 100;
  return (v) => {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    const pct = ((v - min) / (max - min)) * 100;
    return invert ? 100 - pct : pct;
  };
}

function computeScores(rows) {
  const perfNorm = normalize(rows, "performance_pct", false);
  const cwevalFuncNorm = normalize(rows, "cweval_func_pass_pct", false);
  const secPassNorm = normalize(rows, "cweval_security_pass_pct", false);
  const cweIntroNorm = normalize(rows, "avg_cwe_introduced", true);
  const costNorm = normalize(rows, "avg_cost_usd", true);
  const latNorm = normalize(rows, "avg_latency_s", true);
  const hallNorm = normalize(rows, "hallucination_rate_pct", true);

  return rows.map((r) => {
    const perfParts = [perfNorm(r.performance_pct), cwevalFuncNorm(r.cweval_func_pass_pct)].filter((v) => v !== null);
    const secParts = [secPassNorm(r.cweval_security_pass_pct), cweIntroNorm(r.avg_cwe_introduced)].filter((v) => v !== null);
    const avg = (arr, fallback) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : fallback);

    return {
      ...r,
      _scores: {
        performance: avg(perfParts, 50),
        security: avg(secParts, 50),
        cost: costNorm(r.avg_cost_usd) ?? 50,
        latency: latNorm(r.avg_latency_s) ?? 50,
        accuracy: hallNorm(r.hallucination_rate_pct) ?? 50,
      },
    };
  });
}

function blockBar(score, width = 12) {
  const filled = Math.round((Math.max(0, Math.min(100, score)) / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

// ---------------------------------------------------------------------------
// Question flow
// ---------------------------------------------------------------------------
const WEIGHT_OPTIONS = [
  { label: "Not important", value: 0 },
  { label: "Somewhat important", value: 1 },
  { label: "Important", value: 2 },
  { label: "Critical", value: 3 },
];
const WEIGHT_MAX = 3;

const QUESTIONS = [
  {
    key: "performance",
    prompt: "How much does raw problem-solving capability matter?",
    hint: "Measured by task resolution rate on real GitHub bug-fix benchmarks.",
  },
  {
    key: "security",
    prompt: "How important is minimizing security risk in generated code?",
    hint: "Measured by static analysis of introduced vulnerabilities and CWE-specific test pass rate.",
  },
  {
    key: "cost",
    prompt: "How sensitive are you to cost per task?",
    hint: "Average API and inference spend per completed task.",
  },
  {
    key: "latency",
    prompt: "How important is speed?",
    hint: "Average wall-clock time from task start to a proposed fix.",
  },
  {
    key: "accuracy",
    prompt: "How much does avoiding hallucinated or broken code matter?",
    hint: "Measured by rate of references to undefined functions or non-existent APIs.",
  },
];

const TYPE_QUESTION = {
  key: "agentType",
  prompt: "What kind of tool are you looking for?",
  options: [
    { label: "An autonomous coding agent", value: "agent" },
    { label: "A direct model API call, no agent scaffolding", value: "base" },
    { label: "Either is fine", value: "either" },
  ],
};

const DIMENSION_LABELS = {
  performance: "PERFORMANCE",
  security: "SECURITY",
  cost: "COST EFFICIENCY",
  latency: "LATENCY",
  accuracy: "ACCURACY",
};

export default function ModelAdvisor() {
  const [rows, setRows] = useState(() => computeScores(parseCSV(SAMPLE_CSV)));
  const [usingSample, setUsingSample] = useState(true);
  const [fileName, setFileName] = useState(null);
  const [step, setStep] = useState(0); // 0..QUESTIONS.length-1 = weight Qs, QUESTIONS.length = type Q, +1 = results
  const [weights, setWeights] = useState({});
  const [agentType, setAgentType] = useState(null);
  const [showAllData, setShowAllData] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const fileInputRef = useRef(null);

  const totalSteps = QUESTIONS.length + 1; // + type question
  const isResults = step >= totalSteps;

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = computeScores(parseCSV(String(ev.target.result)));
        if (parsed.length === 0) throw new Error("empty");
        setRows(parsed);
        setUsingSample(false);
        setFileName(file.name);
      } catch {
        alert("Couldn't read that file. Make sure it's a CSV matching the expected columns.");
      }
    };
    reader.readAsText(file);
  }, []);

  const resetAll = useCallback(() => {
    setStep(0);
    setWeights({});
    setAgentType(null);
    setShowAllData(false);
    setExpandedRow(null);
  }, []);

  const answerWeight = (key, value) => {
    setWeights((w) => ({ ...w, [key]: value }));
    setStep((s) => s + 1);
  };

  const answerType = (value) => {
    setAgentType(value);
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const filteredRows = useMemo(() => {
    if (!agentType || agentType === "either") return rows;
    return rows.filter((r) => r.type === agentType);
  }, [rows, agentType]);

  const ranked = useMemo(() => {
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    return filteredRows
      .map((r) => {
        let overall;
        if (totalWeight === 0) {
          const vals = Object.values(r._scores);
          overall = vals.reduce((a, b) => a + b, 0) / vals.length;
        } else {
          overall = Object.entries(weights).reduce(
            (sum, [k, w]) => sum + w * (r._scores[k] ?? 50), 0
          ) / totalWeight;
        }
        return { ...r, _overall: overall };
      })
      .sort((a, b) => b._overall - a._overall);
  }, [filteredRows, weights]);

  const winner = ranked[0];

  const rationale = useMemo(() => {
    if (!winner) return null;
    const sortedDims = Object.entries(weights)
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
    const topDims = sortedDims.slice(0, 2);

    const bits = [];
    bits.push(`Resolves ${winner.performance_pct}% of benchmark tasks`);
    if (topDims.includes("cost") || sortedDims.length === 0) bits.push(`at $${winner.avg_cost_usd?.toFixed(2)}/task`);
    if (topDims.includes("latency") || sortedDims.length === 0) bits.push(`${winner.avg_latency_s}s avg latency`);
    if (topDims.includes("security")) bits.push(`${winner.cweval_security_pass_pct}% CWEval security pass rate`);
    if (topDims.includes("accuracy")) bits.push(`${winner.hallucination_rate_pct}% hallucination rate`);

    return bits.join(", ") + ".";
  }, [winner, weights]);

  const answeredLedger = useMemo(() => {
    const lines = QUESTIONS.filter((q) => weights[q.key] !== undefined).map((q) => ({
      label: DIMENSION_LABELS[q.key],
      value: weights[q.key],
      max: 3,
    }));
    if (agentType) {
      lines.push({ label: "TOOL TYPE", text: TYPE_QUESTION.options.find((o) => o.value === agentType)?.label });
    }
    return lines;
  }, [weights, agentType]);

  return (
    <div className="advisor-root">
      <style>{`
        .advisor-root {
          --bg: #F5F5F1;
          --surface: #FFFFFF;
          --ink: #14171A;
          --ink-muted: #6B6F66;
          --rule: #DADAD3;
          --accent: #1F6F54;
          --accent-tint: #EAF3EE;
          --warn: #B4530A;
          --warn-tint: #FBEEE3;
          --serif: ui-serif, Georgia, Cambria, "Times New Roman", serif;
          --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
          --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;

          background: var(--bg);
          color: var(--ink);
          font-family: var(--sans);
          min-height: 100vh;
          padding: 0;
        }
        .advisor-root * { box-sizing: border-box; }
        .shell {
          max-width: 1080px;
          margin: 0 auto;
          padding: 2.5rem 1.5rem 4rem;
        }
        .header {
          margin-bottom: 2rem;
        }
        .eyebrow {
          font-family: var(--mono);
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 0.6rem;
          font-weight: 600;
        }
        h1 {
          font-family: var(--serif);
          font-size: clamp(1.7rem, 4vw, 2.5rem);
          font-weight: 500;
          line-height: 1.15;
          margin: 0 0 0.5rem;
          letter-spacing: -0.01em;
        }
        .subhead {
          color: var(--ink-muted);
          font-size: 0.98rem;
          max-width: 42em;
          line-height: 1.5;
        }
        .data-bar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 1.25rem;
          padding: 0.65rem 0.9rem;
          background: var(--surface);
          border: 1px solid var(--rule);
          border-radius: 6px;
          font-size: 0.82rem;
          flex-wrap: wrap;
        }
        .data-bar-label {
          font-family: var(--mono);
          color: var(--ink-muted);
        }
        .data-bar-name {
          font-weight: 600;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-family: var(--sans);
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.4rem 0.75rem;
          border-radius: 5px;
          border: 1px solid var(--rule);
          background: var(--surface);
          color: var(--ink);
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .btn:hover { border-color: var(--accent); }
        .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .btn-primary:hover { background: #185c44; }

        .layout {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 1.75rem;
          align-items: start;
        }
        @media (max-width: 760px) {
          .layout { grid-template-columns: 1fr; }
        }

        .card {
          background: var(--surface);
          border: 1px solid var(--rule);
          border-radius: 10px;
          padding: 1.75rem;
        }

        .progress-dots {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1.5rem;
        }
        .dot {
          width: 1.6rem;
          height: 4px;
          border-radius: 2px;
          background: var(--rule);
        }
        .dot.done { background: var(--accent); }
        .dot.current { background: var(--ink); }

        .q-hint {
          font-family: var(--mono);
          font-size: 0.78rem;
          color: var(--ink-muted);
          margin-bottom: 1.1rem;
          line-height: 1.5;
        }
        .q-prompt {
          font-family: var(--serif);
          font-size: 1.35rem;
          font-weight: 500;
          margin-bottom: 0.6rem;
          line-height: 1.35;
        }
        .scale-note {
          font-family: var(--mono);
          font-size: 0.72rem;
          color: var(--ink-muted);
          margin-bottom: 1.1rem;
        }
        .options {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .option-btn {
          text-align: left;
          padding: 0.85rem 1rem;
          border: 1px solid var(--rule);
          border-radius: 7px;
          background: var(--surface);
          font-family: var(--sans);
          font-size: 0.95rem;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
          animation: fadeIn 0.35s ease both;
        }
        .option-btn:hover {
          border-color: var(--accent);
          background: var(--accent-tint);
        }
        .option-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .option-btn-weighted {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          width: 100%;
        }
        .option-weight {
          font-family: var(--mono);
          font-size: 0.75rem;
          color: var(--ink-muted);
          background: var(--bg);
          border: 1px solid var(--rule);
          border-radius: 4px;
          padding: 0.15rem 0.45rem;
          flex-shrink: 0;
        }
        .option-btn:hover .option-weight {
          color: var(--accent);
          border-color: var(--accent);
        }

        .nav-row {
          display: flex;
          justify-content: space-between;
          margin-top: 1.5rem;
        }

        .ledger {
          font-family: var(--mono);
          font-size: 0.82rem;
        }
        .ledger-title {
          font-family: var(--mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 1rem;
          padding-bottom: 0.6rem;
          border-bottom: 1px dashed var(--rule);
        }
        .ledger-line {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          margin-bottom: 0.7rem;
          animation: fadeIn 0.4s ease both;
        }
        .ledger-label {
          white-space: nowrap;
          color: var(--ink-muted);
        }
        .ledger-leader {
          flex: 1;
          border-bottom: 1px dotted var(--rule);
          margin-bottom: 0.3rem;
        }
        .ledger-val {
          white-space: nowrap;
          font-weight: 600;
        }
        .ledger-empty {
          color: var(--ink-muted);
          font-style: italic;
          font-size: 0.8rem;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .option-btn, .ledger-line { animation: none; }
        }

        .winner-card {
          background: var(--accent-tint);
          border: 1px solid var(--accent);
          border-radius: 10px;
          padding: 2rem;
          margin-bottom: 1.5rem;
        }
        .winner-eyebrow {
          font-family: var(--mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 0.5rem;
        }
        .winner-name {
          font-family: var(--serif);
          font-size: 1.85rem;
          margin: 0 0 0.4rem;
        }
        .winner-model {
          font-family: var(--mono);
          font-size: 0.85rem;
          color: var(--ink-muted);
          margin-bottom: 1rem;
        }
        .winner-rationale {
          font-size: 1rem;
          line-height: 1.55;
        }

        table.rank-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }
        .rank-table th {
          text-align: left;
          font-family: var(--mono);
          font-size: 0.7rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-muted);
          padding: 0.5rem 0.6rem;
          border-bottom: 1px solid var(--rule);
        }
        .rank-table td {
          padding: 0.55rem 0.6rem;
          border-bottom: 1px solid var(--rule);
          vertical-align: middle;
        }
        .rank-table tr:hover { background: #FAFAF8; cursor: pointer; }
        .rank-name { font-weight: 600; }
        .rank-bar {
          font-family: var(--mono);
          font-size: 0.78rem;
          letter-spacing: -0.5px;
          color: var(--accent);
        }
        .rank-detail {
          font-family: var(--mono);
          font-size: 0.78rem;
          color: var(--ink-muted);
          padding: 0.75rem 1rem;
          background: #FAFAF8;
        }
        .badge {
          display: inline-block;
          font-family: var(--mono);
          font-size: 0.68rem;
          padding: 0.12rem 0.4rem;
          border-radius: 4px;
          background: var(--rule);
          color: var(--ink);
        }
        .badge-agent { background: var(--accent-tint); color: var(--accent); }
        .badge-base { background: #EFEDE6; color: var(--ink-muted); }

        .footer-actions {
          display: flex;
          gap: 0.6rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }
      `}</style>

      <div className="shell">
        <div className="header">
          <div className="eyebrow">Benchmarked on SWE-bench Verified + CWEval</div>
          <h1>Which model should you use?</h1>
          <p className="subhead">
            Answer a few questions about what matters to you. Every recommendation is
            scored transparently against real benchmark results — you can see the math.
          </p>

          <div className="data-bar">
            <FileText size={15} color="var(--ink-muted)" />
            <span className="data-bar-label">
              {usingSample ? (
                <>Using <span className="data-bar-name">sample data</span> ({rows.length} subjects, synthetic)</>
              ) : (
                <>Using <span className="data-bar-name">{fileName}</span> ({rows.length} subjects)</>
              )}
            </span>
            <button className="btn" onClick={() => fileInputRef.current?.click()} style={{ marginLeft: "auto" }}>
              <Upload size={13} /> Upload your CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleUpload} style={{ display: "none" }} />
          </div>
        </div>

        {!isResults ? (
          <div className="layout">
            <div className="card">
              <div className="progress-dots">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div key={i} className={`dot ${i < step ? "done" : i === step ? "current" : ""}`} />
                ))}
              </div>

              {step < QUESTIONS.length ? (
                <QuestionPanel
                  question={QUESTIONS[step]}
                  onAnswer={(v) => answerWeight(QUESTIONS[step].key, v)}
                />
              ) : (
                <div>
                  <div className="q-hint">Filters which subjects are eligible for recommendation.</div>
                  <div className="q-prompt">{TYPE_QUESTION.prompt}</div>
                  <div className="options">
                    {TYPE_QUESTION.options.map((opt) => (
                      <button key={opt.value} className="option-btn" onClick={() => answerType(opt.value)}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="nav-row">
                <button className="btn" onClick={goBack} disabled={step === 0} style={{ opacity: step === 0 ? 0.4 : 1 }}>
                  <ArrowLeft size={13} /> Back
                </button>
              </div>
            </div>

            <div className="card">
              <div className="ledger">
                <div className="ledger-title">Scoring ledger</div>
                {answeredLedger.length === 0 ? (
                  <div className="ledger-empty">Your priorities will appear here as you answer.</div>
                ) : (
                  answeredLedger.map((line, i) => (
                    <div className="ledger-line" key={i}>
                      <span className="ledger-label">{line.label}</span>
                      <span className="ledger-leader" />
                      <span className="ledger-val">
                        {line.text ?? `${line.value}/${line.max}`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <ResultsView
            ranked={ranked}
            winner={winner}
            rationale={rationale}
            weights={weights}
            agentType={agentType}
            showAllData={showAllData}
            setShowAllData={setShowAllData}
            expandedRow={expandedRow}
            setExpandedRow={setExpandedRow}
            onReset={resetAll}
          />
        )}
      </div>
    </div>
  );
}

function QuestionPanel({ question, onAnswer }) {
  return (
    <div>
      <div className="q-hint">{question.hint}</div>
      <div className="q-prompt">{question.prompt}</div>
      <div className="scale-note">Each answer sets a weight from 0 (ignored) to {WEIGHT_MAX} (dominates the ranking).</div>
      <div className="options">
        {WEIGHT_OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            className="option-btn option-btn-weighted"
            style={{ animationDelay: `${i * 40}ms` }}
            onClick={() => onAnswer(opt.value)}
          >
            <span>{opt.label}</span>
            <span className="option-weight">{opt.value} / {WEIGHT_MAX}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultsView({ ranked, winner, rationale, weights, agentType, showAllData, setShowAllData, expandedRow, setExpandedRow, onReset }) {
  if (!winner) {
    return (
      <div className="card">
        <p>No subjects match that combination of filters. Try loosening the tool-type requirement.</p>
        <button className="btn btn-primary" onClick={onReset}><RotateCcw size={13} /> Start over</button>
      </div>
    );
  }

  const dims = ["performance", "security", "cost", "latency", "accuracy"];

  return (
    <div>
      <div className="winner-card">
        <div className="winner-eyebrow">Recommended</div>
        <h2 className="winner-name">{winner.subject}</h2>
        <div className="winner-model">
          {winner.model} · {winner.provider} ·{" "}
          <span className={`badge ${winner.type === "agent" ? "badge-agent" : "badge-base"}`}>{winner.type}</span>
        </div>
        <p className="winner-rationale">{rationale}</p>
      </div>

      <div className="card">
        <div className="ledger-title" style={{ marginBottom: "1rem" }}>
          Ranked by your priorities {agentType && agentType !== "either" ? `· ${agentType}s only` : ""}
        </div>
        <table className="rank-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Type</th>
              <th>Fit</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <React.Fragment key={r.subject}>
                <tr onClick={() => setExpandedRow(expandedRow === r.subject ? null : r.subject)}>
                  <td className="rank-name">{r.subject}</td>
                  <td><span className={`badge ${r.type === "agent" ? "badge-agent" : "badge-base"}`}>{r.type}</span></td>
                  <td>
                    <span className="rank-bar">{blockBar(r._overall)} {Math.round(r._overall)}</span>
                    {expandedRow === r.subject ? <ChevronUp size={13} style={{ marginLeft: 6, verticalAlign: "middle" }} /> : <ChevronDown size={13} style={{ marginLeft: 6, verticalAlign: "middle" }} />}
                  </td>
                </tr>
                {expandedRow === r.subject && (
                  <tr>
                    <td colSpan={3} className="rank-detail">
                      {dims.map((d) => (
                        <div key={d} style={{ marginBottom: 4 }}>
                          {DIMENSION_LABELS[d].padEnd(18, " ")} {blockBar(r._scores[d])} {Math.round(r._scores[d])}
                          {weights[d] ? ` (weight ${weights[d]}/3)` : ""}
                        </div>
                      ))}
                      <div style={{ marginTop: 8, color: "var(--ink)" }}>
                        performance {r.performance_pct}% · cost ${r.avg_cost_usd?.toFixed(2)}/task · latency {r.avg_latency_s}s ·
                        {" "}cweval security {r.cweval_security_pass_pct}% · hallucination {r.hallucination_rate_pct}%
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="footer-actions">
        <button className="btn btn-primary" onClick={onReset}><RotateCcw size={13} /> Start over</button>
      </div>
    </div>
  );
}
