// Records page visits ONLY while a research session is recording on the server.
// The server is the single source of truth for which session is active, so
// starting a session from the web app or from this extension both work.

const DEFAULTS = {
  serverUrl: "http://localhost:3001",
  excluded: ["mail.google.com", "accounts.google.com", "localhost", "127.0.0.1"],
};

async function getConfig() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(["serverUrl", "excluded"])) };
}

// Cache the active session briefly so we don't ask the server on every page load.
let activeCache = { at: 0, session: null };
async function getActiveSession(force = false) {
  if (!force && Date.now() - activeCache.at < 10_000) return activeCache.session;
  const { serverUrl } = await getConfig();
  try {
    const res = await fetch(`${serverUrl}/api/sessions/active`);
    activeCache = { at: Date.now(), session: res.ok ? await res.json() : null };
  } catch {
    activeCache = { at: Date.now(), session: null };
  }
  return activeCache.session;
}

const isExcluded = (url, excluded) => {
  const host = new URL(url).hostname;
  return excluded.some((d) => d && (host === d || host.endsWith("." + d)));
};

// The last page seen in each tab is kept in session storage, because
// Manifest V3 service workers can be stopped and restarted at any time.
async function getTabState() {
  return (await chrome.storage.session.get("tabs")).tabs || {};
}
async function setTabState(tabs) {
  await chrome.storage.session.set({ tabs });
}

// A link opened in a new tab "comes from" the page in the tab that opened it.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.openerTabId) return;
  const tabs = await getTabState();
  const openerUrl = tabs[tab.openerTabId]?.lastUrl;
  if (openerUrl) {
    tabs[tab.id] = { lastUrl: null, pendingFrom: openerUrl };
    await setTabState(tabs);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !/^https?:/.test(tab.url || "")) return;

  const session = await getActiveSession();
  if (!session) return;

  const { serverUrl, excluded } = await getConfig();
  const tabs = await getTabState();
  const state = tabs[tabId] || {};

  if (isExcluded(tab.url, excluded)) {
    tabs[tabId] = { lastUrl: null }; // don't link across a private page
    return setTabState(tabs);
  }
  if (state.lastUrl === tab.url) return; // reload or same page

  const fromUrl = state.lastUrl || state.pendingFrom || null;
  tabs[tabId] = { lastUrl: tab.url };
  await setTabState(tabs);

  try {
    await fetch(`${serverUrl}/api/sessions/${session.id}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: tab.url, title: tab.title, fromUrl, ts: Date.now() }),
    });
  } catch (err) {
    console.warn("Rabbit Hole: could not record visit", err);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const tabs = await getTabState();
  delete tabs[tabId];
  await setTabState(tabs);
});

// Lets the popup force a fresh check after starting or stopping a session.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "refresh") {
    getActiveSession(true).then(sendResponse);
    return true;
  }
});
