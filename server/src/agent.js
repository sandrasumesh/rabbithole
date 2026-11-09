// The Claude agent. It works in a loop: it can look at the session graph, fetch pages
// it wants to understand better, and finally submit its analysis through a tool.
// Its answer is then validated by code (validate.js) before being saved.

import { fetchPageExcerpt } from "./fetchPage.js";
import { validateAnalysis } from "./validate.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_TURNS = 10;
const MAX_PAGE_FETCHES = 12;

const SYSTEM = `You analyze a person's research "rabbit hole": the pages they visited and how they clicked from one to the next.
Steps:
1. Call get_session_graph to see the pages and links.
2. If a page title is unclear, call get_page_summary on it (you have a limited budget, so only fetch pages you need).
3. Call submit_analysis exactly once with:
   - topics: 2-6 short theme names, each with the node_ids that belong to it. Every node should be in exactly one topic.
   - node_summaries: one short sentence per page describing what it covers.
   - recap: 3-5 sentences telling the story of how the person moved from their starting point to where they ended up.
   - gaps: up to 4 related subjects they have not explored yet, each with a short reason.
Be concise and factual. Do not quote pages at length.`;

const TOOLS = [
  {
    name: "get_session_graph",
    description: "Returns the pages visited in this session (id, title, domain, url, depth) and the links between them.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_page_summary",
    description: "Fetches a page by node id and returns its title, meta description and a short text excerpt.",
    input_schema: {
      type: "object",
      properties: { node_id: { type: "string" } },
      required: ["node_id"],
    },
  },
  {
    name: "submit_analysis",
    description: "Submit the final analysis. Call this exactly once, at the end.",
    input_schema: {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              node_ids: { type: "array", items: { type: "string" } },
            },
            required: ["name", "node_ids"],
          },
        },
        node_summaries: {
          type: "array",
          items: {
            type: "object",
            properties: { node_id: { type: "string" }, summary: { type: "string" } },
            required: ["node_id", "summary"],
          },
        },
        recap: { type: "string" },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, why: { type: "string" } },
            required: ["title", "why"],
          },
        },
      },
      required: ["topics", "node_summaries", "recap", "gaps"],
    },
  },
];

export async function runAgent(graph, { client } = {}) {
  // Loaded only when needed, so tests and offline mode don't require the SDK.
  const anthropic = client || new (await import("@anthropic-ai/sdk")).default();
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  let fetches = 0;
  const trace = [];

  const handleTool = async (name, input) => {
    if (name === "get_session_graph") {
      return {
        nodes: graph.nodes.map(({ id, title, domain, url, depth }) => ({ id, title, domain, url, depth })),
        edges: graph.edges.map(({ source, target }) => ({ from: source, to: target })),
      };
    }
    if (name === "get_page_summary") {
      const node = nodesById.get(input?.node_id);
      if (!node) return { error: "Unknown node_id" };
      if (fetches >= MAX_PAGE_FETCHES) return { error: "Page fetch budget used up. Work with titles." };
      fetches += 1;
      return fetchPageExcerpt(node.url);
    }
    return { error: `Unknown tool ${name}` };
  };

  const messages = [{ role: "user", content: "Analyze this research session." }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (!toolUses.length) break;

    const submitted = toolUses.find((t) => t.name === "submit_analysis");
    if (submitted) {
      trace.push({ tool: "submit_analysis" });
      return { ...validateAnalysis(graph, submitted.input), source: "ai", trace };
    }

    const results = [];
    for (const t of toolUses) {
      trace.push({ tool: t.name, input: t.input });
      const output = await handleTool(t.name, t.input);
      results.push({ type: "tool_result", tool_use_id: t.id, content: JSON.stringify(output) });
    }
    messages.push({ role: "user", content: results });
  }

  throw new Error("Agent finished without submitting an analysis");
}
