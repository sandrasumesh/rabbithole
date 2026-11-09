// Turns a flat list of visits into a graph of pages (nodes) and
// "I went from this page to that page" links (edges).
// This is plain deterministic code: the AI never decides the graph's shape.

export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function buildGraph(visits = []) {
  const nodesByUrl = new Map();
  const edgesByKey = new Map();
  const sorted = [...visits].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const getNode = (url, title, ts) => {
    let node = nodesByUrl.get(url);
    if (!node) {
      node = {
        id: `n${nodesByUrl.size + 1}`,
        url,
        title: title || url,
        domain: new URL(url).hostname.replace(/^www\./, ""),
        firstSeen: ts || 0,
        visits: 0,
      };
      nodesByUrl.set(url, node);
    } else if (title && node.title === node.url) {
      node.title = title;
    }
    return node;
  };

  for (const v of sorted) {
    const url = normalizeUrl(v.url);
    if (!url) continue;
    const node = getNode(url, v.title, v.ts);
    node.visits += 1;

    const from = v.fromUrl ? normalizeUrl(v.fromUrl) : null;
    if (from && from !== url) {
      const src = nodesByUrl.get(from) || getNode(from, null, v.ts);
      const key = `${src.id}->${node.id}`;
      const edge = edgesByKey.get(key) || { id: key, source: src.id, target: node.id, count: 0 };
      edge.count += 1;
      edgesByKey.set(key, edge);
    }
  }

  const nodes = [...nodesByUrl.values()];
  const edges = [...edgesByKey.values()];
  assignDepths(nodes, edges);
  return { nodes, edges };
}

// Breadth-first search from the "starting" pages (no incoming links)
// so the front end can lay the graph out left to right.
function assignDepths(nodes, edges) {
  const incoming = new Map(nodes.map((n) => [n.id, 0]));
  const out = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    incoming.set(e.target, incoming.get(e.target) + 1);
    out.get(e.source).push(e.target);
  }
  const depth = new Map();
  const queue = nodes.filter((n) => incoming.get(n.id) === 0).map((n) => n.id);
  if (queue.length === 0 && nodes.length) queue.push(nodes[0].id);
  queue.forEach((id) => depth.set(id, 0));

  while (queue.length) {
    const id = queue.shift();
    for (const next of out.get(id)) {
      if (!depth.has(next)) {
        depth.set(next, depth.get(id) + 1);
        queue.push(next);
      }
    }
  }
  // Pages only reachable through cycles still need a column.
  for (const n of nodes) n.depth = depth.has(n.id) ? depth.get(n.id) : 0;
}
