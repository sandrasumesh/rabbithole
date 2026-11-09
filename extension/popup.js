const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  serverUrl: "http://localhost:3001",
  excluded: ["mail.google.com", "accounts.google.com", "localhost", "127.0.0.1"],
};

async function config() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(["serverUrl", "excluded"])) };
}

async function render() {
  const { serverUrl, excluded } = await config();
  $("serverUrl").value = serverUrl;
  $("excluded").value = excluded.join("\n");

  try {
    const res = await fetch(`${serverUrl}/api/sessions/active`);
    const session = await res.json();
    $("status").className = session ? "status on" : "status";
    $("status").textContent = session
      ? `● Recording "${session.name}" (${session.visitCount} visits)`
      : "Not recording. Nothing is being tracked.";
    $("start-box").classList.toggle("hidden", Boolean(session));
    $("stop").classList.toggle("hidden", !session);
    $("stop").dataset.id = session?.id || "";
  } catch {
    $("status").textContent = "Can't reach the server. Is it running?";
  }
}

$("start").onclick = async () => {
  const { serverUrl } = await config();
  await fetch(`${serverUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: $("name").value || "My research" }),
  });
  await chrome.runtime.sendMessage({ type: "refresh" });
  render();
};

$("stop").onclick = async () => {
  const { serverUrl } = await config();
  await fetch(`${serverUrl}/api/sessions/${$("stop").dataset.id}/stop`, { method: "POST" });
  await chrome.runtime.sendMessage({ type: "refresh" });
  render();
};

$("save").onclick = async () => {
  await chrome.storage.local.set({
    serverUrl: $("serverUrl").value.trim().replace(/\/$/, ""),
    excluded: $("excluded").value.split("\n").map((s) => s.trim()).filter(Boolean),
  });
  render();
};

render();
