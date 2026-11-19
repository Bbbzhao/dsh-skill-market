/**
 * Real-React integration test for the 技能中心 「技能市场」 tab.
 *
 * Unlike harness.cjs (stubbed React), this runs the plugin's actual
 * SkillHubOverlay through ReactDOM.createRoot + createPortal inside jsdom, with
 * a synthetic skill-explorer page as the host, and drives real click events.
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
panel.className = "ptK59a_panel";
const tabBar = document.createElement("div");
tabBar.setAttribute("data-dsh-part", "tab-bar");
tabBar.className = "ptK59a_tabBar";
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
const tabImport = mkTab("导入", false);
tabBar.appendChild(tabSkills);
tabBar.appendChild(tabImport);
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

const rpcCalls = [];
const rpc = {
  call: async (channel, endpoint, payload) => {
    rpcCalls.push({ endpoint, payload });
    if (endpoint === "skill-hub/categories") return { ok: true, value: { categories: [{ key: "dev", name: "开发编程" }] } };
    if (endpoint === "skill-hub/search") {
      return { ok: true, value: {
        items: [
          { slug: "gh-cli", name: "GitHub", description: "用 gh CLI 与 GitHub 交互", stars: 704, downloads: 369000, author: "steipete", source: "skillhub", version: "1.0.0", installed: false },
          { slug: "cn-doc", name: "中文公文写作", description: "用于中文公文、事务性材料", stars: 58, downloads: 100000, author: "gongyu", source: "skillhub", version: "1.6.26", installed: true },
        ],
      } };
    }
    if (endpoint === "skill-hub/installed") {
      return { ok: true, value: { skills: [{ slug: "cn-doc", name: "中文公文写作", description: "已安装的技能", installed: true, source: "skillhub" }] } };
    }
    return { ok: true, value: {} };
  },
};

const registered = [];
const disposers = [];
const ctx = {
  effect(fn) { const d = fn(); if (typeof d === "function") disposers.push(d); return () => {}; },
  get(name) {
    if (name === "connection") return { rpc };
    if (name === "layout") return { selectPanel() {} };
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

// The slot passes inject() results as props; the host always mounts this
// component (it owns the portal), so render it exactly like the shell does.
const host = document.createElement("div");
document.body.appendChild(host);
let root;
act(() => { root = createRoot(host); root.render(React.createElement(overlaySlot.component, overlaySlot.inject())); });

const tick = (ms = 120) => act(async () => { await new Promise((r) => window.setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

(async () => {
  await tick();

  const ourTab = tabBar.querySelector("[data-dsh-skillhub-tab]");
  assert.ok(ourTab, "技能市场 tab injected");
  assert.strictEqual(ourTab.textContent, "技能市场");
  assert.strictEqual(ourTab.getAttribute("data-dsh-part"), "tab");
  assert.strictEqual(ourTab.className, tabSkills.className, "reuses host tab class");

  const pane = page.querySelector("[data-dsh-skillhub-pane]");
  assert.ok(pane, "pane injected after host content");
  assert.strictEqual(pane.previousElementSibling, content);
  assert.strictEqual(pane.style.display, "none", "pane hidden until the tab is clicked");
  assert.strictEqual(host.textContent, "", "nothing rendered before the tab is opened");

  await click(ourTab);
  assert.strictEqual(pane.style.display, "flex", "pane shown");
  assert.strictEqual(content.style.display, "none", "host content hidden");
  assert.ok(tabSkills.getAttribute("data-active") === null, "host active marker cleared");

  await tick(200);
  assert.ok(pane.querySelector(".dsh-sh-search-input"), "market search box rendered inside the pane");
  assert.ok(rpcCalls.some((c) => c.endpoint === "skill-hub/search"), "market issued a search call");
  const cards = pane.querySelectorAll(".dsh-sh-card");
  assert.ok(cards.length >= 2, `market cards rendered (${cards.length})`);
  assert.ok(pane.textContent.includes("GitHub"), "first card rendered");
  assert.ok(pane.textContent.includes("中文公文写作"));

  // segmented switcher (embed mode) — no second tab row
  assert.strictEqual(pane.querySelector(".dsh-sh-tabs"), null, "no nested tab row in embed mode");
  const segs = pane.querySelectorAll(".dsh-sh-seg-btn");
  assert.strictEqual(segs.length, 3, "browse / installed / about switcher");

  await click(segs[1]);
  await tick(200);
  assert.ok(rpcCalls.some((c) => c.endpoint === "skill-hub/installed"), "installed view fetched");

  await click(tabImport);
  assert.strictEqual(pane.style.display, "none", "pane hidden after host tab click");
  assert.strictEqual(content.style.display, "", "host content restored");
  assert.ok(ourTab.getAttribute("data-active") === null, "our tab no longer active");

  await click(ourTab);
  assert.strictEqual(pane.style.display, "flex", "pane shown again");
  await tick(200);
  assert.ok(pane.querySelector(".dsh-sh-card"), "state kept across tab switches");

  // React drops our nodes → observer re-injects, keeping the active tab
  act(() => {
    tabBar.removeChild(ourTab);
    pane.remove();
  });
  await tick(200);
  const tab2 = tabBar.querySelector("[data-dsh-skillhub-tab]");
  const pane2 = page.querySelector("[data-dsh-skillhub-pane]");
  assert.ok(tab2, "tab re-injected after removal");
  assert.ok(pane2, "pane re-injected after removal");
  assert.strictEqual(pane2.style.display, "flex", "re-injected pane stays visible");
  assert.ok(pane2.querySelector(".dsh-sh-card"), "portal content portalled into the new pane");
  assert.strictEqual(content.style.display, "none", "host content still hidden");

  // ── entry mode: 关于 → 侧边栏左下角 (official footer seat) ───────────────
  await click(pane2.querySelectorAll(".dsh-sh-seg-btn")[2]);
  await tick();
  assert.ok(pane2.textContent.includes("入口位置"), "about view exposes the entry setting");
  const footerOption = Array.prototype.find.call(
    pane2.querySelectorAll(".dsh-sh-entry-opt"),
    (el) => el.textContent.includes("侧边栏左下角")
  );
  assert.ok(footerOption, "footer entry option rendered");
  await click(footerOption);
  await tick(240);

  assert.strictEqual(tabBar.querySelector("[data-dsh-skillhub-tab]"), null,
    "tab removed when the footer entry is chosen");
  assert.strictEqual(page.querySelector("[data-dsh-skillhub-pane]"), null, "pane removed");
  assert.strictEqual(content.style.display, "", "host content restored on mode switch");
  assert.strictEqual(window.localStorage.getItem("dsh-skill-hub:entry-mode"), "footer", "choice persisted");
  const footerSlots = registered.filter((s) => s.name === "sidebar.footer.action");
  assert.ok(footerSlots.length >= 1, "official footer seat claimed");

  // switching away from the embedded tab hands the market to the overlay,
  // so the user never loses the page they were looking at
  assert.ok(document.querySelector(".dsh-skill-hub-overlay"), "mode switch keeps the market open in the overlay");

  // the footer button (bottom-left, beside Settings) toggles that overlay
  const footerHost = document.createElement("div");
  document.body.appendChild(footerHost);
  const footerRoot = createRoot(footerHost);
  act(() => footerRoot.render(React.createElement(footerSlots[0].component, { wide: true })));
  const footerBtn = footerHost.querySelector('[data-dsh-part="sidebar-footer-entry"]');
  assert.ok(footerBtn, "footer entry rendered");
  assert.strictEqual(footerBtn.getAttribute("aria-label"), "技能市场");
  await click(footerBtn);
  await tick(240);
  assert.strictEqual(document.querySelector(".dsh-skill-hub-overlay"), null, "footer entry closes the open overlay");
  await click(footerBtn);
  await tick(240);
  assert.ok(document.querySelector(".dsh-skill-hub-overlay"), "footer entry opens the market overlay");
  // switch back from the overlay: 关于 → 技能中心标签页
  const overlayTabs = document.querySelectorAll(".dsh-skill-hub-overlay .dsh-sh-tab");
  assert.strictEqual(overlayTabs.length, 3, "overlay keeps its own tab row");
  await click(overlayTabs[2]);
  await tick();
  const centerOption = Array.prototype.find.call(
    document.querySelectorAll(".dsh-skill-hub-overlay .dsh-sh-entry-opt"),
    (el) => el.textContent.includes("技能中心标签页")
  );
  assert.ok(centerOption, "center option rendered in the overlay");
  await click(centerOption);
  await tick(240);
  assert.ok(tabBar.querySelector("[data-dsh-skillhub-tab]"), "tab injected again after switching back");
  assert.strictEqual(window.localStorage.getItem("dsh-skill-hub:entry-mode"), "center");
  assert.strictEqual(registered.filter((s) => s.name === "sidebar.footer.action").length,
    footerSlots.length, "footer seat not registered twice");

  // close the overlay through its backdrop
  await click(document.querySelector(".dsh-skill-hub-overlay"));
  await tick();
  assert.strictEqual(document.querySelector(".dsh-skill-hub-overlay"), null, "overlay closed");
  act(() => footerRoot.unmount());

  // ── picker ⓘ detail card ───────────────────────────────────────────────
  const inputSlot = registered.find((s) => s.name === "conversation.input.left" && s.id === "skill-hub");
  assert.ok(inputSlot, "chat input entry registered");
  const inputHost = document.createElement("div");
  document.body.appendChild(inputHost);
  const inputRoot = createRoot(inputHost);
  act(() => inputRoot.render(React.createElement(inputSlot.component,
    Object.assign({ rpc: rpc, onInsertSkill() {} }, inputSlot.inject()))));
  await tick();
  const trigger = inputHost.querySelector(".dsh-sh-input-btn");
  assert.ok(trigger, "skill button in the input bar");
  await click(trigger);
  await tick(200);
  const rows = inputHost.querySelectorAll(".dsh-sh-quick-pick-item");
  assert.ok(rows.length >= 1, `picker rows (${rows.length})`);
  const infoBtn = rows[0].querySelector('[aria-label="技能详情"]');
  assert.ok(infoBtn, "info icon on the right of the row");
  act(() => infoBtn.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true })));
  await tick();
  // The card is portalled to <body> on purpose: inside the composer any
  // transformed/clipped ancestor re-anchors a position:fixed child.
  const tip = document.querySelector(".dsh-sh-tip");
  assert.ok(tip, "hovering ⓘ shows the detail card");
  assert.ok(!inputHost.contains(tip), "detail card escapes the composer box");
  assert.strictEqual(tip.style.position || window.getComputedStyle(tip).position, "fixed",
    "detail card stays viewport-anchored");
  assert.ok(tip.textContent.includes("中文公文写作"), "detail card shows the skill name");
  assert.ok(tip.textContent.includes("来源"), "detail card lists meta rows");
  act(() => infoBtn.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true })));
  await tick();
  assert.strictEqual(document.querySelector(".dsh-sh-tip"), null, "detail card hidden on mouse leave");
  act(() => inputRoot.unmount());

  // closing the panel drops the tab
  act(() => { page.remove(); });
  await tick(200);
  assert.strictEqual(document.querySelector("[data-dsh-skillhub-tab]"), null, "tab gone with the panel");

  act(() => { root.unmount(); });
  console.log("PASS — real React portal integration inside the 技能中心 tab");
  process.exit(0); // the plugin keeps a host-watch interval alive
})().catch((err) => {
  console.error("FAIL —", err && (err.stack || err.message));
  process.exit(1); // plugin intervals would otherwise keep the loop alive
});
