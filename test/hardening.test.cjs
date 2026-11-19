/**
 * Hardening tests: the market must stay reachable when the host is not what we
 * expected. These cover the two degraded paths that used to lose the entry:
 *   1. the host stops seeding "react-dom" (no portal possible) → footer entry
 *   2. the skill-center panel is selected but its page marker never shows up
 *      (the plugin renamed/removed its root) → footer entry after a grace delay
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "src", "client.js"), "utf8");

const reactStub = {
  createElement() { return {}; },
  Fragment: "Fragment",
  useState(v) { return [v, function () {}]; },
  useEffect() {},
  useMemo(fn) { return fn(); },
  useRef(v) { return { current: v }; },
};

/** Fresh jsdom + freshly loaded plugin module (module state is per load). */
function makeEnv({ requireDom, entries, layout, html }) {
  const dom = new JSDOM("<!doctype html><html><body>" + (html || "") + "</body></html>", {
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

  let captured = null;
  window.__ModuleLoader__ = { load(def) { captured = def; } };
  // eslint-disable-next-line no-new-func
  new Function("window", "document", "MutationObserver", "CustomEvent", "Event", SOURCE)(
    window, window.document, window.MutationObserver, window.CustomEvent, window.Event);

  const requireStub = (id) => {
    if (id === "react") return reactStub;
    if (id === "react-dom") {
      if (!requireDom) throw new Error("react-dom is not seeded");
      return { createPortal: (node, el) => ({ node, el }) };
    }
    throw new Error("unexpected require: " + id);
  };

  const registered = [];
  const rpc = { call: async () => ({ ok: true, value: {} }) };
  const ctx = {
    effect(fn) { fn(); return () => {}; },
    get(name) {
      if (name === "connection") return { rpc };
      if (name === "layout") return layout || { selectPanel() {} };
      return undefined;
    },
    slots: {
      entries: () => entries || [],
      inject: (name, fn) => fn(),
      register: (options, component) => { registered.push(Object.assign({ component }, options)); return () => {}; },
    },
  };
  return { window, document: window.document, plugin: captured.factory(requireStub), ctx, registered };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hasFooter = (registered) => registered.some((s) => s.name === "sidebar.footer.action");

(async () => {
  // 1. react-dom missing → footer entry immediately, no crash
  {
    const env = makeEnv({ requireDom: false, entries: [{ options: { key: "skill-explorer" } }] });
    env.plugin.apply(env.ctx);
    assert.ok(hasFooter(env.registered), "no react-dom: footer seat claimed instead of an unusable tab");
    assert.strictEqual(env.document.querySelector("[data-dsh-skillhub-tab]"), null, "no tab without a portal");
    console.log("ok — no react-dom falls back to the footer entry");
  }

  // 2. skill-center page marker gone, but its panel is the selected one → the
  //    tab can never mount, so the footer entry takes over after ~2s of grace.
  {
    const env = makeEnv({
      requireDom: true,
      entries: [{ options: { key: "skill-explorer" } }],
      layout: { selectPanel() {}, panelInfo: { getSnapshot: () => ({ activePanelId: "skill-explorer" }) } },
    });
    env.plugin.apply(env.ctx);
    assert.ok(!hasFooter(env.registered), "no fallback while the host may still be mounting");
    await wait(5200);
    assert.ok(hasFooter(env.registered), "renamed page root: footer entry appears, market stays reachable");
    console.log("ok — renamed skill-center page root falls back to the footer entry");
  }

  console.log("PASS — hardening fallbacks");
  process.exit(0); // the plugin keeps a host-watch interval alive
})().catch((err) => {
  console.error("FAIL —", err && (err.stack || err.message));
  process.exit(1);
});
