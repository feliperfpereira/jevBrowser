import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { runTask } from "./agent/runner.js";
import type { RunInput } from "./types.js";

export function startServer(port = Number(process.env.JEV_BROWSER_PORT ?? 8787)): void {
  const server = createServer(async (request, response) => {
    setJson(response);

    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method !== "POST" || request.url !== "/run") {
      response.writeHead(404);
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const input = (await readJson(request)) as RunInput;
      const result = await runTask(input);
      response.writeHead(result.status === "failed" ? 422 : 200);
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(400);
      response.end(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      );
    }
  });

  server.listen(port, () => {
    console.log(`jevBrowser listening on http://127.0.0.1:${port}`);
  });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("Request body exceeds 1 MB.");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) throw new Error("JSON body is required.");
  return JSON.parse(body);
}

function setJson(response: ServerResponse): void {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
}
