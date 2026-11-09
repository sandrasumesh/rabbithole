import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import Graph from "./Graph.jsx";
import { topicLookup } from "./topics.js";

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [session, setSession] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const refreshList = useCallback(async () => {
    const list = await api.listSessions();
    setSessions(list);
    return list;
  }, []);

  useEffect(() => {
    api.health().then((h) => setAiEnabled(h.ai)).catch(() => setError("Can't reach the API. Is the server running?"));
    refreshList().then((list) => list[0] && setCurrentId(list[0].id)).catch(() => {});
  }, [refreshList]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    try {
      setSession(await api.getSession(id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    setSelectedId(null);
    loadSession(currentId);
  }, [currentId, loadSession]);

  // While a session is recording, poll so new pages appear live.
  useEffect(() => {
    if (!session?.active) return;
    const timer = setInterval(() => {
      loadSession(session.id);
      refreshList();
    }, 3000);
    return () => clearInterval(timer);
  }, [session?.active, session?.id, loadSession, refreshList]);

  const topics = useMemo(() => topicLookup(session?.analysis), [session?.analysis]);
  const nodesById = useMemo(
    () => Object.fromEntries((session?.graph?.nodes || []).map((n) => [n.id, n])),
    [session?.graph]
  );
  const selected = selectedId ? nodesById[selectedId] : null;

  const analyze = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const analysis = await api.analyze(session.id);
      setSession((s) => ({ ...s, analysis }));
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const startSession = async () => {
    const name = window.prompt("Name this research session", "My research");
    if (name === null) return;
    const s = await api.createSession(name);
    await refreshList();
    setCurrentId(s.id);
  };

  const stopSession = async () => {
    await api.stopSession(session.id);
    await refreshList();
    loadSession(session.id);
  };

  const deleteSession = async () => {
    if (!window.confirm(`Delete "${session.name}" and its history?`)) return;
    await api.deleteSession(session.id);
    const list = await refreshList();
    setSession(null);
    setCurrentId(list[0]?.id || null);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>🐇 Rabbit Hole</h1>
        <p className="muted small">See how your research wandered.</p>
        <button className="primary" onClick={startSession}>+ New session</button>
        <ul className="sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <button className={s.id === currentId ? "session active" : "session"} onClick={() => setCurrentId(s.id)}>
                <span className="session-name">{s.name}</span>
                <span className="muted small">
                  {s.visitCount} visits {s.active && <span className="rec">● recording</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small hint">
          Pages are recorded by the browser extension while a session is recording.
        </p>
      </aside>

      <main className="main">
        {error && <div className="error">{error}</div>}
        {!session ? (
          <div className="empty">Create or select a session to begin.</div>
        ) : (
          <>
            <header className="toolbar">
              <div>
                <h2>{session.name}</h2>
                <span className="muted small">
                  {session.graph.nodes.length} pages · {session.graph.edges.length} links
                </span>
              </div>
              <div className="actions">
                {session.active && <button onClick={stopSession}>Stop recording</button>}
                <button className="danger" onClick={deleteSession}>Delete</button>
              </div>
            </header>
            {session.graph.nodes.length ? (
              <Graph graph={session.graph} topics={topics} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <div className="empty">No pages yet. Browse with the extension recording and they'll appear here.</div>
            )}
          </>
        )}
      </main>

      {session && (
        <aside className="panel">
          {selected ? (
            <section>
              <button className="link small" onClick={() => setSelectedId(null)}>← Back to recap</button>
              <h3>{selected.title}</h3>
              <a href={selected.url} target="_blank" rel="noreferrer" className="small url">{selected.url}</a>
              {topics[selected.id] && (
                <p><span className="dot" style={{ background: topics[selected.id].color }} /> {topics[selected.id].name}</p>
              )}
              {session.analysis?.summaries?.[selected.id] && <p>{session.analysis.summaries[selected.id]}</p>}
              <p className="muted small">
                Visited {selected.visits}× · {selected.depth} clicks from the start
              </p>
              <Neighbors title="Came from" ids={session.graph.edges.filter((e) => e.target === selected.id).map((e) => e.source)} nodes={nodesById} onSelect={setSelectedId} />
              <Neighbors title="Led to" ids={session.graph.edges.filter((e) => e.source === selected.id).map((e) => e.target)} nodes={nodesById} onSelect={setSelectedId} />
            </section>
          ) : (
            <section>
              <h3>Recap my rabbit hole</h3>
              <p className="muted small">
                {aiEnabled ? "An AI agent reads your path, groups pages into topics and suggests what to explore next." : "Offline mode: add an ANTHROPIC_API_KEY on the server for AI analysis."}
              </p>
              <button className="primary" onClick={analyze} disabled={analyzing || !session.graph.nodes.length}>
                {analyzing ? "Analyzing…" : session.analysis ? "Re-analyze" : "Analyze session"}
              </button>
              {session.analysis && (
                <>
                  {session.analysis.warning && <p className="error small">{session.analysis.warning}</p>}
                  <p className="recap">{session.analysis.recap}</p>
                  <h4>Topics</h4>
                  <ul className="legend">
                    {session.analysis.topics.map((t) => (
                      <li key={t.name}>
                        <span className="dot" style={{ background: topics[t.nodeIds[0]]?.color }} /> {t.name}
                        <span className="muted small"> ({t.nodeIds.length})</span>
                      </li>
                    ))}
                  </ul>
                  {session.analysis.gaps?.length > 0 && (
                    <>
                      <h4>Explore next</h4>
                      <ul className="gaps">
                        {session.analysis.gaps.map((g) => (
                          <li key={g.title}><strong>{g.title}</strong><br /><span className="small">{g.why}</span></li>
                        ))}
                      </ul>
                    </>
                  )}
                  <p className="muted small">Click any page in the graph for details.</p>
                </>
              )}
            </section>
          )}
        </aside>
      )}
    </div>
  );
}

function Neighbors({ title, ids, nodes, onSelect }) {
  if (!ids.length) return null;
  return (
    <>
      <h4>{title}</h4>
      <ul className="neighbors">
        {ids.map((id) => (
          <li key={id}><button className="link" onClick={() => onSelect(id)}>{nodes[id]?.title}</button></li>
        ))}
      </ul>
    </>
  );
}
