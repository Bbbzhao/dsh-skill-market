/**
 * Startup test: a machine that already chose 「侧边栏左下角」 must boot straight
 * into the footer entry — no tab injected into 技能中心, and the tab comes back
 * as soon as the setting is switched to 「技能中心标签页」.
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.MutationObserver = window.MutationObserver;
global.CustomEvent = window.CustomEvent;
global.Event = window.Event;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.IS_REACT_ACT_ENVIRONMENT = true;

// The user picked the footer entry in an earlier session.
window.localStorage.setItem("dsh-skill-hub:entry-mode", "footer");

const React = require("react");
const ReactDOM = require("react-dom");
const { createRoot } = require("react-dom/client");
const { act } = require("react");

const requireStub = (id) => {
  if (id === "react") return React;
  if (id === "react-dom") return ReactDOM;
  throw new Error("unexpected require: " + id);
};

// ── host skill-center page ────────────────────────────────────────────────
const page = document.createElement("div");
page.setAttribute("data-dsh-skill-explorer-view", "");
page.setAttribute("data-dsh-plugin", "skill-explorer");
const panel = document.createElement("div");
const tabBar = document.createElement("div");
tabBar.setAttribute("data-dsh-part", "tab-bar");
const mkTab = (label, active) => {
  const b = document.createElement("button");
  b.setAttribute("role", "tab");
  b.setAttribute("data-dsh-part", "tab");
  b.className = "ptK59a_tab";
  if (active) b.setAttribute("data-active", "");
  b.textContent = label;
  return b;
};
const tabSkills = mkTab("技能", true);
tabBar.appendChild(tabSkills);
const content = document.createElement("div");
content.className = "ptK59a_panelContent";
content.textContent = "HOST-SKILLS-CONTENT";
panel.appendChild(tabBar);
panel.appendChild(content);
page.appendChild(panel);
document.body.appendChild(page);

// ── plugin load ───────────────────────────────────────────────────────────
let captured = null;
window.__ModuleLoader__ = { load(def) { captured = def; } };
const source = fs.readFileSync(path.join(__dirname, "..", "src", "client.js"), "utf8");
// eslint-disable-next-line no-new-func
new Function("window", "document", "MutationObserver", "CustomEvent", "Event", source)(
  window, window.document, window.MutationObserver, window.CustomEvent, window.Event);
const plugin = captured.factory(requireStub);

const rpc = {
  call: async (channel, endpoint) => {
    if (endpoint === "skill-hub/search") {
      return { ok: true, value: { items: [{ slug: "gh-cli", name: "GitHub", description: "用 gh CLI 与 GitHub 交互", source: "skillhub" }] } };
    }
    return { ok: true, value: {} };
  },
};

const registered = [];
const ctx = {
  effect(fn) { fn(); return () => {}; },
  get(name) {
    if (name === "connection") return { rpc };
    return undefined;
  },
  slots: {
    entries: () => [{ options: { key: "skill-explorer" } }],
    inject: (name, fn) => fn(),
    register: (options, component) => { registered.push(Object.assign({ component }, options)); return () => {}; },
  },
};

plugin.apply(ctx);

const overlaySlot = registered.find((s) => s.name === "shell.overlay" && s.id === "skill-hub");
assert.ok(overlaySlot, "overlay slot registered");

const host = document.createElement("div");
document.body.appendChild(host);
let root;
act(() => { root = createRoot(host); root.render(React.createElement(overlaySlot.component, overlaySlot.inject())); });

const tick = (ms = 150) => act(async () => { await new Promise((r) => window.setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

(async () => {
  await tick(200);

  assert.strictEqual(tabBar.querySelector("[data-dsh-skillhub-tab]"), null,
    "footer mode at startup: no tab injected into 技能中心");
  assert.strictEqual(page.querySelector("[data-dsh-skillhub-pane]"), null, "no pane injected either");
  const footerSlots = registered.filter((s) => s.name === "sidebar.footer.action");
  assert.strictEqual(footerSlots.length, 1, "footer seat claimed exactly once");

  // The footer button opens the market; its 关于 view can move the entry back.
  const footerHost = document.createElement("div");
  document.body.appendChild(footerHost);
  const footerRoot = createRoot(footerHost);
  act(() => footerRoot.render(React.createElement(footerSlots[0].component, { wide: false })));
  const footerBtn = footerHost.querySelector('[data-dsh-part="sidebar-footer-entry"]');
  assert.ok(footerBtn.className.includes("dsh-sh-footer-entry-rail"),
    "collapsed sidebar keeps the rail variant");
  await click(footerBtn);
  await tick(240);
  assert.ok(document.querySelector(".dsh-skill-hub-overlay"), "footer entry opens the market");

  const aboutTab = Array.prototype.find.call(
    document.querySelectorAll(".dsh-skill-hub-overlay .dsh-sh-tab"),
    (el) => el.textContent === "关于"
  );
  await click(aboutTab);
  await tick();
  const centerOption = Array.prototype.find.call(
    document.querySelectorAll(".dsh-skill-hub-overlay .dsh-sh-entry-opt"),
    (el) => el.textContent.includes("技能中心标签页")
  );
  assert.ok(centerOption, "entry options rendered");
  await click(centerOption);
  await tick(240);

  assert.strictEqual(window.localStorage.getItem("dsh-skill-hub:entry-mode"), "center", "choice persisted");
  const tab = tabBar.querySelector("[data-dsh-skillhub-tab]");
  assert.ok(tab, "switching to the tab entry injects it immediately");
  await click(tab);
  await tick(240);
  assert.strictEqual(page.querySelector("[data-dsh-skillhub-pane]").style.display, "flex",
    "injected tab opens the market pane");
  assert.strictEqual(content.style.display, "none", "host content hidden while our tab is active");

  act(() => { footerRoot.unmount(); });
  act(() => { root.unmount(); });
  console.log("PASS — footer entry at startup + switching back to the 技能中心 tab");
  process.exit(0); // the plugin keeps a host-watch interval alive
})().catch((err) => {
  console.error("FAIL —", err && (err.stack || err.message));
  process.exit(1);
});
