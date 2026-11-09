import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import { NEUTRAL } from "./topics.js";

const shorten = (s, n = 34) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Left-to-right layout: each column is one more click away from where you started.
function computePositions(nodes) {
  const columns = new Map();
  for (const n of [...nodes].sort((a, b) => a.firstSeen - b.firstSeen)) {
    if (!columns.has(n.depth)) columns.set(n.depth, []);
    columns.get(n.depth).push(n.id);
  }
  const positions = {};
  for (const [depth, ids] of columns) {
    ids.forEach((id, i) => {
      positions[id] = { x: depth * 230, y: (i - (ids.length - 1) / 2) * 120 };
    });
  }
  return positions;
}

// Interactive node graph. Pages are nodes, clicks between pages are arrows.
export default function Graph({ graph, topics, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  // Rebuild the graph when the data or topic colors change.
  useEffect(() => {
    if (!containerRef.current || !graph) return;
    const maxVisits = Math.max(1, ...graph.nodes.map((n) => n.visits));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [
        ...graph.nodes.map((n) => ({
          data: {
            id: n.id,
            label: shorten(n.title),
            color: topics[n.id]?.color || NEUTRAL,
            size: 26 + (n.visits / maxVisits) * 22,
          },
        })),
        ...graph.edges.map((e) => ({
          data: { id: e.id, source: e.source, target: e.target, width: 1.5 + Math.min(e.count, 4) },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            width: "data(size)",
            height: "data(size)",
            label: "data(label)",
            "font-size": 11,
            color: "#1e293b",
            "text-valign": "bottom",
            "text-margin-y": 6,
            "text-wrap": "wrap",
            "text-max-width": 140,
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.85,
            "text-background-padding": 2,
            "border-width": 2,
            "border-color": "#ffffff",
          },
        },
        { selector: "node.selected", style: { "border-color": "#0f172a", "border-width": 4 } },
        {
          selector: "edge",
          style: {
            width: "data(width)",
            "line-color": "#cbd5e1",
            "target-arrow-color": "#cbd5e1",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
      ],
      layout: {
        name: "preset",
        positions: computePositions(graph.nodes),
        fit: true,
        padding: 60,
      },
      maxZoom: 1.6,
      wheelSensitivity: 0.25,
    });

    cy.on("tap", "node", (evt) => onSelect(evt.target.id()));
    cy.on("tap", (evt) => evt.target === cy && onSelect(null));
    cyRef.current = cy;
    return () => cy.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, topics]);

  // Highlight the selected page without rebuilding the graph.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("selected");
    if (selectedId) cy.getElementById(selectedId).addClass("selected");
  }, [selectedId, graph, topics]);

  return <div className="graph" ref={containerRef} data-testid="graph" />;
}
