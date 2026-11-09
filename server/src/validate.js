// The agent's answer is checked by code before anything is saved or shown.
// Rule: every page belongs to exactly one topic, and unknown ids are dropped.
// This is the same principle as LedgerLens: the model reasons, code guarantees correctness.

const MAX_TOPICS = 8;
const MAX_GAPS = 5;

const clip = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");

export function validateAnalysis(graph, raw = {}) {
  const validIds = new Set(graph.nodes.map((n) => n.id));
  const assigned = new Set();
  const topics = [];

  for (const t of Array.isArray(raw.topics) ? raw.topics : []) {
    if (topics.length >= MAX_TOPICS) break;
    const name = clip(t?.name, 40);
    if (!name) continue;
    const nodeIds = (Array.isArray(t.node_ids) ? t.node_ids : []).filter(
      (id) => validIds.has(id) && !assigned.has(id)
    );
    if (!nodeIds.length) continue;
    nodeIds.forEach((id) => assigned.add(id));
    topics.push({ name, nodeIds });
  }

  const leftovers = graph.nodes.map((n) => n.id).filter((id) => !assigned.has(id));
  if (leftovers.length) {
    const other = topics.find((t) => t.name.toLowerCase() === "other");
    if (other) other.nodeIds.push(...leftovers);
    else topics.push({ name: "Other", nodeIds: leftovers });
  }

  const summaries = {};
  for (const s of Array.isArray(raw.node_summaries) ? raw.node_summaries : []) {
    if (validIds.has(s?.node_id)) summaries[s.node_id] = clip(s.summary, 220);
  }

  const gaps = (Array.isArray(raw.gaps) ? raw.gaps : [])
    .map((g) => ({ title: clip(g?.title, 80), why: clip(g?.why, 240) }))
    .filter((g) => g.title)
    .slice(0, MAX_GAPS);

  return {
    topics,
    summaries,
    recap: clip(raw.recap, 1200),
    gaps,
  };
}
