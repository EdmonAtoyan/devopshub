"use client";

import { Shell } from "@/components/shell";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ToolId = "yaml" | "json" | "base64" | "docker" | "cron";

const toolItems: { id: ToolId; label: string }[] = [
  { id: "yaml", label: "YAML Validator" },
  { id: "json", label: "JSON Formatter" },
  { id: "base64", label: "Base64 Encode/Decode" },
  { id: "docker", label: "Dockerfile Linter" },
  { id: "cron", label: "Cron Tester" },
];

export default function ToolsPage() {
  const [active, setActive] = useState<ToolId>("yaml");

  return (
    <Shell>
      <header className="card p-4">
        <h2 className="text-lg font-semibold">DevOps Tools</h2>
        <p className="mt-1 text-sm text-slate-400">Interactive utility set for common infrastructure workflows.</p>
      </header>

      <section className="card p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {toolItems.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setActive(tool.id)}
              className={`rounded-lg border px-3 py-2 text-xs text-left ${
                active === tool.id ? "border-accent text-accent" : "border-line text-slate-300"
              }`}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </section>

      {active === "yaml" ? <YamlValidator /> : null}
      {active === "json" ? <JsonFormatter /> : null}
      {active === "base64" ? <Base64Tool /> : null}
      {active === "docker" ? <DockerfileLinter /> : null}
      {active === "cron" ? <CronTester /> : null}
    </Shell>
  );
}

function YamlValidator() {
  const [input, setInput] = useState("apiVersion: v1\nkind: Pod\nmetadata:\n  name: demo");
  const result = useMemo(() => validateYaml(input), [input]);

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">YAML Validator</h3>
      <textarea
        className="input mt-3 min-h-64 font-mono text-xs"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <p className={`mt-3 text-xs ${result.valid ? "text-success-soft" : "text-danger-soft"}`}>
        {result.valid ? "Valid YAML structure (basic check)." : result.errors[0]}
      </p>
    </section>
  );
}

function JsonFormatter() {
  const [input, setInput] = useState('{"service":"api","replicas":3}');
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const formatJson = (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, 2));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
      setOutput("");
    }
  };

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">JSON Formatter</h3>
      <form onSubmit={formatJson} className="mt-3 space-y-3">
        <textarea className="input min-h-56 font-mono text-xs" value={input} onChange={(event) => setInput(event.target.value)} />
        <button className="btn-positive rounded-lg px-3 py-2 text-xs">Format</button>
      </form>
      {error ? <p className="mt-3 text-xs text-danger-soft">{error}</p> : null}
      {output ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-line bg-bg p-3 text-xs text-slate-200">
          <code>{output}</code>
        </pre>
      ) : null}
    </section>
  );
}

function Base64Tool() {
  const [input, setInput] = useState("terraform apply");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");

  const encode = () => {
    try {
      const bytes = new TextEncoder().encode(input);
      let binary = "";
      bytes.forEach((value) => {
        binary += String.fromCharCode(value);
      });
      setOutput(btoa(binary));
      setError("");
    } catch {
      setError("Failed to encode value");
    }
  };

  const decode = () => {
    try {
      const binary = atob(input);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      setOutput(new TextDecoder().decode(bytes));
      setError("");
    } catch {
      setError("Invalid Base64 input");
    }
  };

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">Base64 Encode / Decode</h3>
      <textarea className="input mt-3 min-h-40 font-mono text-xs" value={input} onChange={(event) => setInput(event.target.value)} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={encode} className="rounded-lg border border-line px-3 py-2 text-xs text-slate-200">
          Encode
        </button>
        <button type="button" onClick={decode} className="rounded-lg border border-line px-3 py-2 text-xs text-slate-200">
          Decode
        </button>
      </div>
      {error ? <p className="mt-3 text-xs text-danger-soft">{error}</p> : null}
      {output ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-line bg-bg p-3 text-xs text-slate-200">
          <code>{output}</code>
        </pre>
      ) : null}
    </section>
  );
}

function DockerfileLinter() {
  const [input, setInput] = useState("FROM node:latest\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD [\"npm\",\"start\"]");
  const issues = useMemo(() => lintDockerfile(input), [input]);

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">Dockerfile Linter</h3>
      <textarea className="input mt-3 min-h-56 font-mono text-xs" value={input} onChange={(event) => setInput(event.target.value)} />
      <div className="mt-3 space-y-2">
        {issues.length === 0 ? <p className="text-xs text-success-soft">No common issues detected.</p> : null}
        {issues.map((issue) => (
          <p key={issue} className="rounded-lg border border-line px-3 py-2 text-xs text-slate-300">
            {issue}
          </p>
        ))}
      </div>
    </section>
  );
}

function CronTester() {
  const [expression, setExpression] = useState("*/15 * * * *");
  const [from, setFrom] = useState("");

  useEffect(() => {
    setFrom(new Date().toISOString().slice(0, 16));
  }, []);

  const upcoming = useMemo(() => {
    if (!from) return { runs: [] as string[] };
    return getNextRuns(expression, new Date(from), 5);
  }, [expression, from]);

  return (
    <section className="card p-4">
      <h3 className="text-sm font-semibold">Cron Expression Tester</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input className="input font-mono text-xs" value={expression} onChange={(event) => setExpression(event.target.value)} />
        <input className="input text-xs" type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
      </div>
      <div className="mt-3 space-y-2">
        {upcoming.error ? <p className="text-xs text-danger-soft">{upcoming.error}</p> : null}
        {upcoming.runs.map((run) => (
          <p key={run} className="rounded-lg border border-line px-3 py-2 font-mono text-xs text-slate-200">
            {run}
          </p>
        ))}
      </div>
    </section>
  );
}

function validateYaml(input: string): { valid: boolean; errors: string[] } {
  const lines = input.split("\n");
  const stack: number[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.replace(/\t/g, "    ");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.match(/^\s*/)?.[0].length || 0;
    if (indent % 2 !== 0) {
      return { valid: false, errors: [`Line ${index + 1}: use 2-space indentation`] };
    }

    while (stack.length > 0 && indent < stack[stack.length - 1]) stack.pop();
    if (stack.length > 0 && indent > stack[stack.length - 1] + 2) {
      return { valid: false, errors: [`Line ${index + 1}: indentation jumped too far`] };
    }

    const trimmed = line.trim();
    const isList = trimmed.startsWith("- ");
    const hasKeyValue = /^[^:]+:\s*(.*)?$/.test(trimmed);

    if (!isList && !hasKeyValue) {
      return { valid: false, errors: [`Line ${index + 1}: expected key:value or list item`] };
    }

    if (hasKeyValue && trimmed.endsWith(":")) {
      stack.push(indent);
    }
  }

  return { valid: true, errors: [] };
}

function lintDockerfile(input: string): string[] {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const issues: string[] = [];

  if (!lines.some((line) => line.toUpperCase().startsWith("FROM "))) {
    issues.push("Missing FROM instruction.");
  }

  if (lines.some((line) => /^FROM\s+[^\s:]+:latest/i.test(line))) {
    issues.push("Avoid latest tags in FROM, pin a version.");
  }

  if (!lines.some((line) => line.toUpperCase().startsWith("USER "))) {
    issues.push("No USER defined. Containers should avoid running as root.");
  }

  if (lines.some((line) => /^RUN\s+apt-get\s+install/i.test(line) && !line.includes("--no-install-recommends"))) {
    issues.push("Use --no-install-recommends with apt-get install.");
  }

  if (lines.some((line) => /^ADD\s+/i.test(line))) {
    issues.push("Prefer COPY over ADD unless archive extraction is needed.");
  }

  return issues;
}

function getNextRuns(expression: string, fromDate: Date, count: number): { runs: string[]; error?: string } {
  if (Number.isNaN(fromDate.getTime())) {
    return { runs: [], error: "Invalid start date." };
  }

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { runs: [], error: "Cron must use 5 fields: min hour day month weekday" };
  }

  const [m, h, d, mo, w] = parts;
  const checks = [m, h, d, mo, w].map(parseCronField);
  if (checks.some((check) => check === null)) {
    return { runs: [], error: "Unsupported cron field format." };
  }

  const minuteCheck = checks[0]!;
  const hourCheck = checks[1]!;
  const dayCheck = checks[2]!;
  const monthCheck = checks[3]!;
  const weekCheck = checks[4]!;

  const runs: string[] = [];
  const cursor = new Date(fromDate.getTime());
  cursor.setSeconds(0, 0);

  for (let i = 0; i < 525600 && runs.length < count; i += 1) {
    cursor.setMinutes(cursor.getMinutes() + 1);

    const match =
      minuteCheck(cursor.getMinutes()) &&
      hourCheck(cursor.getHours()) &&
      dayCheck(cursor.getDate()) &&
      monthCheck(cursor.getMonth() + 1) &&
      weekCheck(cursor.getDay());

    if (match) {
      runs.push(cursor.toLocaleString());
    }
  }

  return { runs };
}

function parseCronField(field: string): ((value: number) => boolean) | null {
  if (field === "*") return () => true;

  const list = field.split(",");
  const matchers: Array<(value: number) => boolean> = [];

  for (const segment of list) {
    if (/^\*\/\d+$/.test(segment)) {
      const step = Number(segment.split("/")[1]);
      matchers.push((value) => value % step === 0);
      continue;
    }

    if (/^\d+-\d+$/.test(segment)) {
      const [start, end] = segment.split("-").map(Number);
      matchers.push((value) => value >= start && value <= end);
      continue;
    }

    if (/^\d+$/.test(segment)) {
      const exact = Number(segment);
      matchers.push((value) => value === exact);
      continue;
    }

    return null;
  }

  return (value) => matchers.some((matcher) => matcher(value));
}
