import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, normalizeUrl } from "../src/graph.js";
import { validateAnalysis } from "../src/validate.js";
import { fallbackAnalysis } from "../src/fallback.js";
import { isFetchable } from "../src/fetchPage.js";
import { runAgent } from "../src/agent.js";

const visits = [
  { url: "https://a.com/start", title: "Start", fromUrl: null, ts: 1 },
  { url: "https://a.com/b#section", title: "B", fromUrl: "https://a.com/start", ts: 2 },
  { url: "https://c.org/deep", title: "Deep", fromUrl: "https://a.com/b", ts: 3 },
  { url: "https://a.com/b", title: "B", fromUrl: "https://a.com/start", ts: 4 },
];

test("normalizeUrl strips hashes and trailing slashes", () => {
  assert.equal(normalizeUrl("https://x.com/page/#top"), "https://x.com/page");
  assert.equal(normalizeUrl("not a url"), null);
});

test("buildGraph merges repeat visits and counts edges", () => {
  const g = buildGraph(visits);
  assert.equal(g.nodes.length, 3);
  assert.equal(g.edges.length, 2);
  const startToB = g.edges.find((e) => e.source === "n1" && e.target === "n2");
  assert.equal(startToB.count, 2);
  assert.deepEqual(g.nodes.map((n) => n.depth), [0, 1, 2]);
});

test("validateAnalysis puts every node in exactly one topic", () => {
  const g = buildGraph(visits);
  const result = validateAnalysis(g, {
    topics: [
      { name: "One", node_ids: ["n1", "n2", "fake"] },
      { name: "Two", node_ids: ["n2"] }, // duplicate, dropped
    ],
    node_summaries: [{ node_id: "fake", summary: "x" }, { node_id: "n1", summary: "Start page" }],
    recap: "ok",
  });
  const all = result.topics.flatMap((t) => t.nodeIds).sort();
  assert.deepEqual(all, ["n1", "n2", "n3"]);
  assert.equal(result.topics.at(-1).name, "Other");
  assert.deepEqual(Object.keys(result.summaries), ["n1"]);
});

test("fallback analysis works without an API key", () => {
  const a = fallbackAnalysis(buildGraph(visits));
  assert.equal(a.source, "offline");
  assert.ok(a.recap.includes("Start"));
});

test("SSRF guard blocks internal addresses", () => {
  assert.equal(isFetchable("http://localhost:3001/api"), false);
  assert.equal(isFetchable("http://192.168.1.1"), false);
  assert.equal(isFetchable("file:///etc/passwd"), false);
  assert.equal(isFetchable("https://en.wikipedia.org/wiki/Graph"), true);
});

test("agent loop calls tools and validates the submitted analysis", async () => {
  const g = buildGraph(visits);
  const replies = [
    { content: [{ type: "tool_use", id: "t1", name: "get_session_graph", input: {} }] },
    {
      content: [{
        type: "tool_use", id: "t2", name: "submit_analysis",
        input: { topics: [{ name: "Main", node_ids: ["n1", "n2"] }], node_summaries: [], recap: "Story", gaps: [{ title: "Next", why: "Because" }] },
      }],
    },
  ];
  const calls = [];
  const fakeClient = { messages: { create: async (req) => { calls.push(req); return replies.shift(); } } };
  const result = await runAgent(g, { client: fakeClient });
  assert.equal(calls.length, 2);
  assert.equal(result.source, "ai");
  assert.deepEqual(result.trace.map((t) => t.tool), ["get_session_graph", "submit_analysis"]);
  assert.equal(result.topics.length, 2); // "Main" + "Other" for n3
});
