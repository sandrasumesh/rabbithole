import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.js";
import { buildGraph, normalizeUrl } from "./graph.js";
import { runAgent } from "./agent.js";
import { fallbackAnalysis } from "./fallback.js";
import { sampleSession } from "./sample.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const store = new Store(process.env.DATA_FILE || path.join(__dirname, "..", "data", "sessions.json"));

if (store.list().length === 0) {
  const s = store.create(sampleSession.name, sampleSession.visits);
  store.update(s.id, { active: false });
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const summary = (s) => ({
  id: s.id,
  name: s.name,
  createdAt: s.createdAt,
  active: s.active,
  visitCount: s.visits.length,
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.get("/api/sessions", (_req, res) => res.json(store.list().map(summary)));

app.post("/api/sessions", (req, res) => {
  // Only one recording session at a time.
  for (const s of store.list()) if (s.active) store.update(s.id, { active: false });
  const session = store.create(String(req.body?.name || "").slice(0, 80) || undefined);
  res.status(201).json(summary(session));
});

app.get("/api/sessions/active", (_req, res) => {
  const s = store.list().find((x) => x.active);
  res.json(s ? summary(s) : null);
});

app.get("/api/sessions/:id", (req, res) => {
  const s = store.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({ ...summary(s), graph: buildGraph(s.visits), analysis: s.analysis });
});

app.post("/api/sessions/:id/stop", (req, res) => {
  const s = store.update(req.params.id, { active: false });
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json(summary(s));
});

app.delete("/api/sessions/:id", (req, res) => {
  if (!store.remove(req.params.id)) return res.status(404).json({ error: "Session not found" });
  res.status(204).end();
});

app.post("/api/sessions/:id/visits", (req, res) => {
  const s = store.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  if (!s.active) return res.status(409).json({ error: "Session is not recording" });

  const url = normalizeUrl(req.body?.url);
  if (!url || !/^https?:/.test(url)) return res.status(400).json({ error: "A valid http(s) url is required" });

  const visit = {
    url,
    title: String(req.body?.title || "").slice(0, 300),
    fromUrl: req.body?.fromUrl ? normalizeUrl(req.body.fromUrl) : null,
    ts: Number(req.body?.ts) || Date.now(),
  };
  s.visits.push(visit);
  s.analysis = null; // the graph changed, so the old analysis is out of date
  store.save();
  res.status(201).json(visit);
});

app.post("/api/sessions/:id/analyze", async (req, res) => {
  const s = store.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  const graph = buildGraph(s.visits);
  if (!graph.nodes.length) return res.status(400).json({ error: "No pages recorded yet" });

  let analysis;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      analysis = await runAgent(graph);
    } catch (err) {
      console.error("Agent failed, using offline analysis:", err.message);
      analysis = { ...fallbackAnalysis(graph), warning: "AI analysis failed, showing offline summary." };
    }
  } else {
    analysis = fallbackAnalysis(graph);
  }
  analysis.createdAt = Date.now();
  store.update(s.id, { analysis });
  res.json(analysis);
});

// Serve the built React app in production (npm run build in /client).
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));

app.listen(PORT, () => {
  console.log(`Rabbit Hole API running on http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY ? "AI analysis: on" : "AI analysis: off (no ANTHROPIC_API_KEY, using offline mode)");
});
