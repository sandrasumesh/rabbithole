// A sample research session so the app has something to show on first run.

const t0 = Date.UTC(2026, 10, 8, 20, 0, 0);
const at = (min) => t0 + min * 60_000;

const W = "https://en.wikipedia.org/wiki/";

export const sampleSession = {
  name: "Sample: How do AI agents work?",
  visits: [
    { url: "https://www.anthropic.com/research/building-effective-agents", title: "Building effective agents", fromUrl: null, ts: at(0) },
    { url: W + "Large_language_model", title: "Large language model - Wikipedia", fromUrl: "https://www.anthropic.com/research/building-effective-agents", ts: at(4) },
    { url: W + "Transformer_(deep_learning_architecture)", title: "Transformer (deep learning architecture) - Wikipedia", fromUrl: W + "Large_language_model", ts: at(9) },
    { url: W + "Attention_(machine_learning)", title: "Attention (machine learning) - Wikipedia", fromUrl: W + "Transformer_(deep_learning_architecture)", ts: at(15) },
    { url: "https://arxiv.org/abs/1706.03762", title: "Attention Is All You Need", fromUrl: W + "Attention_(machine_learning)", ts: at(19) },
    { url: W + "Retrieval-augmented_generation", title: "Retrieval-augmented generation - Wikipedia", fromUrl: W + "Large_language_model", ts: at(26) },
    { url: W + "Vector_database", title: "Vector database - Wikipedia", fromUrl: W + "Retrieval-augmented_generation", ts: at(30) },
    { url: W + "Nearest_neighbor_search", title: "Nearest neighbor search - Wikipedia", fromUrl: W + "Vector_database", ts: at(34) },
    { url: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use", title: "Tool use with Claude", fromUrl: "https://www.anthropic.com/research/building-effective-agents", ts: at(41) },
    { url: "https://json-schema.org/understanding-json-schema", title: "Understanding JSON Schema", fromUrl: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use", ts: at(46) },
    { url: "https://langchain-ai.github.io/langgraph/", title: "LangGraph", fromUrl: "https://www.anthropic.com/research/building-effective-agents", ts: at(52) },
    { url: W + "Finite-state_machine", title: "Finite-state machine - Wikipedia", fromUrl: "https://langchain-ai.github.io/langgraph/", ts: at(57) },
    { url: W + "Directed_acyclic_graph", title: "Directed acyclic graph - Wikipedia", fromUrl: W + "Finite-state_machine", ts: at(61) },
    { url: W + "Large_language_model", title: "Large language model - Wikipedia", fromUrl: W + "Directed_acyclic_graph", ts: at(66) },
  ],
};
