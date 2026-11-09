// Offline analysis used when no ANTHROPIC_API_KEY is set (or the API fails).
// Groups pages by website so the app is always usable for a demo.

import { validateAnalysis } from "./validate.js";

export function fallbackAnalysis(graph) {
  const byDomain = new Map();
  for (const n of graph.nodes) {
    if (!byDomain.has(n.domain)) byDomain.set(n.domain, []);
    byDomain.get(n.domain).push(n.id);
  }

  const topics = [];
  const singles = [];
  for (const [domain, ids] of byDomain) {
    if (ids.length > 1) topics.push({ name: domain, node_ids: ids });
    else singles.push(...ids);
  }
  if (singles.length) topics.push({ name: "Other", node_ids: singles });

  const start = [...graph.nodes].sort((a, b) => a.firstSeen - b.firstSeen)[0];
  const deepest = [...graph.nodes].sort((a, b) => b.depth - a.depth)[0];
  const recap = graph.nodes.length
    ? `You started at "${start.title}" and explored ${graph.nodes.length} pages across ` +
      `${byDomain.size} sites. The deepest point of the rabbit hole was "${deepest.title}", ` +
      `${deepest.depth} clicks from where you began. (Offline summary: add an ANTHROPIC_API_KEY for AI topics, summaries and suggestions.)`
    : "No pages recorded yet.";

  return { ...validateAnalysis(graph, { topics, recap }), source: "offline" };
}
