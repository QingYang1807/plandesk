import { createApi } from "./api";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPlan, templates } from "../../core/src/templates";
import { openStore } from "./store";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const store = openStore(
  process.env.PLANDESK_DB ?? path.join(root, "data/plandesk.sqlite"),
);
if (!store.list().length)
  store.save(
    createPlan("AI 企业智能应用平台研发项目", "2026-10-01", templates[0], true),
    true,
  );
const dev = process.argv.includes("--dev");
const vite = dev
  ? await (
      await import("vite")
    ).createServer({
      root: path.join(root, "packages/client"),
      server: { middlewareMode: true },
      appType: "spa",
    })
  : null;
const port = Number(process.env.PORT ?? 4318);
const handle = createApi(store, path.join(root, "data/backups"));
createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/")) {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 16_000_000) {
        res.writeHead(413);
        res.end("Payload too large");
        return;
      }
      chunks.push(chunk);
    }
    const origin = req.headers.origin;
    const response = await handle(
      new Request(`http://127.0.0.1:${port}${req.url}`, {
        method: req.method,
        headers: origin ? { origin } : {},
        ...(req.method !== "GET" && req.method !== "HEAD"
          ? { body: Buffer.concat(chunks).toString() }
          : {}),
      }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  if (vite) {
    vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end();
    });
    return;
  }
  try {
    const relative = decodeURIComponent(url.pathname).replace(/^\//, "");
    const safe = path.resolve(root, "packages/client/dist", relative);
    const base = path.resolve(root, "packages/client/dist");
    if (!safe.startsWith(base + path.sep) && safe !== base) throw Error("path");
    const file = relative.includes(".") ? safe : path.join(base, "index.html");
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".json": "application/json",
      ".png": "image/png",
    };
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": file.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=3600",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(
    `PlanDesk http://127.0.0.1:${port} (${dev ? "development" : "local"})`,
  ),
);
