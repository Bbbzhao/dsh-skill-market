/**
 * Minimal DOM harness for dsh-skill-market's 技能中心 tab injector.
 *
 * Runs src/client.js through its real `window.__ModuleLoader__.load()` entry
 * with stub React/ReactDOM (components are never rendered here), calls apply()
 * with a fake cordis ctx, then drives a synthetic skill-explorer page and
 * asserts the tab/pane lifecycle. Node only — no jsdom.
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");

// ── tiny DOM ──────────────────────────────────────────────────────────────

function parseSelector(sel) {
  // supports: [attr] and [attr="value"], with optional tag prefix, comma lists
  return sel.split(",").map((part) => {
    const s = part.trim();
    const attrs = [];
    const re = /\[([a-zA-Z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'))?\]/g;
    let m;
    while ((m = re.exec(s))) attrs.push([m[1], m[2] !== undefined ? m[2] : m[3]]);
    const tag = s.match(/^[a-zA-Z0-9]+/);
    return { attrs, tag: tag ? tag[0].toUpperCase() : null };
  });
}

const selectorCache = new Map();
function selector(sel) {
  if (!selectorCache.has(sel)) selectorCache.set(sel, parseSelector(sel));
  return selectorCache.get(sel);
}

function matches(el, parts) {
  return parts.some(({ attrs, tag }) => {
    if (tag && el.tagName !== tag) return false;
    return attrs.every(([name, value]) =>
      value === undefined ? el.hasAttribute(name) : el.getAttribute(name) === value);
  });
}

class Style {
  constructor() { this.display = ""; }
}

class DOMNode {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.style = new Style();
    this._text = "";
    this._listeners = [];
  }

  get firstChild() { return this.children[0] || null; }
  get isConnected() {
    let n = this;
    while (n.parentNode) n = n.parentNode;
    return n === this.ownerDocument._root;
  }
  get nextElementSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i + 1] || null;
  }
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.children.indexOf(this);
    return this.parentNode.children[i - 1] || null;
  }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent).join("");
    return this._text;
  }
  set textContent(v) {
    this.children.forEach((c) => { c.parentNode = null; });
    this.children = [];
    this._text = String(v);
  }
  get className() { return this.getAttribute("class") || ""; }
  set className(v) { this.setAttribute("class", v); }

  setAttribute(n, v) { this.attributes.set(n, String(v)); }
  getAttribute(n) { return this.attributes.has(n) ? this.attributes.get(n) : null; }
  hasAttribute(n) { return this.attributes.has(n); }
  removeAttribute(n) { this.attributes.delete(n); }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    if (ref == null) return this.appendChild(child);
    const i = this.children.indexOf(ref);
    if (i < 0) return this.appendChild(child);
    child.parentNode = this;
    this.children.splice(i, 0, child);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  cloneNode() {
    const el = new DOMNode(this.tagName, this.ownerDocument);
    for (const [k, v] of this.attributes) el.attributes.set(k, v);
    el._text = this._text;
    return el;
  }
  closest(sel) {
    const parts = selector(sel);
    let n = this;
    while (n && n !== this.ownerDocument._root) {
      if (matches(n, parts)) return n;
      n = n.parentNode;
    }
    return null;
  }
  querySelectorAll(sel) {
    const parts = selector(sel);
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (matches(c, parts)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }

  addEventListener(type, fn, capture) {
    this._listeners.push({ type, fn, capture: !!capture });
  }
  removeEventListener(type, fn, capture) {
    const i = this._listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture);
    if (i >= 0) this._listeners.splice(i, 1);
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    const path = [];
    for (let n = this; n; n = n.parentNode) path.push(n);
    for (const n of [...path].reverse()) {
      for (const l of n._listeners.filter((l) => l.type === event.type && l.capture)) l.fn.call(n, event);
    }
    for (const n of path) {
      for (const l of n._listeners.filter((l) => l.type === event.type && !l.capture)) l.fn.call(n, event);
    }
    return !event.defaultPrevented;
  }
}

class DOMDocument {
  constructor() {
    this._root = new DOMNode("html", this);
    this.body = new DOMNode("body", this);
    this.head = new DOMNode("head", this);
    this.documentElement = this._root;
    this._root.appendChild(this.head);
    this._root.appendChild(this.body);
  }
  createElement(tag) { return new DOMNode(tag, this); }
  querySelector(sel) { return this._root.querySelector(sel); }
  querySelectorAll(sel) { return this._root.querySelectorAll(sel); }
  addEventListener() {}
  removeEventListener() {}
}

const observers = [];
class MutationObserverShim {
  constructor(cb) { this.cb = cb; }
  observe() { observers.push(this); }
  disconnect() {
    const i = observers.indexOf(this);
    if (i >= 0) observers.splice(i, 1);
  }
  trigger() { this.cb([]); }
}

class EventShim {
  constructor(type, opts) {
    Object.assign(this, { type, bubbles: true, defaultPrevented: false }, opts || {});
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
}

// ── globals ───────────────────────────────────────────────────────────────

const document = new DOMDocument();
const window = {
  document,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  HTMLTextAreaElement: function () {}
};
global.window = window;
global.document = document;
global.MutationObserver = MutationObserverShim;
global.CustomEvent = EventShim;
global.Event = EventShim;

// ── load the plugin through its real loader entry ─────────────────────────

const reactStub = {
  createElement: (type, props) => ({ type, props }),
  Fragment: "Fragment",
  useState: (v) => [typeof v === "function" ? v() : v, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn()
};
const requireStub = (id) => {
  if (id === "react") return reactStub;
  if (id === "react-dom") return { createPortal: (node, container) => ({ node, container }) };
  throw new Error("unexpected require: " + id);
};

let captured = null;
window.__ModuleLoader__ = { load(def) { captured = def; } };

const source = fs.readFileSync(path.join(__dirname, "..", "src", "client.js"), "utf8");
// eslint-disable-next-line no-new-func
new Function("window", "document", "MutationObserver", "CustomEvent", "Event", source)(
  window, document, MutationObserverShim, EventShim, EventShim);

assert.ok(captured, "plugin registers through __ModuleLoader__.load");
assert.strictEqual(captured.id, "dsh-skill-market");

const pluginExports = captured.factory(requireStub);
assert.strictEqual(typeof pluginExports.apply, "function", "exports.apply present");
assert.deepStrictEqual(pluginExports.inject, ["slots", "connection"]);

// ── fake cordis context ───────────────────────────────────────────────────

const layoutCalls = [];
const registeredSlots = [];
const ctx = {
  effect(fn) { fn(); return () => {}; },
  get(name) {
    if (name === "connection") return { rpc: { call: async () => ({}) } };
    if (name === "layout") return { selectPanel: (id) => layoutCalls.push(id) };
    return undefined;
  },
  slots: {
    entries: () => [{ options: { key: "skill-explorer" } }],
    inject: (name, fn) => fn(),
    register: (options) => { registeredSlots.push(options); return () => {}; }
  }
};

pluginExports.apply(ctx);
assert.ok(registeredSlots.some((s) => s.name === "shell.overlay" && s.id === "skill-hub"),
  "overlay slot registered (portal host)");
// default entry mode is "center": the footer seat must stay free
assert.ok(!registeredSlots.some((s) => s.name === "sidebar.footer.action"),
  "no footer entry while the 技能中心 tab is the chosen surface");

// ── synthetic host skill-center page ─────────────────────────────────────

const page = document.createElement("div");
page.setAttribute("data-dsh-skill-explorer-view", "");
page.setAttribute("data-dsh-plugin", "skill-explorer");
const panel = document.createElement("div");
panel.setAttribute("data-dsh-plugin", "skill-explorer");
const header = document.createElement("div");
const tabBar = document.createElement("div");
tabBar.setAttribute("data-dsh-part", "tab-bar");
tabBar.setAttribute("role", "tablist");
const tabSkills = document.createElement("button");
tabSkills.setAttribute("data-dsh-part", "tab");
tabSkills.setAttribute("role", "tab");
tabSkills.setAttribute("data-active", "");
tabSkills.textContent = "技能";
const tabImport = document.createElement("button");
tabImport.setAttribute("data-dsh-part", "tab");
tabImport.setAttribute("role", "tab");
tabImport.textContent = "导入";
const content = document.createElement("div");
content.setAttribute("class", "panelContent");
tabBar.appendChild(tabSkills);
tabBar.appendChild(tabImport);
panel.appendChild(header);
panel.appendChild(tabBar);
panel.appendChild(content);
page.appendChild(panel);
document.body.appendChild(page);

const flush = async () => {
  observers.slice().forEach((o) => o.trigger());
  await new Promise((r) => setTimeout(r, 120));
};

(async () => {
  await flush();

  const ourTab = tabBar.querySelector("[data-dsh-skillhub-tab]");
  assert.ok(ourTab, "技能市场 tab injected into the host tab bar");
  assert.strictEqual(ourTab.textContent, "技能市场");
  assert.strictEqual(ourTab.getAttribute("role"), "tab");
  assert.strictEqual(ourTab.getAttribute("data-dsh-part"), "tab");
  assert.strictEqual(ourTab.className, tabSkills.className, "our tab reuses the host tab styling");

  const pane = page.querySelector("[data-dsh-skillhub-pane]");
  assert.ok(pane, "market pane injected into the host panel");
  assert.strictEqual(pane.previousElementSibling, content, "pane sits right after host content");
  assert.strictEqual(pane.style.display, "none", "pane hidden while a host tab is active");

  ourTab.dispatchEvent(new EventShim("click"));
  assert.strictEqual(pane.style.display, "flex", "pane visible after activating our tab");
  assert.strictEqual(content.style.display, "none", "host content hidden while our tab is active");
  assert.ok(ourTab.hasAttribute("data-active"), "our tab marked active");
  assert.ok(!tabSkills.hasAttribute("data-active"), "host active marker cleared");

  // same host tab clicked again → React does not re-render, we restore the marker
  tabSkills.dispatchEvent(new EventShim("click"));
  assert.strictEqual(pane.style.display, "none", "pane hidden after host tab click");
  assert.strictEqual(content.style.display, "", "host content restored");
  assert.ok(!ourTab.hasAttribute("data-active"), "our tab no longer active");
  assert.ok(tabSkills.hasAttribute("data-active"), "host marker restored on same-tab click");

  // activate again, then switch to a different host tab (React re-renders)
  ourTab.dispatchEvent(new EventShim("click"));
  assert.strictEqual(pane.style.display, "flex");
  tabImport.dispatchEvent(new EventShim("click"));
  assert.strictEqual(pane.style.display, "none");
  assert.strictEqual(content.style.display, "");

  // active state survives a React re-render that drops our nodes
  ourTab.dispatchEvent(new EventShim("click"));
  tabBar.removeChild(ourTab);
  pane.parentNode.removeChild(pane);
  await flush();
  const reinjectedTab = tabBar.querySelector("[data-dsh-skillhub-tab]");
  const reinjectedPane = page.querySelector("[data-dsh-skillhub-pane]");
  assert.ok(reinjectedTab, "tab re-injected after React removed it");
  assert.ok(reinjectedPane, "pane re-injected after React removed it");
  assert.ok(reinjectedTab.hasAttribute("data-active"), "re-injected tab keeps the active marker");
  assert.strictEqual(reinjectedPane.style.display, "flex", "re-injected pane stays visible");
  assert.strictEqual(content.style.display, "none", "host content stays hidden");

  document.body.removeChild(page);
  await flush();
  assert.strictEqual(document.querySelector("[data-dsh-skillhub-tab]"), null, "no tab once the panel closes");

  console.log("PASS — 技能中心 tab injection lifecycle");
  process.exit(0); // the plugin keeps a host-watch interval alive
})().catch((err) => {
  console.error("FAIL —", err && err.message);
  process.exitCode = 1;
});
