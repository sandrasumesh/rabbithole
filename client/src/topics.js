export const PALETTE = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];
export const NEUTRAL = "#94a3b8";

// Maps node id -> { name, color } from the analysis topics.
export function topicLookup(analysis) {
  const map = {};
  (analysis?.topics || []).forEach((t, i) => {
    const color = t.name === "Other" ? NEUTRAL : PALETTE[i % PALETTE.length];
    t.nodeIds.forEach((id) => (map[id] = { name: t.name, color }));
  });
  return map;
}
