#!/usr/bin/env node
import "dotenv/config";
import { runTask } from "./agent/runner.js";
import { startServer } from "./server.js";
import type { RunInput } from "./types.js";

const [, , command, ...args] = process.argv;

if (command === "serve") {
  const port = Number(readFlag(args, "--port") ?? process.env.JEV_BROWSER_PORT ?? 8787);
  startServer(port);
} else if (command === "run") {
  const [url, task] = args.filter((arg, index) => !isFlagValue(args, index));
  if (!url || !task) usage(1);

  const variables = parseVariables(args);
  const maxStepsRaw = readFlag(args, "--max-steps");
  const input: RunInput = {
    url,
    task,
    ...(Object.keys(variables).length ? { variables } : {}),
    ...(maxStepsRaw ? { maxSteps: Number(maxStepsRaw) } : {}),
    ...(args.includes("--allow-dangerous") ? { allowDangerous: true } : {}),
    ...(args.includes("--headed") ? { headless: false } : {}),
  };

  const result = await runTask(input);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "completed" ? 0 : 2;
} else {
  usage(command ? 1 : 0);
}

function parseVariables(args: string[]): Record<string, string> {
  const output: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== "--var") continue;
    const pair = args[i + 1];
    if (!pair) throw new Error("--var requires key=value");
    const separator = pair.indexOf("=");
    if (separator < 1) throw new Error("--var requires key=value");
    output[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return output;
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function isFlagValue(args: string[], index: number): boolean {
  const value = args[index];
  if (!value) return true;
  if (value.startsWith("--")) return true;
  return index > 0 && ["--var", "--max-steps", "--port"].includes(args[index - 1] ?? "");
}

function usage(exitCode: number): never {
  console.log(
    `jevBrowser\n\nUsage:\n  npm run dev -- run <url> <task> [--var key=value] [--max-steps N] [--headed] [--allow-dangerous]\n  npm run dev -- serve [--port 8787]\n`,
  );
  process.exit(exitCode);
  throw new Error("unreachable");
}
