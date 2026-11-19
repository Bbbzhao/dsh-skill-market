/**
 * dsh-skill-market — Browser half (client plugin)
 *
 * UI entry points (二选一, chosen in the market panel's 关于 tab and persisted
 * in localStorage under "dsh-skill-hub:entry-mode"):
 * 1. "center" (default) — 「技能中心」 → 技能市场 tab: the market lives INSIDE the
 *    host's skill center panel (@linxin666/dsh-client-ui-skill-explorer) as one
 *    more tab next to 技能/导入/创建. The tab button and its pane are DOM-injected
 *    into the host page (that plugin exposes no tab-extension API); React content
 *    is rendered through a portal from the always-mounted overlay component, so no
 *    second React root is created and the host's own state is untouched.
 * 2. "footer" — the official `sidebar.footer.action` seat at the sidebar foot
 *    (bottom-left, beside Settings), which opens the market as an overlay.
 * 3. shell.overlay — the overlay market panel, plus the render host for the
 *    injected tab pane.
 * 4. conversation.input.left — "技能" button in the chat input bar (quick picker).
 *
 * Fallback ladder (so the market is never unreachable): no skill center plugin →
 * footer entry; skill center registered but its page markup changed (no tab bar /
 * no page root) → footer entry; react-dom unavailable (no portal) → footer entry.
 * When neither react-dom nor the footer seat exists, a DOM-injected sidebar row
 * is used as the last resort.
 *
 * Uses vanilla JS + React.createElement (no build step), same pattern as 1e0zj/dsh-plugin-mall.
 * React instance obtained via require("react") from the shell's module loader.
 *
 * RPC calls go through ctx.get("connection").rpc.call('/api', 'skill-hub/<endpoint>', payload, signal)
 */

window.__ModuleLoader__.load({
  id: "dsh-skill-market",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var React = require("react");
    // Optional: only needed to portal the embedded market into the host skill
    // center. A host that stops seeding react-dom must not break the plugin.
    var ReactDOM = null;
    try { ReactDOM = require("react-dom"); } catch (e) { ReactDOM = null; }
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useRef = React.useRef;
    var useCallback = React.useCallback;
    var useMemo = React.useMemo;

    // ── CSS (injected once) ──────────────────────────────────────────

    var CSS = `
.dsh-skill-hub-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
  animation: dsh-sh-fade-in 0.15s ease-out;
}
.dsh-skill-hub-panel {
  width: 880px; max-width: 95vw; height: 560px; max-height: 88vh;
  background: var(--dsh-bg-elevated, #1a1a2e); color: var(--dsh-fg, #e0e0e0);
  border: 1px solid var(--dsh-border, rgba(255,255,255,0.1));
  border-radius: 12px; display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5); overflow: hidden;
  font-family: var(--dsh-sh-font), var(--dsh-font, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 13px; line-height: 1.5;
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
}
.dsh-skill-hub-panel { --dsh-sh-font: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", "Source Han Sans SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.dsh-skill-hub-panel.light {
  background: #fff; color: #1a1a1a; border-color: rgba(0,0,0,0.12);
}
/* light theme: fix all text color issues */
.dsh-skill-hub-panel.light .dsh-sh-card-desc { color: #666; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-card-meta { color: #999; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-card { border-color: rgba(0,0,0,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-card:hover { background: rgba(99,102,241,0.04); }
.dsh-skill-hub-panel.light .dsh-sh-tab { color: #666; }
.dsh-skill-hub-panel.light .dsh-sh-tab.active { color: #333; }
.dsh-skill-hub-panel.light .dsh-sh-close { color: #666; }
.dsh-skill-hub-panel.light .dsh-sh-empty { color: #999; }
.dsh-skill-hub-panel.light .dsh-sh-loading { color: #999; }
.dsh-skill-hub-panel.light .dsh-sh-search-input {
  color: #333; background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12);
}
.dsh-skill-hub-panel.light .dsh-sh-search-input:focus { border-color: #6366f1; }
.dsh-skill-hub-panel.light .dsh-sh-readme { color: #333; }
.dsh-skill-hub-panel.light .dsh-sh-readme code { background: rgba(0,0,0,0.06); }
.dsh-skill-hub-panel.light .dsh-sh-readme pre { background: rgba(0,0,0,0.04); }
.dsh-skill-hub-panel.light .dsh-sh-readme blockquote { border-left-color: rgba(0,0,0,0.2); }
.dsh-skill-hub-panel.light .dsh-sh-detail-meta { color: #888; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-detail-section-title { color: #888; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-cat-item { color: #555; }
.dsh-skill-hub-panel.light .dsh-sh-cat-item:hover { background: rgba(0,0,0,0.04); }
.dsh-skill-hub-panel.light .dsh-sh-cat-item.active { background: rgba(99,102,241,0.1); color: #6366f1; }
.dsh-skill-hub-panel.light .dsh-sh-cat-sidebar { border-right-color: rgba(0,0,0,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-pkg-info { color: #aaa; opacity: 1; }
/* Light theme overrides for input bar elements (outside the panel) */
:root[data-theme="light"] .dsh-sh-input-btn,
:root.light .dsh-sh-input-btn { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: #333; }
:root[data-theme="light"] .dsh-sh-input-btn:hover,
:root.light .dsh-sh-input-btn:hover { background: rgba(0,0,0,0.08); }
:root[data-theme="light"] .dsh-sh-quick-pick,
:root.light .dsh-sh-quick-pick { background: #fff; border-color: rgba(0,0,0,0.12); box-shadow: 0 12px 32px rgba(0,0,0,0.15); }
:root[data-theme="light"] .dsh-sh-quick-pick-item:hover,
:root.light .dsh-sh-quick-pick-item:hover { background: rgba(0,0,0,0.04); }
:root[data-theme="light"] .dsh-sh-quick-pick-name,
:root.light .dsh-sh-quick-pick-name { color: #333; }
:root[data-theme="light"] .dsh-sh-quick-pick-desc,
:root.light .dsh-sh-quick-pick-desc { color: #888; }
.dsh-skill-hub-panel.light .dsh-sh-btn { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: #333; }
.dsh-skill-hub-panel.light .dsh-sh-btn:hover { background: rgba(0,0,0,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-btn.primary { background: #6366f1; color: #fff; border-color: transparent; }
.dsh-skill-hub-panel.light .dsh-sh-btn.primary:hover { opacity: 0.9; }
.dsh-skill-hub-panel.light .dsh-sh-btn.danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
.dsh-skill-hub-panel.light .dsh-sh-btn.danger:hover { background: rgba(239,68,68,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-header { border-bottom-color: rgba(0,0,0,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-tabs { border-bottom-color: rgba(0,0,0,0.06); }
.dsh-skill-hub-panel.light .dsh-sh-quick-pick { background: #fff; border-color: rgba(0,0,0,0.12); }
.dsh-skill-hub-panel.light .dsh-sh-quick-pick-item:hover { background: rgba(0,0,0,0.04); }
.dsh-skill-hub-panel.light .dsh-sh-quick-pick-desc { color: #888; }
.dsh-skill-hub-panel.light .dsh-sh-input-btn { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: #333; }
.dsh-skill-hub-panel.light .dsh-sh-input-btn:hover { background: rgba(0,0,0,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-sidebar-btn { color: #555; }
.dsh-skill-hub-panel.light .dsh-sh-sidebar-btn:hover { background: rgba(0,0,0,0.04); }
.dsh-skill-hub-panel.light .dsh-sh-spinner { border-color: rgba(0,0,0,0.1); border-top-color: #6366f1; }
.dsh-skill-hub-panel.light .dsh-sh-toast { background: #fff; border-color: rgba(0,0,0,0.12); color: #333; }
    .dsh-sh-header {
      display: flex; align-items: center; gap: 12px; padding: 10px 16px;
      border-bottom: 1px solid var(--dsh-border, rgba(255,255,255,0.08)); flex-shrink: 0;
    }
.dsh-sh-title { font-size: 16px; font-weight: 600; white-space: nowrap; }
.dsh-sh-search-wrap { flex: 1 1 0; min-width: 0; position: relative; }
.dsh-sh-search-input {
  box-sizing: border-box;
  width: 100%; padding: 8px 12px 8px 34px;
  background: var(--dsh-bg-input, rgba(0,0,0,0.2));
  border: 1px solid var(--dsh-border, rgba(255,255,255,0.1));
  border-radius: 8px; color: inherit; font-size: 13px; outline: none;
  transition: border-color 0.15s;
}
.dsh-sh-search-input:focus { border-color: var(--dsh-accent, #6366f1); }
.dsh-sh-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 14px; }
.dsh-sh-close {
  flex: none;
  background: none; border: none; color: inherit; cursor: pointer;
  font-size: 20px; padding: 4px 8px; opacity: 0.6; border-radius: 4px;
}
.dsh-sh-close:hover { opacity: 1; background: rgba(255,255,255,0.08); }
    .dsh-sh-tabs { display: flex; gap: 6px; padding: 6px 18px 0; flex-shrink: 0; border-bottom: 1px solid var(--dsh-border, rgba(255,255,255,0.06)); }
    .dsh-sh-tab {
      padding: 9px 18px; cursor: pointer; font-size: 14px; font-weight: 500; opacity: 0.82;
      letter-spacing: 0.6px;
      border-bottom: 2px solid transparent; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; color: inherit;
    }
.dsh-sh-tab.active { opacity: 1; border-bottom-color: var(--dsh-accent, #6366f1); font-weight: 600; color: var(--dsh-fg, #e0e0e0); }
.dsh-sh-tab:hover { opacity: 1; }
.dsh-sh-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
.dsh-sh-body::-webkit-scrollbar { width: 6px; }
.dsh-sh-body::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 3px; }
.dsh-sh-list { padding: 8px 12px; }

/* Category sidebar */
.dsh-sh-main { flex: 1; display: flex; overflow: hidden; }
    .dsh-sh-cat-sidebar {
      width: 152px; flex-shrink: 0; padding: 10px 0; overflow-y: auto;
      border-right: 1px solid var(--dsh-border, rgba(255,255,255,0.06));
    }
.dsh-sh-cat-sidebar::-webkit-scrollbar { width: 4px; }
.dsh-sh-cat-sidebar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.3); border-radius: 2px; }
    .dsh-sh-cat-item {
      padding: 8px 14px; cursor: pointer; font-size: 13px; font-weight: 500; opacity: 0.82;
      letter-spacing: 0.3px;
      transition: all 0.12s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin: 1px 6px; border-radius: 6px;
    }
.dsh-sh-cat-item:hover { opacity: 1; background: rgba(255,255,255,0.05); }
.dsh-sh-cat-item.active { opacity: 1; background: rgba(99,102,241,0.18); color: #818cf8; font-weight: 600; }
.dsh-sh-cat-header { font-size: 10px; font-weight: 600; opacity: 0.4; padding: 8px 12px 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.dsh-sh-content { flex: 1; overflow-y: auto; }

    /* Grid layout */
    .dsh-sh-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 8px 12px; }
    .dsh-sh-grid .dsh-sh-card { width: auto; min-width: 0; margin-bottom: 0; }
.dsh-sh-card {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px;
  border-radius: 10px; cursor: pointer; margin-bottom: 0;
  border: 1px solid transparent;
  transition: background 0.14s ease, border-color 0.14s ease, transform 0.14s ease;
}
.dsh-sh-card:hover {
  background: var(--dsh-bg-hover, rgba(255,255,255,0.05));
  border-color: var(--dsh-border, rgba(255,255,255,0.12));
  transform: translateY(-1px);
}
    /* 头像：优先用官方 iconUrl，没有就按 slug 生成稳定的彩色字母块 */
    .dsh-sh-avatar {
      flex: none; width: 36px; height: 36px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 600; color: #fff; overflow: hidden;
      letter-spacing: 0;
    }
    .dsh-sh-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dsh-sh-card-body { flex: 1; min-width: 0; }
    .dsh-sh-card-head { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
    .dsh-sh-card-title {
      font-weight: 600; font-size: 13px; letter-spacing: 0.2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
    }
    .dsh-sh-verified {
      flex: none; width: 14px; height: 14px; border-radius: 50%;
      background: #6366f1; color: #fff; font-size: 9px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center;
      line-height: 1;
    }
    .dsh-sh-card-desc {
      font-size: 12px; line-height: 1.55; opacity: 0.7;
      overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
      -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    /* 统计行：star / 下载 / 版本 / 作者，等宽数字对齐 */
    .dsh-sh-card-stats {
      display: flex; gap: 10px; font-size: 11px; margin-top: 6px;
      flex-wrap: wrap; align-items: center;
      font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
    }
    .dsh-sh-stat { display: inline-flex; align-items: center; gap: 3px; opacity: 0.75; white-space: nowrap; }
    .dsh-sh-stat.muted { opacity: 0.5; }
    .dsh-sh-stat.ellipsis { max-width: 120px; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
    .dsh-sh-stat-ico { opacity: 0.9; }
    .dsh-sh-stat-ico.star { color: #f5a623; }
.dsh-sh-card-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 500; }
.dsh-sh-card-badge.installed { background: rgba(99,102,241,0.2); color: #818cf8; }
.dsh-sh-card-badge.source { background: rgba(100,200,100,0.15); opacity: 0.8; }
.dsh-sh-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .dsh-sh-btn {
      padding: 4px 10px; font-size: 11px; border-radius: 6px; cursor: pointer;
      border: 1px solid var(--dsh-border, rgba(255,255,255,0.15)); background: var(--dsh-bg-btn, rgba(255,255,255,0.06));
      color: inherit; transition: all 0.12s; white-space: nowrap;
    }
.dsh-sh-btn:hover { background: var(--dsh-bg-btn-hover, rgba(255,255,255,0.12)); }
.dsh-sh-btn.primary { background: var(--dsh-accent, #6366f1); border-color: transparent; color: #fff; }
.dsh-sh-btn.primary:hover { opacity: 0.9; }
.dsh-sh-btn.danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
.dsh-sh-btn.danger:hover { background: rgba(239,68,68,0.1); }
.dsh-sh-btn.loading { opacity: 0.5; pointer-events: none; }
    .dsh-sh-detail { padding: 16px 20px; max-width: 700px; margin: 0 auto; }
.dsh-sh-detail-header { margin-bottom: 16px; }
.dsh-sh-detail-title { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
.dsh-sh-detail-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; opacity: 0.6; }
.dsh-sh-detail-section { margin-top: 20px; }
.dsh-sh-detail-section-title { font-size: 13px; font-weight: 600; opacity: 0.7; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .dsh-sh-readme { font-size: 12px; line-height: 1.6; overflow-x: hidden; word-wrap: break-word; }
.dsh-sh-readme h1 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
.dsh-sh-readme h2 { font-size: 16px; font-weight: 600; margin: 14px 0 6px; }
.dsh-sh-readme h3 { font-size: 14px; font-weight: 600; margin: 12px 0 4px; }
.dsh-sh-readme p { margin: 8px 0; }
.dsh-sh-readme code { font-family: var(--dsh-font-mono, "SF Mono", Monaco, monospace); font-size: 12px; background: rgba(128,128,128,0.15); padding: 2px 5px; border-radius: 3px; }
.dsh-sh-readme pre { background: rgba(128,128,128,0.1); border-radius: 6px; padding: 12px; overflow-x: auto; margin: 10px 0; }
.dsh-sh-readme pre code { background: none; padding: 0; }
.dsh-sh-readme ul, .dsh-sh-readme ol { padding-left: 20px; margin: 8px 0; }
.dsh-sh-readme a { color: var(--dsh-accent, #818cf8); text-decoration: none; }
.dsh-sh-readme a:hover { text-decoration: underline; }
.dsh-sh-readme blockquote { border-left: 3px solid var(--dsh-border, rgba(128,128,128,0.3)); padding-left: 12px; opacity: 0.7; margin: 8px 0; }
.dsh-sh-readme table { border-collapse: collapse; margin: 10px 0; font-size: 12px; }
.dsh-sh-readme th, .dsh-sh-readme td { border: 1px solid var(--dsh-border, rgba(128,128,128,0.2)); padding: 6px 10px; }
.dsh-sh-readme img { max-width: 100%; border-radius: 6px; }
.dsh-sh-readme hr { border: none; border-top: 1px solid var(--dsh-border, rgba(128,128,128,0.2)); margin: 16px 0; }
    .dsh-sh-empty { text-align: center; padding: 32px 16px; opacity: 0.5; font-size: 13px; }
    .dsh-sh-loading { text-align: center; padding: 28px 16px; opacity: 0.5; font-size: 13px; }
.dsh-sh-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(128,128,128,0.2); border-top-color: var(--dsh-accent, #6366f1); border-radius: 50%; animation: dsh-sh-spin 0.6s linear infinite; }
@keyframes dsh-sh-spin { to { transform: rotate(360deg); } }
@keyframes dsh-sh-fade-in { from { opacity: 0; } to { opacity: 1; } }
.dsh-sh-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 10px 20px; border-radius: 8px; font-size: 13px; z-index: 10000;
  background: var(--dsh-bg-elevated, #1a1a2e); border: 1px solid var(--dsh-border, rgba(255,255,255,0.1));
  box-shadow: 0 8px 24px rgba(0,0,0,0.3); animation: dsh-sh-fade-in 0.2s ease-out;
}
.dsh-sh-toast.success { border-color: rgba(99,102,241,0.5); }
.dsh-sh-toast.error { border-color: rgba(239,68,68,0.5); }
.dsh-sh-input-btn {
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
  padding: 4px 8px; border-radius: 6px; border: 1px solid var(--dsh-border, rgba(128,128,128,0.2));
  background: var(--dsh-bg-btn, rgba(128,128,128,0.08)); color: var(--dsh-fg, inherit);
  font-size: 12px; transition: all 0.12s; white-space: nowrap;
}
.dsh-sh-input-btn:hover { background: var(--dsh-bg-btn-hover, rgba(255,255,255,0.12)); }
    /* Sidebar nav entry row (task-board style, plain DOM) */
    .dsh-sh-nav-entry {
      box-sizing: border-box;
      display: flex; align-items: center; gap: 8px;
      width: 100%; height: 36px; padding: 0 10px;
      background: transparent; border: none; border-radius: 8px;
      color: var(--dsw-alias-label-secondary);
      cursor: pointer; font-size: 13px; white-space: nowrap;
      font-family: inherit;
    }
    .dsh-sh-nav-entry:hover {
      background: var(--dsw-alias-interactive-bg-hover);
      color: var(--dsw-alias-label-primary);
    }
    .dsh-sh-nav-entry[data-active] {
      background: var(--dsw-alias-interactive-bg-active);
      color: var(--dsw-alias-label-primary);
      font-weight: 600;
    }
    .dsh-sh-nav-entry-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; flex: none;
    }
    .dsh-sh-nav-entry-icon svg { display: block; width: 18px; height: 18px; }
    .dsh-sh-nav-entry-label { overflow: hidden; text-overflow: ellipsis; }
    /* Collapsed rail: icon-only, centered, matching the shell's 56px rail */
    [data-dsh-frame][data-sidebar-collapsed] .dsh-sh-nav-entry,
    [data-sidebar-collapsed] .dsh-sh-nav-entry {
      justify-content: center; padding: 0;
      width: 36px; height: 36px; margin: 0 auto 12px;
      border-radius: 50%;
    }
    [data-dsh-frame][data-sidebar-collapsed] .dsh-sh-nav-entry-label,
    [data-sidebar-collapsed] .dsh-sh-nav-entry-label { display: none; }
.dsh-sh-quick-pick {
  position: absolute; bottom: 100%; left: 0; margin-bottom: 4px;
  width: 280px; max-height: 320px; overflow-y: auto;
  background: #ffffff; border: 1px solid rgba(0,0,0,0.12);
  border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,0.2); z-index: 100;
  color: #1a1a2e;
}
.dsh-sh-quick-pick.down { bottom: auto; top: 100%; margin-bottom: 0; margin-top: 4px; }
    .dsh-sh-quick-pick-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px 8px 12px; cursor: pointer; border-radius: 4px; margin: 1px;
    }
    .dsh-sh-quick-pick-item:hover { background: rgba(99,102,241,0.08); }
    .dsh-sh-quick-pick-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .dsh-sh-quick-pick-name {
      font-weight: 500; font-size: 13px; line-height: 1.3;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .dsh-sh-quick-pick-badge {
      font-size: 10px; margin-left: 6px; padding: 0 5px; border-radius: 999px;
      color: #818cf8; border: 1px solid rgba(129,140,248,0.45); vertical-align: 1px;
    }
    .dsh-sh-quick-pick-desc {
      font-size: 11px; line-height: 1.35; color: #888;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    /* info affordance — hover/focus reveals the detail card below */
    .dsh-sh-quick-pick-info {
      flex: none; width: 20px; height: 20px; display: inline-flex;
      align-items: center; justify-content: center; padding: 0;
      border: 0; border-radius: 50%; background: transparent;
      color: #8b8b95; cursor: help; opacity: 0.55; transition: opacity 0.12s;
    }
    .dsh-sh-quick-pick-item:hover .dsh-sh-quick-pick-info { opacity: 0.85; }
    .dsh-sh-quick-pick-info:hover, .dsh-sh-quick-pick-info:focus-visible {
      opacity: 1; background: rgba(99,102,241,0.14); color: #6366f1; outline: none;
    }
    .dsh-sh-quick-pick-info svg { display: block; width: 14px; height: 14px; }
.dsh-sh-error { padding: 12px 20px; color: #ef4444; font-size: 13px; }
.dsh-sh-pkg-info { font-size: 11px; opacity: 0.4; padding: 8px 20px; text-align: center; }

/* ── 详情页统计卡 ─────────────────────────────────────────── */
.dsh-sh-stat-row {
  display: flex; gap: 10px; margin: 14px 0 4px; flex-wrap: wrap;
}
.dsh-sh-stat-card {
  flex: 1 1 90px; min-width: 90px; padding: 10px 12px; border-radius: 10px;
  border: 1px solid var(--dsh-border, rgba(255,255,255,0.1));
  background: var(--dsh-bg-input, rgba(128,128,128,0.08));
  display: flex; flex-direction: column; gap: 2px;
}
.dsh-sh-stat-card-label {
  font-size: 10px; opacity: 0.55; letter-spacing: 0.6px; text-transform: uppercase;
}
.dsh-sh-stat-card-value {
  font-size: 17px; font-weight: 650; letter-spacing: 0.2px;
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;
}
.dsh-sh-stat-card-value .dsh-sh-stat-ico { font-size: 12px; margin-right: 3px; }
.dsh-sh-detail-sub { font-size: 12px; opacity: 0.65; margin-top: 4px; line-height: 1.6; }
.dsh-sh-detail-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.dsh-sh-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--dsh-bg-input, rgba(128,128,128,0.1));
  border: 1px solid var(--dsh-border, rgba(255,255,255,0.08)); opacity: 0.8;
}

/* 浅色主题补充 */
.dsh-skill-hub-panel.light .dsh-sh-stat { color: #6b7280; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-stat.muted { color: #9ca3af; }
.dsh-skill-hub-panel.light .dsh-sh-card-desc { color: #5f6368; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-stat-card { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }
.dsh-skill-hub-panel.light .dsh-sh-stat-card-label { color: #9ca3af; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-stat-card-value { color: #111827; }
.dsh-skill-hub-panel.light .dsh-sh-tag { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); color: #4b5563; opacity: 1; }
.dsh-skill-hub-panel.light .dsh-sh-detail-sub { color: #6b7280; opacity: 1; }

/* ── 技能中心内嵌 Tab（技能市场） ─────────────────────────── */
/* Pane injected into the host skill-center page, next to its own tab content */
.dsh-skill-hub-tabpane {
  flex: 1 1 auto; min-height: 0; min-width: 0;
  display: flex; flex-direction: column; overflow: hidden;
}
.dsh-skill-hub-embed-host {
  flex: 1 1 auto; min-height: 0; min-width: 0;
  display: flex; flex-direction: column; background: transparent;
}
/* The modal panel re-used as a full-bleed page body (no frame of its own) */
.dsh-skill-hub-panel.dsh-skill-hub-embed {
  width: 100%; height: 100%; max-width: none; max-height: none;
  border: none; border-radius: 0; box-shadow: none; background: transparent;
}
.dsh-skill-hub-panel.dsh-skill-hub-embed.light { background: transparent; color: inherit; }
.dsh-skill-hub-panel.dsh-skill-hub-embed .dsh-sh-header { padding: 10px 16px 8px; }
.dsh-skill-hub-panel.dsh-skill-hub-embed .dsh-sh-grid { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.dsh-skill-hub-panel.dsh-skill-hub-embed .dsh-sh-cat-sidebar { padding-top: 8px; }
/* segmented view switcher (embed mode) */
.dsh-sh-seg { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: rgba(127,127,127,0.14); flex-shrink: 0; }
.dsh-sh-seg-btn { border: 0; background: transparent; color: inherit; font-family: inherit; font-size: 12px; line-height: 1.4; padding: 4px 10px; border-radius: 6px; cursor: pointer; opacity: 0.7; white-space: nowrap; }
.dsh-sh-seg-btn:hover { opacity: 1; }
.dsh-sh-seg-btn.active { background: rgba(127,127,127,0.26); opacity: 1; font-weight: 600; }

/* ── 技能详情浮层（输入框技能选择器） ─────────────────────── */
.dsh-sh-tip {
  position: fixed; z-index: 1000; width: 300px; max-height: 264px; overflow: hidden;
  display: flex; flex-direction: column; gap: 6px;
  padding: 11px 12px 10px; border-radius: 10px;
  background: #ffffff; color: #1a1a2e; border: 1px solid rgba(0,0,0,0.12);
  box-shadow: 0 14px 34px rgba(0,0,0,0.22); pointer-events: none;
  font-size: 12px; line-height: 1.5; text-align: left;
}
.dsh-sh-tip-head { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.dsh-sh-tip-title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-sh-tip-ver { flex: none; font-size: 11px; color: #8b8b95; }
.dsh-sh-tip-desc { color: #4b5563; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.dsh-sh-tip-empty { color: #9ca3af; }
.dsh-sh-tip-meta { display: grid; grid-template-columns: auto 1fr; gap: 2px 8px; font-size: 11px; color: #6b7280; }
.dsh-sh-tip-key { color: #9ca3af; white-space: nowrap; }
.dsh-sh-tip-val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-sh-tip-hint { padding-top: 4px; border-top: 1px solid rgba(0,0,0,0.07); color: #9ca3af; font-size: 11px; }

/* ── 入口位置设置（关于 tab） ─────────────────────────────── */
.dsh-sh-entry-opts { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.dsh-sh-entry-opt {
  display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left;
  padding: 9px 12px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 13px;
  color: inherit; background: var(--dsh-bg-input, rgba(128,128,128,0.07));
  border: 1px solid var(--dsh-border, rgba(255,255,255,0.1));
}
.dsh-sh-entry-opt:hover { border-color: rgba(99,102,241,0.45); }
.dsh-sh-entry-opt.active { border-color: #6366f1; background: rgba(99,102,241,0.12); }
.dsh-sh-entry-opt-radio {
  flex: none; width: 13px; height: 13px; margin-top: 3px; border-radius: 50%;
  border: 1.5px solid currentColor; opacity: 0.45; position: relative;
}
.dsh-sh-entry-opt.active .dsh-sh-entry-opt-radio { opacity: 1; border-color: #6366f1; }
.dsh-sh-entry-opt.active .dsh-sh-entry-opt-radio::after {
  content: ""; position: absolute; inset: 3px; border-radius: 50%; background: #6366f1;
}
.dsh-sh-entry-opt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-sh-entry-opt-label { font-size: 13px; font-weight: 550; }
.dsh-sh-entry-opt-desc { font-size: 11.5px; opacity: 0.6; line-height: 1.45; }

/* ── 侧边栏底部入口（sidebar.footer.action 官方席位） ─────── */
.dsh-sh-footer-entry {
  display: flex; align-items: center; gap: 8px; width: 100%;
  height: 32px; padding: 0 8px; margin: 0; border: 0; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary, inherit);
  font-family: inherit; font-size: 13px; cursor: pointer; text-align: left;
}
.dsh-sh-footer-entry:hover {
  background: var(--dsw-alias-bg-hover, rgba(127,127,127,0.14));
  color: var(--dsw-alias-label-primary, inherit);
}
.dsh-sh-footer-entry-icon {
  display: inline-flex; width: 20px; height: 20px; flex: none;
  align-items: center; justify-content: center;
}
.dsh-sh-footer-entry-icon svg { display: block; width: 17px; height: 17px; }
.dsh-sh-footer-entry-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-sh-footer-entry-rail {
  justify-content: center; width: 36px; height: 36px; padding: 0;
  border-radius: 50%; margin: 0 auto;
}
.dsh-sh-footer-entry-rail .dsh-sh-footer-entry-label { display: none; }
    `;

    var cssInjected = false;
    function injectCSS() {
      if (cssInjected) return;
      cssInjected = true;
      var style = document.createElement("style");
      style.setAttribute("data-dsh-skill-hub", "");
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // ── Minimal Markdown renderer ────────────────────────────────────

    function escapeHtml(text) {
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function renderMarkdown(md) {
      if (!md) return "";
      // Remove frontmatter
      var lines = md.split("\n");
      if (lines[0] && lines[0].trim() === "---") {
        var endIdx = -1;
        for (var i = 1; i < lines.length; i++) {
          if (lines[i].trim() === "---") { endIdx = i; break; }
        }
        if (endIdx >= 0) lines = lines.slice(endIdx + 1);
      }
      var text = lines.join("\n");

      // Code blocks (```lang ... ```)
      text = text.replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
        return '<pre><code>' + escapeHtml(code.trimEnd()) + '</code></pre>';
      });
      // Inline code
      text = text.replace(/`([^`]+)`/g, function(m, code) { return '<code>' + escapeHtml(code) + '</code>'; });
      // Headers
      text = text.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
      text = text.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
      text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
      // Bold and italic
      text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      // Links [text](url)
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      // Images ![alt](src)
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
      // Horizontal rules
      text = text.replace(/^---$/gm, '<hr/>');
      // Blockquotes
      text = text.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
      // Tables (simple)
      text = text.replace(/^\|(.+)\|$/gm, function(m, row) {
        var cells = row.split("|").map(function(c) { return c.trim(); });
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        if (cells.every(function(c) { return /^[-:]+$/.test(c); })) return ""; // separator row
        var tag = "td";
        return "<tr>" + cells.map(function(c) { return "<" + tag + ">" + c + "</" + tag + ">"; }).join("") + "</tr>";
      });
      text = text.replace(/(<tr>[\s\S]*?<\/tr>)/g, function(m) {
        return '<table>' + m + '</table>';
      });
      // Lists (ul)
      text = text.replace(/^[\*\-]\s+(.+)$/gm, '<li>$1</li>');
      text = text.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li)/g, function(m) {
        if (m.indexOf("<ul>") === 0) return m;
        return "<ul>" + m + "</ul>";
      });
      // Paragraphs (remaining lines)
      text = text.replace(/\n\n/g, '</p><p>');
      text = text.replace(/^(?!<[hupoltb])(.+)$/gm, function(m, line) {
        if (line.trim() === "") return "";
        return "<p>" + line + "</p>";
      });
      // Clean up empty paragraphs and nested wrappers
      text = text.replace(/<p><\/p>/g, "");
      text = text.replace(/<ul>\s*<\/ul>/g, "");
      text = text.replace(/<\/ul>\s*<ul>/g, "");

      return text;
    }

    // ── API helper ───────────────────────────────────────────────────

    function makeApi(rpc) {
      return {
        call: function(endpoint, payload) {
          var controller = new AbortController();
          return rpc.call("/api", endpoint, payload || {}, controller.signal).then(function(result) {
            if (!result.ok) throw new Error(result.error ? result.error.message : "RPC error");
            return result.value;
          });
        }
      };
    }

    // ── Toast component ──────────────────────────────────────────────

    function Toast(_a) {
      var message = _a.message, type = _a.type, onClose = _a.onClose;
      useEffect(function() {
        var timer = setTimeout(onClose, 3000);
        return function() { clearTimeout(timer); };
      }, [onClose]);
      return h("div", { className: "dsh-sh-toast " + (type || ""), onClick: onClose },
        type === "success" ? "✓ " : type === "error" ? "✕ " : "", message
      );
    }

    // ── 数字与头像 ──────────────────────────────────────────────────

    /** 计数格式化：1160254 → "116万"，4457 → "4.5k"，812 → "812" */
    function formatCount(n) {
      var v = Number(n);
      if (!isFinite(v) || v <= 0) return "";
      if (v >= 100000000) return trimZero(v / 100000000) + "亿";
      if (v >= 10000) return trimZero(v / 10000) + "万";
      if (v >= 1000) return trimZero(v / 1000) + "k";
      return String(v);
    }
    function trimZero(x) {
      return x.toFixed(1).replace(/\.0$/, "");
    }

    var AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

    /** 按 slug 稳定地选一个颜色，保证同一技能每次渲染颜色一致 */
    function avatarColor(seed) {
      var s = String(seed || "");
      var n = 0;
      for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
      return AVATAR_COLORS[n % AVATAR_COLORS.length];
    }

    /** 技能头像：优先官方 iconUrl，加载失败回退到彩色字母块 */
    function SkillIcon(_a) {
      var skill = _a.skill, size = _a.size;
      var _b = useState(!!skill.iconUrl), showImg = _b[0], setShowImg = _b[1];
      var name = skill.displayName || skill.name || skill.slug || "?";
      var dim = (size || 36) + "px";
      if (showImg && skill.iconUrl) {
        return h("div", {
          className: "dsh-sh-avatar",
          style: { width: dim, height: dim, borderRadius: Math.round((size || 36) / 4) + "px" }
        },
          h("img", {
            src: skill.iconUrl,
            alt: "",
            loading: "lazy",
            onError: function() { setShowImg(false); }
          })
        );
      }
      return h("div", {
        className: "dsh-sh-avatar",
        style: {
          width: dim, height: dim,
          borderRadius: Math.round((size || 36) / 4) + "px",
          background: avatarColor(skill.slug || skill.name),
          fontSize: Math.round((size || 36) * 0.42) + "px"
        }
      }, name.trim().charAt(0).toUpperCase());
    }

    // ── Skill Card component ──────────────────────────────────────────

    function SkillCard(_a) {
      var skill = _a.skill, onInstall = _a.onInstall, onUninstall = _a.onUninstall, onDetail = _a.onDetail, onUse = _a.onUse, installing = _a.installing;
      var name = skill.displayName || skill.name || skill.slug || "未命名技能";
      var desc = skill.summaryZh || skill.summary || skill.description || "暂无描述";
      var starText = formatCount(skill.stars);
      var dlText = formatCount(skill.downloads);

      return h("div", { className: "dsh-sh-card", onClick: function() { onDetail(skill); } },
        h(SkillIcon, { skill: skill, size: 36 }),
        h("div", { className: "dsh-sh-card-body" },
          h("div", { className: "dsh-sh-card-head" },
            h("span", { className: "dsh-sh-card-title", title: name }, name),
            skill.verified ? h("span", { className: "dsh-sh-verified", title: "官方认证" }, "✓") : null,
            skill.installed ? h("span", { className: "dsh-sh-card-badge installed" }, "已安装") : null
          ),
          h("div", { className: "dsh-sh-card-desc", title: desc }, desc),
          h("div", { className: "dsh-sh-card-stats" },
            starText
              ? h("span", { className: "dsh-sh-stat", title: "Star " + skill.stars },
                  h("span", { className: "dsh-sh-stat-ico star" }, "★"), starText)
              : null,
            dlText
              ? h("span", { className: "dsh-sh-stat", title: "下载量 " + skill.downloads },
                  h("span", { className: "dsh-sh-stat-ico" }, "↓"), dlText)
              : null,
            skill.version ? h("span", { className: "dsh-sh-stat muted" }, "v" + skill.version) : null,
            skill.author ? h("span", { className: "dsh-sh-stat muted ellipsis", title: skill.author }, skill.author) : null,
            h("span", { className: "dsh-sh-card-badge source" }, skill.sourceLabel || skill.source)
          )
        ),
        h("div", { className: "dsh-sh-card-actions" },
          skill.installed
            ? h("button", { className: "dsh-sh-btn", onClick: function(e) { e.stopPropagation(); onUse(skill); } }, "使用")
            : h("button", {
                className: "dsh-sh-btn primary" + (installing ? " loading" : ""),
                onClick: function(e) { e.stopPropagation(); onInstall(skill); },
                disabled: installing
              }, installing ? "安装中..." : "安装"),
          skill.installed
            ? h("button", { className: "dsh-sh-btn danger", onClick: function(e) { e.stopPropagation(); onUninstall(skill); } }, "卸载")
            : h("button", { className: "dsh-sh-btn", onClick: function(e) { e.stopPropagation(); onDetail(skill); } }, "查看")
        )
      );
    }

    /** tags 可能是字符串数组，也可能是 SkillHub 的 [{key,name}] 结构，统一成名字数组 */
    function tagNames(tags) {
      if (!tags || !tags.length) return [];
      return tags.map(function(t) {
        if (typeof t === "string") return t;
        return t && (t.name || t.key) ? String(t.name || t.key) : "";
      }).filter(Boolean);
    }

    /** 详情页顶部的统计卡（Star / 下载 / 安装），无数据的不显示 */
    function StatRow(_a) {
      var detail = _a.detail;
      var cards = [];
      if (Number(detail.stars) > 0) {
        cards.push({ label: "Star", value: formatCount(detail.stars), ico: "★", star: true });
      }
      if (Number(detail.downloads) > 0) {
        cards.push({ label: "下载量", value: formatCount(detail.downloads), ico: "↓", star: false });
      }
      if (Number(detail.installs) > 0) {
        cards.push({ label: "安装量", value: formatCount(detail.installs), ico: "⤓", star: false });
      }
      if (!cards.length) return null;
      return h("div", { className: "dsh-sh-stat-row" },
        cards.map(function(c) {
          return h("div", { className: "dsh-sh-stat-card", key: c.label },
            h("div", { className: "dsh-sh-stat-card-label" }, c.label),
            h("div", { className: "dsh-sh-stat-card-value" },
              h("span", { className: "dsh-sh-stat-ico" + (c.star ? " star" : "") }, c.ico),
              c.value
            )
          );
        })
      );
    }

    // ── Detail View component ────────────────────────────────────────

    function DetailView(_a) {
      var skill = _a.skill, rpc = _a.rpc, onBack = _a.onBack, onInstall = _a.onInstall, onUninstall = _a.onUninstall, onUse = _a.onUse;
      var _b = useState(null), detail = _b[0], setDetail = _b[1];
      var _c = useState(true), loading = _c[0], setLoading = _c[1];
      var _d = useState(null), error = _d[0], setError = _d[1];
      var _e = useState(false), installing = _e[0], setInstalling = _e[1];

      useEffect(function() {
        var aborted = false;
        setLoading(true); setError(null); setDetail(null);
        makeApi(rpc).call("skill-hub/detail", { slug: skill.slug, source: skill.source, ownerHandle: skill.ownerHandle })
          .then(function(d) { if (!aborted) { setDetail(d); setLoading(false); } })
          .catch(function(e) { if (!aborted) { setError(e.message); setLoading(false); } });
        return function() { aborted = true; };
      }, [skill]);

      var doInstall = function() {
        setInstalling(true);
        makeApi(rpc).call("skill-hub/install", { slug: skill.slug, source: skill.source, ownerHandle: skill.ownerHandle })
          .then(function() { setInstalling(false); onInstall(skill); })
          .catch(function(e) { setInstalling(false); setError(e.message); });
      };

      if (loading) return h("div", { className: "dsh-sh-loading" }, h("span", { className: "dsh-sh-spinner" }), " 加载中...");
      if (error) return h("div", { className: "dsh-sh-error" }, "加载失败: ", error);
      if (!detail) return h("div", { className: "dsh-sh-empty" }, "未找到技能详情");

      var readme = detail.readme || "";
      var readmeHtml = renderMarkdown(readme);
      var isInstalled = detail.installed || skill.installed;
      var tags = tagNames(detail.tags);
      var metaBits = [];
      if (detail.author) metaBits.push("作者 " + detail.author);
      if (detail.version) metaBits.push("版本 v" + detail.version);
      metaBits.push("来源 " + (detail.source || skill.source));
      var subText = detail.summaryZh || detail.summary || skill.summaryZh || skill.summary || "";

      return h("div", { className: "dsh-sh-detail" },
        h("div", { className: "dsh-sh-detail-header" },
          h("div", { style: { display: "flex", alignItems: "center", gap: "12px" } },
            h("button", { className: "dsh-sh-btn", onClick: onBack }, "← 返回"),
            h(SkillIcon, { skill: detail, size: 44 }),
            h("div", { style: { minWidth: 0 } },
              h("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                h("div", { className: "dsh-sh-detail-title" }, detail.displayName || detail.name),
                detail.verified ? h("span", { className: "dsh-sh-verified", title: "官方认证" }, "✓") : null,
                isInstalled ? h("span", { className: "dsh-sh-card-badge installed" }, "已安装") : null
              ),
              h("div", { className: "dsh-sh-detail-meta" },
                metaBits.map(function(t, i) { return h("span", { key: i }, t); })
              )
            )
          ),
          subText ? h("div", { className: "dsh-sh-detail-sub" }, subText) : null,
          h(StatRow, { detail: detail }),
          tags.length
            ? h("div", { className: "dsh-sh-detail-tags" },
                tags.map(function(t) { return h("span", { className: "dsh-sh-tag", key: t }, t); })
              )
            : null,
          h("div", { style: { display: "flex", gap: "8px", marginTop: "14px" } },
            isInstalled
              ? h("button", { className: "dsh-sh-btn primary", onClick: function() { onUse(detail); } }, "使用此技能")
              : h("button", { className: "dsh-sh-btn primary" + (installing ? " loading" : ""), onClick: doInstall, disabled: installing }, installing ? "安装中..." : "安装"),
            isInstalled
              ? h("button", { className: "dsh-sh-btn danger", onClick: function() { onUninstall(detail); } }, "卸载")
              : null
          )
        ),
        readme
          ? h("div", { className: "dsh-sh-detail-section" },
              h("div", { className: "dsh-sh-detail-section-title" }, "README"),
              h("div", { className: "dsh-sh-readme", dangerouslySetInnerHTML: { __html: readmeHtml } })
            )
          : h("div", { className: "dsh-sh-empty" }, "暂无 README 文档")
      );
    }

    // ── 入口模式：技能中心标签页 / 侧边栏左下角（二选一） ─────────────

    /** localStorage key holding the chosen entry surface. */
    var ENTRY_MODE_KEY = "dsh-skill-hub:entry-mode";

    /** Read the persisted entry mode; "center" is the default. */
    function readEntryMode() {
      try {
        var saved = window.localStorage && window.localStorage.getItem(ENTRY_MODE_KEY);
        if (saved === "footer" || saved === "center") return saved;
      } catch (e) { /* storage disabled */ }
      return "center";
    }

    /** Persist the entry mode (best effort — private mode may throw). */
    function persistEntryMode(mode) {
      try {
        if (window.localStorage) window.localStorage.setItem(ENTRY_MODE_KEY, mode);
      } catch (e) { /* storage disabled */ }
    }

    /** Tiny observable so every surface re-renders when the mode changes. */
    var entryMode = { mode: "center", listeners: [] };

    /** Switch the entry surface; no-op when unchanged. */
    function setEntryMode(mode) {
      if (mode !== "footer") mode = "center";
      if (entryMode.mode === mode) return;
      entryMode.mode = mode;
      persistEntryMode(mode);
      var listeners = entryMode.listeners.slice();
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](mode); } catch (e) { /* ignore */ }
      }
    }

    /** Subscribe the calling component to the current entry mode. */
    function useEntryMode() {
      var _s = useState(entryMode.mode), mode = _s[0], setMode = _s[1];
      useEffect(function () {
        var listener = function (next) { setMode(next); };
        entryMode.listeners.push(listener);
        return function () {
          var i = entryMode.listeners.indexOf(listener);
          if (i >= 0) entryMode.listeners.splice(i, 1);
        };
      }, []);
      return mode;
    }

    /**
     * Footer entry seat (official `sidebar.footer.action`): a row beside the
     * Settings button at the sidebar foot, icon-only while the rail is collapsed.
     */
    function SidebarFooterEntry(props) {
      var wide = !!(props && props.wide);
      return h("button", {
        type: "button",
        className: "dsh-sh-footer-entry" + (wide ? "" : " dsh-sh-footer-entry-rail"),
        title: "技能市场：搜索 / 安装 SkillHub 与 ClawHub 技能",
        "aria-label": "技能市场",
        "data-dsh-part": "sidebar-footer-entry",
        onClick: function () {
          window.dispatchEvent(new CustomEvent("dsh-skill-hub-toggle"));
        }
      },
        h("span", { className: "dsh-sh-footer-entry-icon", dangerouslySetInnerHTML: { __html: NAV_ICON } }),
        h("span", { className: "dsh-sh-footer-entry-label" }, "技能市场")
      );
    }

    // ── Main Skill Center Panel ──────────────────────────────────────

    function SkillCenterPanel(_a) {
      var rpc = _a.rpc, onClose = _a.onClose, onUseSkill = _a.onUseSkill, initialTab = _a.initialTab;
      var variant = _a.variant || "overlay";
      var isEmbed = variant === "embed";
      var _b = useState("market"), tab = _b[0], setTab = _b[1];
      var _c = useState(""), keyword = _c[0], setKeyword = _c[1];
      var _d = useState([]), items = _d[0], setItems = _d[1];
      var _e = useState(null), error = _e[0], setError = _e[1];
      var _f = useState(false), loading = _f[0], setLoading = _f[1];
      var _g = useState(null), selectedSkill = _g[0], setSelectedSkill = _g[1];
      var _h = useState({}), installingMap = _h[0], setInstallingMap = _h[1];
      var _i = useState({}), toast = _i[0], setToast = _i[1];
      var _j = useState(1), page = _j[0];
      var _k = useState([]), categories = _k[0], setCategories = _k[1];
      var _l = useState(""), activeCategory = _l[0], setActiveCategory = _l[1];
      var searchTimer = useRef(null);
      var api = useMemo(function() { return makeApi(rpc); }, [rpc]);
      var entryModeValue = useEntryMode();

      // Apply initial tab
      useEffect(function() {
        if (initialTab) setTab(initialTab);
      }, [initialTab]);

      // Load categories on mount
      useEffect(function() {
        api.call("skill-hub/categories", {})
          .then(function(r) { setCategories(r.categories || []); })
          .catch(function() { /* silent */ });
      }, []);

      // Search (market tab)
      useEffect(function() {
        if (tab !== "market") return;
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(function() {
          setLoading(true); setError(null);
          api.call("skill-hub/search", { keyword: keyword, page: 1, pageSize: 60, category: activeCategory })
            .then(function(r) { setItems(r.items || []); setLoading(false); })
            .catch(function(e) { setError(e.message); setLoading(false); });
        }, keyword ? 300 : 100);
        return function() { if (searchTimer.current) clearTimeout(searchTimer.current); };
      }, [keyword, tab, activeCategory]);

      // Installed tab
      useEffect(function() {
        if (tab !== "installed") return;
        setLoading(true); setError(null);
        api.call("skill-hub/installed", {})
          .then(function(r) { setItems(r.skills || []); setLoading(false); })
          .catch(function(e) { setError(e.message); setLoading(false); });
      }, [tab]);

      var showToast = function(message, type) {
        setToast({ message: message, type: type });
      };

      var doInstall = function(skill) {
        var key = skill.slug || skill.name;
        setInstallingMap(function(prev) { var n = Object.assign({}, prev); n[key] = true; return n; });
        api.call("skill-hub/install", { slug: skill.slug, source: skill.source, ownerHandle: skill.ownerHandle })
          .then(function() {
            setInstallingMap(function(prev) { var n = Object.assign({}, prev); n[key] = false; return n; });
            // Update item as installed
            setItems(function(prev) { return prev.map(function(it) { return (it.slug || it.name) === key ? Object.assign({}, it, { installed: true }) : it; }); });
            showToast("技能 \"" + (skill.displayName || skill.name) + "\" 安装成功", "success");
          })
          .catch(function(e) {
            setInstallingMap(function(prev) { var n = Object.assign({}, prev); n[key] = false; return n; });
            showToast("安装失败: " + e.message, "error");
          });
      };

      var doUninstall = function(skill) {
        if (!confirm("确定卸载技能 \"" + (skill.displayName || skill.name) + "\"？")) return;
        api.call("skill-hub/uninstall", { slug: skill.slug || skill.name })
          .then(function() {
            setItems(function(prev) { return prev.map(function(it) { return (it.slug || it.name) === (skill.slug || skill.name) ? Object.assign({}, it, { installed: false }) : it; }).filter(function(it) { return tab !== "installed" || it.installed; }); });
            showToast("技能已卸载", "success");
          })
          .catch(function(e) { showToast("卸载失败: " + e.message, "error"); });
      };

      var doUse = function(skill) {
        onUseSkill(skill);
        if (onClose) onClose();
      };

      // ESC to close (overlay only — the embedded tab is closed by the host)
      useEffect(function() {
        if (isEmbed) return;
        var handler = function(e) { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return function() { window.removeEventListener("keydown", handler); };
      }, [onClose, isEmbed]);

      // Detect theme
      var _k = useState(false), isLight = _k[0], setIsLight = _k[1];
      useEffect(function() {
        try {
          var root = document.documentElement;
          var check = function() { setIsLight(root.getAttribute("data-theme") === "light" || root.classList.contains("light") || !root.classList.contains("dark")); };
          check();
          var observer = new MutationObserver(check);
          observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
          return function() { observer.disconnect(); };
        } catch(e) { /* fallback to dark */ }
      }, []);

      // Compact view switcher used when embedded in the host 技能中心 tab
      // (the host already renders the outer tab row, so no second underline).
      var segBtn = function(id, label) {
        return h("button", {
          className: "dsh-sh-seg-btn" + (tab === id ? " active" : ""),
          onClick: function() { setTab(id); setSelectedSkill(null); setKeyword(""); }
        }, label);
      };

      // Entry-surface switch. Leaving 技能中心 from inside it would tear this
      // very pane down, so first hand the market over to the overlay panel.
      var switchEntryMode = function(next, label) {
        if (isEmbed) {
          try {
            window.dispatchEvent(new CustomEvent("dsh-skill-hub-open", { detail: { tab: tab } }));
          } catch (e) { /* overlay unavailable */ }
        }
        setEntryMode(next);
        setToast({ message: "入口已切换到「" + label + "」", type: "ok" });
      };

      var entryOption = function(id, label, desc) {
        var on = entryModeValue === id;
        return h("button", {
          type: "button",
          className: "dsh-sh-entry-opt" + (on ? " active" : ""),
          role: "radio",
          "aria-checked": on ? "true" : "false",
          onClick: function() { if (!on) switchEntryMode(id, label); }
        },
          h("span", { className: "dsh-sh-entry-opt-radio", "aria-hidden": "true" }),
          h("span", { className: "dsh-sh-entry-opt-text" },
            h("span", { className: "dsh-sh-entry-opt-label" }, label),
            h("span", { className: "dsh-sh-entry-opt-desc" }, desc)
          )
        );
      };

      return h("div", { className: isEmbed ? "dsh-skill-hub-embed-host" : "dsh-skill-hub-overlay", onClick: isEmbed ? undefined : onClose },
        h("div", { className: "dsh-skill-hub-panel" + (isEmbed ? " dsh-skill-hub-embed" : "") + (isLight ? " light" : ""), onClick: function(e) { e.stopPropagation(); } },
          // Header
          h("div", { className: "dsh-sh-header" },
            isEmbed ? null : h("div", { className: "dsh-sh-title" }, "⚡ 技能市场"),
            h("div", { className: "dsh-sh-search-wrap" },
              h("span", { className: "dsh-sh-search-icon" }, "🔍"),
              h("input", {
                className: "dsh-sh-search-input",
                placeholder: tab === "market" ? "搜索技能（支持中文）..." : "筛选已安装技能...",
                value: keyword,
                onChange: function(e) { setKeyword(e.target.value); },
                autoFocus: !isEmbed
              })
            ),
            isEmbed ? h("div", { className: "dsh-sh-seg" },
              segBtn("market", "浏览"),
              segBtn("installed", "已安装"),
              segBtn("about", "关于")
            ) : null,
            isEmbed ? null : h("button", { className: "dsh-sh-close", onClick: onClose, title: "关闭" }, "×")
          ),
          // Tabs (overlay only — embedded mode uses the segmented control)
          isEmbed ? null : h("div", { className: "dsh-sh-tabs" },
            h("button", { className: "dsh-sh-tab" + (tab === "market" ? " active" : ""), onClick: function() { setTab("market"); setSelectedSkill(null); setKeyword(""); } }, "技能市场"),
            h("button", { className: "dsh-sh-tab" + (tab === "installed" ? " active" : ""), onClick: function() { setTab("installed"); setSelectedSkill(null); setKeyword(""); } }, "已安装"),
            h("button", { className: "dsh-sh-tab" + (tab === "about" ? " active" : ""), onClick: function() { setTab("about"); setSelectedSkill(null); } }, "关于")
          ),
          // Body
          h("div", { className: "dsh-sh-body" },
            function() {
              if (tab === "about") {
                return h("div", { className: "dsh-sh-detail" },
                  h("h2", null, "dsh-skill-market"),
                  h("p", { style: { opacity: 0.7 } }, "DeepSeek Harness 技能市场插件 — 聚合 SkillHub + ClawHub 双数据源"),
                  h("div", { className: "dsh-sh-detail-section" },
                    h("div", { className: "dsh-sh-detail-section-title" }, "功能"),
                    h("ul", null,
                      h("li", null, "搜索技能：聚合 SkillHub（腾讯镜像）和 ClawHub（官方源）双数据源"),
                      h("li", null, "分类导航：左侧 13 个分类一键筛选"),
                      h("li", null, "一键安装/卸载：安装到本地技能目录，自动热发现"),
                      h("li", null, "已安装技能：通过 dsh 官方注册表列出全部已注册技能（含插件自带）"),
                      h("li", null, "站内 README 预览：无需跳转外部页面"),
                      h("li", null, "双主题适配：自动跟随深色/浅色主题")
                    )
                  ),
                  h("div", { className: "dsh-sh-detail-section" },
                    h("div", { className: "dsh-sh-detail-section-title" }, "数据源"),
                    h("p", null, h("strong", null, "SkillHub"), " (api.skillhub.tencent.com) — 腾讯云中国镜像，高速直连"),
                    h("p", null, h("strong", null, "ClawHub"), " (clawhub.com) — OpenClaw 官方技能社区")
                  ),
                  h("div", { className: "dsh-sh-detail-section" },
                    h("div", { className: "dsh-sh-detail-section-title" }, "使用方法"),
                    h("p", null, "1. 在「技能市场」搜索你需要的技能，或按分类筛选"),
                    h("p", null, "2. 点击「安装」一键下载到本地"),
                    h("p", null, "3. 安装后点击「使用」或在输入栏输入 /技能名 调用"),
                    h("p", null, "4. 在「已安装」查看/卸载已装技能")
                  ),
                  h("div", { className: "dsh-sh-detail-section" },
                    h("div", { className: "dsh-sh-detail-section-title" }, "入口位置"),
                    h("p", { style: { opacity: 0.7, margin: 0 } }, "二选一，切换后立即生效，并记住本机的选择。"),
                    h("div", { className: "dsh-sh-entry-opts", role: "radiogroup", "aria-label": "技能市场入口位置" },
                      entryOption("center", "技能中心标签页", "在「技能中心」里与 技能 / 导入 / 创建 并列作为一个标签页"),
                      entryOption("footer", "侧边栏左下角", "在左侧栏底部、设置按钮旁固定一个「技能市场」入口")
                    ),
                    entryModeValue === "footer"
                      ? h("p", { style: { opacity: 0.55, marginTop: 8, marginBottom: 0 } }, "当前：入口在左下角点击后以浮层打开。")
                      : h("p", { style: { opacity: 0.55, marginTop: 8, marginBottom: 0 } }, "当前：入口在「技能中心」内的「技能市场」标签页。")
                  )
                );
              }
              if (selectedSkill) {
                return h(DetailView, { skill: selectedSkill, rpc: rpc, onBack: function() { setSelectedSkill(null); }, onInstall: doInstall, onUninstall: doUninstall, onUse: doUse });
              }
              if (loading) return h("div", { className: "dsh-sh-loading" }, h("span", { className: "dsh-sh-spinner" }), " 加载中...");
              if (error) return h("div", { className: "dsh-sh-error" }, "错误: ", error);
              // Filter installed by keyword
              var filtered = tab === "installed" && keyword
                ? items.filter(function(s) {
                    var k = keyword.toLowerCase();
                    return (s.name || "").toLowerCase().indexOf(k) >= 0 || (s.description || "").toLowerCase().indexOf(k) >= 0;
                  })
                : items;
              if (!filtered || filtered.length === 0) {
                return h("div", { className: "dsh-sh-empty" },
                  tab === "market" ? (keyword ? "未找到匹配的技能" : "输入关键词搜索或选择分类浏览技能...") : "暂无已安装技能"
                );
              }
              // Market tab: show category sidebar + grid; Installed tab: list only
              if (tab === "market") {
                return h("div", { className: "dsh-sh-main" },
                  // Category sidebar
                  h("div", { className: "dsh-sh-cat-sidebar" },
                    h("div", { className: "dsh-sh-cat-item" + (!activeCategory ? " active" : ""), onClick: function() { setActiveCategory(""); } }, "全部分类"),
                    categories.map(function(cat) {
                      return h("div", {
                        key: cat.key,
                        className: "dsh-sh-cat-item" + (activeCategory === cat.key ? " active" : ""),
                        onClick: function() { setActiveCategory(cat.key); },
                        title: cat.nameEn || cat.name
                      }, cat.name || cat.nameEn);
                    })
                  ),
                  // Content area with grid
                  h("div", { className: "dsh-sh-content" },
                    h("div", { className: "dsh-sh-grid" },
                      filtered.map(function(skill) {
                        var key = skill.slug || skill.name;
                        return h(SkillCard, {
                          key: key,
                          skill: skill,
                          onInstall: doInstall,
                          onUninstall: doUninstall,
                          onDetail: setSelectedSkill,
                          onUse: doUse,
                          installing: installingMap[key] || false
                        });
                      })
                    )
                  )
                );
              }
              // Installed tab: simple list
              return h("div", { className: "dsh-sh-list" },
                filtered.map(function(skill) {
                  var key = skill.slug || skill.name;
                  return h(SkillCard, {
                    key: key,
                    skill: skill,
                    onInstall: doInstall,
                    onUninstall: doUninstall,
                    onDetail: setSelectedSkill,
                    onUse: doUse,
                    installing: installingMap[key] || false
                  });
                })
              );
            }()
          ),
          toast.message ? h(Toast, { message: toast.message, type: toast.type, onClose: function() { setToast({}); } }) : null
        )
      );
    }

    // ── Chat input button (quick skill picker) ───────────────────────

    /** ⓘ — "details available" affordance on the right of each picker row. */
    var INFO_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><circle cx="8" cy="8" r="6.1"/><path d="M8 7.2v4.1" stroke-linecap="round"/><circle cx="8" cy="4.55" r="0.85" fill="currentColor" stroke="none"/></svg>';

    function ChatInputButton(_a) {
      var rpc = _a.rpc, onInsertSkill = _a.onInsertSkill;
      var _b = useState(false), open = _b[0], setOpen = _b[1];
      var _c = useState(""), keyword = _c[0], setKeyword = _c[1];
      var _d = useState([]), skills = _d[0], setSkills = _d[1];
      var _e = useState(false), loading = _e[0], setLoading = _e[1];
      var _p = useState({ down: false, maxHeight: 320 }), placement = _p[0], setPlacement = _p[1];
      var api = useMemo(function() { return makeApi(rpc); }, [rpc]);
      var containerRef = useRef(null);
      var searchTimer = useRef(null);
      var allSkills = useRef([]);

      // Load installed skills when opened
      useEffect(function() {
        if (!open) return;
        setLoading(true);
        api.call("skill-hub/installed", {})
          .then(function(r) { allSkills.current = r.skills || []; setSkills(allSkills.current); setLoading(false); })
          .catch(function() { setLoading(false); });
      }, [open]);

      // Filter by keyword (local filter first, then remote search with debounce)
      useEffect(function() {
        if (!open) return;
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!keyword) {
          setSkills(allSkills.current);
          return;
        }
        // Local filter first (instant)
        var k = keyword.toLowerCase();
        var local = allSkills.current.filter(function(s) {
          return (s.name || "").toLowerCase().indexOf(k) >= 0 || (s.description || "").toLowerCase().indexOf(k) >= 0;
        });
        setSkills(local);
        // Remote search with debounce
        searchTimer.current = setTimeout(function() {
          setLoading(true);
          api.call("skill-hub/search", { keyword: keyword, page: 1, pageSize: 10 })
            .then(function(r) {
              var remote = r.items || [];
              // Merge: remote items not in local
              var localSlugs = {};
              allSkills.current.forEach(function(s) { localSlugs[(s.slug || s.name).toLowerCase()] = true; });
              var merged = local.slice();
              remote.forEach(function(s) {
                if (!localSlugs[(s.slug || s.name).toLowerCase()]) merged.push(s);
              });
              setSkills(merged);
              setLoading(false);
            })
            .catch(function() { setLoading(false); });
        }, 400);
        return function() { if (searchTimer.current) clearTimeout(searchTimer.current); };
      }, [keyword, open]);

      // Click outside to close
      useEffect(function() {
        if (!open) return;
        var handler = function(e) {
          if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return function() { document.removeEventListener("mousedown", handler); };
      }, [open]);

      var _t = useState(null), tip = _t[0], setTip = _t[1];

      // Fit the dropdown into the space the composer actually leaves above (or
      // below) the button — a fixed 320px box ran off the top of the window.
      var measurePlacement = function() {
        var next = { down: false, maxHeight: 320 };
        try {
          var el = containerRef.current;
          if (!el) return next;
          var rect = el.getBoundingClientRect();
          var vh = window.innerHeight || 900;
          var above = rect.top - 12;
          var below = vh - rect.bottom - 12;
          if (above < 220 && below > above) {
            next.down = true;
            next.maxHeight = Math.max(140, Math.min(320, below));
          } else {
            next.maxHeight = Math.max(140, Math.min(320, above));
          }
        } catch (e) { /* measurement unavailable */ }
        return next;
      };

      var togglePicker = function() {
        var next = !open;
        if (next) setPlacement(measurePlacement());
        setTip(null);
        setOpen(next);
      };

      var selectSkill = function(skill) {
        onInsertSkill(skill);
        setOpen(false);
        setKeyword("");
        setTip(null);
      };

      // Skill detail card — rendered through a portal on document.body and
      // positioned with viewport coordinates, so no composer ancestor
      // (transform / overflow / stacking context) can shift or clip it.
      var showTip = function(skill, el) {
        var box = { left: 8, top: 8 };
        try {
          var rect = el.getBoundingClientRect();
          var vw = window.innerWidth || 1200;
          var vh = window.innerHeight || 900;
          var W = 300, H = 250;
          var left = rect.left - W - 12;
          if (left < 8) left = Math.min(vw - W - 8, rect.right + 12);
          left = Math.max(8, Math.min(left, Math.max(8, vw - W - 8)));
          var top = rect.top + rect.height / 2 - H / 2;
          top = Math.max(8, Math.min(top, Math.max(8, vh - H - 8)));
          box = { left: left, top: top };
        } catch (e) { /* measurement unavailable */ }
        setTip({ skill: skill, left: box.left, top: box.top });
      };

      // A viewport-anchored card must not survive scrolling or a resize.
      useEffect(function() {
        if (!tip) return;
        var hide = function() { setTip(null); };
        window.addEventListener("scroll", hide, true);
        window.addEventListener("resize", hide);
        return function() {
          window.removeEventListener("scroll", hide, true);
          window.removeEventListener("resize", hide);
        };
      }, [tip]);

      var skillDesc = function(skill) {
        return skill.description || skill.summaryZh || skill.summary || "";
      };

      var tipRows = function(skill) {
        var rows = [];
        var src = skill.source === "clawhub" ? "ClawHub"
          : skill.source === "skillhub" ? "SkillHub"
          : (skill.installed ? "本地技能" : "");
        if (src) rows.push(["来源", src]);
        if (skill.author) rows.push(["作者", skill.author]);
        if (skill.downloads) rows.push(["下载", formatCount(skill.downloads)]);
        if (skill.stars) rows.push(["收藏", formatCount(skill.stars)]);
        if (skill.whenToUse) rows.push(["适用", skill.whenToUse]);
        if (skill.installed && (skill.dirName || skill.dir)) rows.push(["目录", skill.dirName || skill.dir]);
        return rows;
      };

      var renderTip = function() {
        if (!tip || !tip.skill) return null;
        var skill = tip.skill;
        var name = skill.displayName || skill.name || skill.slug;
        var desc = skillDesc(skill);
        var rows = tipRows(skill);
        return h("div", {
          className: "dsh-sh-tip",
          role: "tooltip",
          style: { left: tip.left + "px", top: tip.top + "px" }
        },
          h("div", { className: "dsh-sh-tip-head" },
            h("span", { className: "dsh-sh-tip-title" }, name),
            skill.version ? h("span", { className: "dsh-sh-tip-ver" }, "v" + skill.version) : null
          ),
          desc
            ? h("div", { className: "dsh-sh-tip-desc" }, desc)
            : h("div", { className: "dsh-sh-tip-desc dsh-sh-tip-empty" }, "该技能没有填写描述"),
          rows.length
            ? h("div", { className: "dsh-sh-tip-meta" },
                rows.map(function(row) {
                  return h(React.Fragment, { key: row[0] },
                    h("span", { className: "dsh-sh-tip-key" }, row[0]),
                    h("span", { className: "dsh-sh-tip-val", title: row[1] }, row[1])
                  );
                })
              )
            : null,
          h("div", { className: "dsh-sh-tip-hint" }, "点击整行插入 /" + (skill.slug || skill.name) + " 到输入框")
        );
      };

      // Portal the detail card to <body>: the composer sits inside transformed /
      // clipped ancestors, where a position:fixed child is silently re-anchored
      // (that is what scattered the card across the page).
      var tipNode = renderTip();
      if (tipNode && ReactDOM && typeof ReactDOM.createPortal === "function") {
        try { tipNode = ReactDOM.createPortal(tipNode, document.body); } catch (e) { /* keep inline */ }
      }

      return h("div", { ref: containerRef, style: { position: "relative" } },
        h("button", {
          className: "dsh-sh-input-btn",
          onClick: togglePicker,
          title: "选择技能"
        }, "⚡ 技能"),
        open ? h("div", {
          className: "dsh-sh-quick-pick" + (placement.down ? " down" : ""),
          style: { maxHeight: placement.maxHeight + "px" }
        },
          h("div", { style: { padding: "6px", borderBottom: "1px solid var(--dsh-border, rgba(255,255,255,0.06))" } },
            h("input", {
              style: { width: "100%", padding: "4px 8px", background: "var(--dsh-bg-input, rgba(0,0,0,0.2))", border: "1px solid var(--dsh-border, rgba(255,255,255,0.1))", borderRadius: "4px", color: "inherit", fontSize: "12px", outline: "none" },
              placeholder: "搜索技能...",
              value: keyword,
              onChange: function(e) { setKeyword(e.target.value); },
              autoFocus: true
            })
          ),
          loading
            ? h("div", { style: { padding: "12px", textAlign: "center", opacity: 0.5 } }, "加载中...")
            : skills.length === 0
              ? h("div", { style: { padding: "12px", textAlign: "center", opacity: 0.5 } }, keyword ? "未找到匹配技能" : "暂无技能")
              : skills.slice(0, 20).map(function(skill) {
                  var desc = skillDesc(skill);
                  return h("div", {
                    key: skill.slug || skill.name,
                    className: "dsh-sh-quick-pick-item",
                    onClick: function() { selectSkill(skill); }
                  },
                    h("div", { className: "dsh-sh-quick-pick-main" },
                      h("div", { className: "dsh-sh-quick-pick-name" },
                        (skill.displayName || skill.name),
                        skill.installed ? h("span", { className: "dsh-sh-quick-pick-badge" }, "已安装") : null
                      ),
                      desc ? h("div", { className: "dsh-sh-quick-pick-desc", title: desc }, desc) : null
                    ),
                    h("button", {
                      type: "button",
                      className: "dsh-sh-quick-pick-info",
                      "aria-label": "技能详情",
                      title: "查看技能详情",
                      onMouseEnter: function(e) { showTip(skill, e.currentTarget); },
                      onMouseLeave: function() { setTip(null); },
                      onFocus: function(e) { showTip(skill, e.currentTarget); },
                      onBlur: function() { setTip(null); },
                      onClick: function(e) { e.stopPropagation(); }
                    }, h("span", { dangerouslySetInnerHTML: { __html: INFO_ICON } }))
                  );
                })
        ) : null,
        tipNode
      );
    }

    // ── Sidebar nav entry (DOM injection, task-board pattern) ────────

    /** Lightning bolt icon — 18px, matches the shell's nav glyph style */
    var NAV_ICON = '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 1.5L3 9h4.5l-1 5.5L13 7H8.5l.5-5.5z"/></svg>';

    /** Family selectors — all sibling plugin entries for stable ordering */
    var FAMILY_SELECTORS = [
      '[data-dsh-taskboard-entry]',
      '[data-dsh-ssh-entry]',
      '[data-dsh-skill-explorer-entry]',
      '[data-dsh-skillhub-entry]'
    ];

    /** Find the sidebar shell root element, or undefined while not yet mounted. */
    function navSidebarRoot() {
      var column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]');
      if (!column) return undefined;
      var logoRow = column.querySelector('[class*="logoRow"]');
      return logoRow ? logoRow.parentElement : column.firstElementChild;
    }

    /** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
    function navNewSessionButton(root) {
      var nested = root.querySelector('button[class*="newSession"]');
      if (nested) return nested;
      for (var i = 0; i < root.children.length; i++) {
        if (root.children[i].tagName === 'BUTTON') return root.children[i];
      }
      return undefined;
    }

    /** Build the entry row (a detached button; insert once the shell is up). */
    function navCreateEntry(onToggle) {
      var entry = document.createElement('button');
      entry.type = 'button';
      entry.setAttribute('data-dsh-skillhub-entry', '');
      entry.setAttribute('data-dsh-plugin', 'skill-hub');
      entry.setAttribute('data-dsh-part', 'sidebar-entry');
      entry.className = 'dsh-sh-nav-entry';
      entry.setAttribute('aria-label', '技能市场');
      entry.setAttribute('title', '技能市场：从 SkillHub / ClawHub 搜索并安装技能');
      entry.innerHTML =
        '<span class="dsh-sh-nav-entry-icon">' + NAV_ICON + '</span>' +
        '<span class="dsh-sh-nav-entry-label">技能市场</span>';
      entry.addEventListener('click', onToggle);
      return entry;
    }

    /** Re-insert the entry after the New Session row, positioned in the family block. */
    function navPlaceEntry(root, entry) {
      var button = navNewSessionButton(root);
      if (!button) return false;
      if (entry.parentElement !== root) {
        var row = button.closest('[class*="logoRow"]');
        var base = (row && row.parentElement === root) ? row : button;
        var family = Array.prototype.slice.call(root.children).filter(function(el) {
          return el instanceof HTMLElement && el.matches(FAMILY_SELECTORS.join(', '));
        });
        // position: 'after' — insert after the last family entry (or after base if no family yet)
        var anchor = family.length > 0
          ? family[family.length - 1].nextElementSibling
          : base.nextElementSibling;
        root.insertBefore(entry, anchor);
      }
      return true;
    }

    /**
     * Mount the sidebar entry, waiting for the shell to render and self-healing
     * on later React re-renders.
     * @param onToggle - click handler (opens/toggles the skill center panel)
     * @returns disposer removing the entry and its observers
     */
    function mountNavEntry(onToggle) {
      // DOM-level idempotency: never mount a second entry
      if (document.querySelector('[data-dsh-skillhub-entry]')) {
        return function() {};
      }
      var entry = navCreateEntry(onToggle);
      var root;
      var placed = false;

      function tryPlace() {
        if (root !== undefined && !root.isConnected) {
          rootObserver.disconnect();
          root = undefined;
          placed = false;
        }
        if (placed) {
          if (document.body.contains(entry)) return;
          rootObserver.disconnect();
          root = undefined;
          placed = false;
        }
        if (root === undefined) root = navSidebarRoot();
        if (root === undefined) return;
        placed = navPlaceEntry(root, entry);
        if (placed) {
          rootObserver.observe(root, { childList: true, subtree: true });
        }
      }

      // Body-level watcher: detects whole sidebar pane rebuilds
      var waitObserver = new MutationObserver(function() { tryPlace(); });
      waitObserver.observe(document.body, { childList: true, subtree: true });

      // Self-heal: if a React re-render displaces the row, re-insert it in the same frame
      var rootObserver = new MutationObserver(function() {
        if (root === undefined || !root.isConnected) {
          placed = false;
          tryPlace();
          return;
        }
        if (!root.contains(entry)) {
          placed = navPlaceEntry(root, entry);
        }
      });

      tryPlace();

      return function() {
        waitObserver.disconnect();
        rootObserver.disconnect();
        entry.remove();
      };
    }

    // ── 技能中心：注入「技能市场」Tab ─────────────────────────────────
    // The host skill center (@linxin666/dsh-client-ui-skill-explorer) renders a
    // `[data-dsh-part="tab-bar"]` tablist followed by its own content element,
    // and exposes no API for third-party tabs. This section therefore injects
    // exactly two nodes into that page — one tab button and one empty pane —
    // and leaves the host's React tree untouched:
    //   • tab bar gains <button role="tab" data-dsh-skillhub-tab="market">
    //   • panel gains <div class="dsh-skill-hub-tabpane"> right after the host
    //     content; while our tab is active the host content is display:none
    //   • the market UI itself is rendered by a React portal owned by the
    //     always-mounted shell.overlay component (no second React root)
    // A debounced observer only re-inserts the two nodes if React drops them.

    var MARKET_TAB_PAGE = '[data-dsh-skill-explorer-view]';
    var MARKET_TAB_BAR = '[data-dsh-part="tab-bar"]';
    var MARKET_TAB_TAB = '[data-dsh-part="tab"]';
    var MARKET_TAB_ATTR = 'data-dsh-skillhub-tab';

    /** Bridge between the DOM injector and the React portal host. */
    var marketTab = {
      container: null,   // pane element to portal into (null = page closed)
      active: false,     // our tab is the visible one
      mounted: false,    // the embedded panel has been opened at least once
      version: 0,
      listeners: []
    };

    function setMarketTab(patch) {
      var changed = false;
      if ("container" in patch && patch.container !== marketTab.container) { marketTab.container = patch.container; changed = true; }
      if ("active" in patch && patch.active !== marketTab.active) { marketTab.active = patch.active; changed = true; }
      if ("mounted" in patch && patch.mounted !== marketTab.mounted) { marketTab.mounted = patch.mounted; changed = true; }
      if (!changed) return;
      marketTab.version++;
      var listeners = marketTab.listeners.slice();
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) { /* ignore */ } }
    }

    /** Re-render the portal host whenever the injected tab changes state. */
    function useMarketTab() {
      var _s = useState(0), setVersion = _s[1];
      useEffect(function () {
        var bump = function () { setVersion(function (v) { return v + 1; }); };
        marketTab.listeners.push(bump);
        return function () {
          var i = marketTab.listeners.indexOf(bump);
          if (i >= 0) marketTab.listeners.splice(i, 1);
        };
      }, []);
      return marketTab;
    }

    /** True when the host skill center registered its panel seat. */
    function skillExplorerInstalled(ctx) {
      try {
        var entries = ctx.slots.entries("main") || [];
        for (var i = 0; i < entries.length; i++) {
          var opts = entries[i] && entries[i].options;
          if (opts && opts.key === "skill-explorer") return true;
        }
      } catch (e) { /* entries() unavailable on older hosts */ }
      return false;
    }

    /**
     * Inject the 技能市场 tab into the host skill center and keep it attached.
     * @param onFallback - called once if the host page shows up but its tab bar
     *   cannot be found (host markup changed) so the market stays reachable
     * @returns disposer removing both nodes, listeners and observers
     */
    function mountMarketTab(onFallback) {
      var button = null;         // injected tab button
      var pane = null;           // injected pane (portal target)
      var hostContent = null;    // host content hidden while our tab is active
      var hostActiveButton = null;
      var tabBar = null;
      var scheduled = null;
      var desiredActive = false; // survives React replacing our two nodes
      var missSince = 0;         // first moment the page had no tab bar

      function hostTabs() {
        if (!tabBar) return [];
        return Array.prototype.slice.call(tabBar.querySelectorAll(MARKET_TAB_TAB)).filter(function (el) {
          return !el.hasAttribute(MARKET_TAB_ATTR);
        });
      }

      function applyVisuals() {
        if (!pane || !hostContent) return;
        if (button) button.setAttribute("aria-selected", desiredActive ? "true" : "false");
        if (desiredActive) {
          if (button) button.setAttribute("data-active", "");
          hostContent.style.display = "none";
          pane.style.display = "flex";
        } else {
          if (button) button.removeAttribute("data-active");
          hostContent.style.display = "";
          pane.style.display = "none";
        }
      }

      function activate() {
        if (!pane || !hostContent) return;
        var tabs = hostTabs();
        hostActiveButton = null;
        for (var i = 0; i < tabs.length; i++) {
          if (tabs[i].hasAttribute("data-active")) hostActiveButton = tabs[i];
          tabs[i].removeAttribute("data-active");
        }
        desiredActive = true;
        applyVisuals();
        setMarketTab({ active: true, mounted: true });
      }

      function deactivate(clickedHostTab) {
        desiredActive = false;
        // When another tab was clicked React re-renders the bar on its own;
        // re-marking the previous one only matters for a same-tab click.
        if (clickedHostTab && hostActiveButton === clickedHostTab) {
          clickedHostTab.setAttribute("data-active", "");
        }
        hostActiveButton = null;
        applyVisuals();
        setMarketTab({ active: false });
      }

      function buildButton() {
        var sample = hostTabs()[0];
        var el;
        if (sample) {
          el = sample.cloneNode(false); // inherit the host's exact tab styling
          while (el.firstChild) el.removeChild(el.firstChild);
          el.removeAttribute("id");
          el.removeAttribute("aria-controls");
        } else {
          el = document.createElement("button");
          el.type = "button";
          el.className = "dsh-sh-tab";
        }
        el.removeAttribute("data-active");
        el.removeAttribute("aria-selected");
        el.setAttribute("role", "tab");
        el.setAttribute("data-dsh-part", "tab");
        el.setAttribute(MARKET_TAB_ATTR, "market");
        el.setAttribute("title", "技能市场：搜索 / 安装 SkillHub 与 ClawHub 技能");
        el.textContent = "技能市场";
        el.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (!marketTab.active) activate();
        });
        return el;
      }

      function onTabBarClick(e) {
        var el = e.target;
        if (!el || !el.closest) return;
        var tab = el.closest(MARKET_TAB_TAB);
        if (!tab || tab.hasAttribute(MARKET_TAB_ATTR)) return; // our own tab
        if (marketTab.active) deactivate(tab);
      }

      function ensure() {
        var page = document.querySelector(MARKET_TAB_PAGE);
        if (!page) {
          missSince = 0;
          if (pane || tabBar) {
            if (tabBar) tabBar.removeEventListener("click", onTabBarClick, true);
            button = null; pane = null; hostContent = null; tabBar = null;
            hostActiveButton = null; desiredActive = false;
            setMarketTab({ container: null, active: false, mounted: false });
          }
          return;
        }
        var nextBar = page.querySelector(MARKET_TAB_BAR);
        if (!nextBar) {
          // Host page mounted but its tab bar is missing/renamed: keep the
          // market reachable through the sidebar row instead of losing it.
          if (!missSince) missSince = Date.now();
          else if (onFallback && Date.now() - missSince > 4000) {
            var fallback = onFallback;
            onFallback = null;
            try { fallback(); } catch (e) { /* ignore */ }
          }
          return;
        }
        missSince = 0;
        var content = nextBar.nextElementSibling;
        if (!content) return;

        // Keep the pane node itself when React only drops it from the tree:
        // re-inserting the same element keeps the portal (and its state) alive.
        if (!pane) {
          pane = document.createElement("div");
          pane.className = "dsh-skill-hub-tabpane";
          pane.setAttribute("data-dsh-skillhub-pane", "market");
          pane.style.display = "none";
          content.parentNode.insertBefore(pane, content.nextSibling);
          setMarketTab({ container: pane });
        } else if (pane.previousElementSibling !== content || pane.parentNode !== content.parentNode) {
          content.parentNode.insertBefore(pane, content.nextSibling);
        }
        hostContent = content;

        if (nextBar !== tabBar) {
          if (tabBar) tabBar.removeEventListener("click", onTabBarClick, true);
          tabBar = nextBar;
          tabBar.addEventListener("click", onTabBarClick, true);
        }
        if (!button || !button.isConnected || button.parentNode !== tabBar) {
          if (button && button.parentNode) button.parentNode.removeChild(button);
          button = buildButton();
          tabBar.appendChild(button);
        }
        // React may have replaced our nodes while our tab was the visible one.
        applyVisuals();
        if (desiredActive) setMarketTab({ active: true, mounted: true });
      }

      var observer = new MutationObserver(function () {
        if (scheduled) return;
        scheduled = window.setTimeout(function () {
          scheduled = null;
          try { ensure(); } catch (e) { /* never break the host UI */ }
        }, 80);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      try { ensure(); } catch (e) { /* host not up yet — observer will retry */ }

      return function () {
        observer.disconnect();
        if (scheduled) { window.clearTimeout(scheduled); scheduled = null; }
        if (tabBar) tabBar.removeEventListener("click", onTabBarClick, true);
        // Our tab may be the visible one: hand the host panel back before the
        // nodes disappear, otherwise its content stays display:none forever.
        if (hostContent) {
          try { hostContent.style.display = ""; } catch (e) { /* ignore */ }
        }
        if (desiredActive) {
          try {
            if (hostActiveButton && hostActiveButton.isConnected !== false) {
              hostActiveButton.setAttribute("data-active", "");
            }
          } catch (e) { /* ignore */ }
          desiredActive = false;
        }
        if (button && button.parentNode) button.parentNode.removeChild(button);
        if (pane && pane.parentNode) pane.parentNode.removeChild(pane);
        button = null; pane = null; hostContent = null; tabBar = null; hostActiveButton = null;
        setMarketTab({ container: null, active: false, mounted: false });
      };
    }

    // ── Plugin entry ─────────────────────────────────────────────────
    // Design principle: this plugin never rewrites host UI. The 技能市场 surface
    // now lives inside the host's own 技能中心 panel as one extra tab; the
    // plugin's standalone sidebar row survives only as a fallback for hosts
    // without that panel.

    var inject = ["slots", "connection"];
    function apply(ctx) {
      injectCSS();
      var rpc = ctx.get("connection").rpc;

      // Back to the conversation, then seed the composer with "/<skill> ".
      // The chat input slot listens for dsh-skill-hub-insert and calls
      // inputActions.setDraft(); the composer may need a moment to mount.
      var useSkillInComposer = function (skill) {
        var name = (skill && (skill.slug || skill.name)) || "";
        if (!name) return;
        try {
          var layout = ctx.get("layout");
          if (layout && typeof layout.selectPanel === "function") layout.selectPanel(null);
        } catch (e) { /* layout unavailable */ }
        var tries = 0;
        var attempt = function () {
          var areas = document.querySelectorAll("textarea");
          for (var i = 0; i < areas.length; i++) {
            if (areas[i].offsetParent !== null) {
              window.dispatchEvent(new CustomEvent("dsh-skill-hub-insert", { detail: { skill: name } }));
              return;
            }
          }
          if (++tries > 15) return;
          window.setTimeout(attempt, 100);
        };
        window.setTimeout(attempt, 50);
      };

      // ── Entry surface coordinator ───────────────────────────────────
      // center (default): the tab injected into 技能中心. Whenever that cannot
      //   work (no skill center, host markup changed, react-dom missing) a
      //   footer entry takes over, so the market is never unreachable.
      // footer: only the official sidebar.footer.action seat (bottom-left).
      entryMode.mode = readEntryMode();
      var canPortal = !!(ReactDOM && ReactDOM.createPortal);
      if (!canPortal && entryMode.mode === "center") {
        entryMode.mode = "footer";
        persistEntryMode("footer");
      }

      var tabDisposer = null;
      var footerDisposer = null;
      var domRow = null;
      var stopped = false;

      var openOverlay = function () {
        window.dispatchEvent(new CustomEvent("dsh-skill-hub-toggle"));
      };

      // Last resort when no sidebar slot can be claimed.
      var openDomRow = function () {
        if (domRow) return;
        try { domRow = mountNavEntry(openOverlay); } catch (e) { domRow = null; }
      };

      // Official seat beside Settings, at the sidebar foot (bottom-left).
      var openFooterEntry = function () {
        if (footerDisposer) return;
        try {
          footerDisposer = ctx.slots.inject("sidebar.footer.action", function () {
            return ctx.slots.register({
              name: "sidebar.footer.action",
              id: "skill-hub",
              order: 20
            }, SidebarFooterEntry);
          });
        } catch (e) {
          footerDisposer = null;
          openDomRow();
        }
      };

      var closeFooterEntry = function () {
        if (!footerDisposer) return;
        try { footerDisposer(); } catch (e) { /* ignore */ }
        footerDisposer = null;
      };

      var closeTab = function () {
        if (!tabDisposer) return;
        try { tabDisposer(); } catch (e) { /* ignore */ }
        tabDisposer = null;
      };

      var openTab = function () {
        if (tabDisposer || !canPortal) return;
        try {
          tabDisposer = mountMarketTab(openFooterEntry);
        } catch (e) {
          tabDisposer = null;
          openFooterEntry();
        }
      };

      /** Reconcile both entries with the chosen mode and host capability. */
      var syncEntry = function () {
        if (stopped) return;
        if (entryMode.mode === "footer" || !canPortal) {
          closeTab();
          openFooterEntry();
        } else {
          closeFooterEntry();
          openTab();
        }
      };

      // 1. Entry surface — mounted, torn down and swapped when the setting changes
      ctx.effect(function () {
        syncEntry();
        var listener = function () { syncEntry(); };
        entryMode.listeners.push(listener);
        return function () {
          stopped = true;
          var i = entryMode.listeners.indexOf(listener);
          if (i >= 0) entryMode.listeners.splice(i, 1);
          closeTab();
          closeFooterEntry();
          if (domRow) { try { domRow(); } catch (e) { /* ignore */ } domRow = null; }
        };
      }, "dsh-skill-hub: entry surface");

      // 1b. No skill center installed → footer entry keeps the market reachable.
      ctx.effect(function () {
        var timer = window.setTimeout(function () {
          if (stopped || entryMode.mode !== "center") return;
          if (skillExplorerInstalled(ctx)) return;
          if (document.querySelector('[data-dsh-panel-entry="skill-explorer"]')) return;
          openFooterEntry();
        }, 4000);
        return function () { window.clearTimeout(timer); };
      }, "dsh-skill-hub: no-skill-center fallback");

      // 1c. Host-markup watch: the panel is selected but our page marker never
      // appears (host renamed its root). The tab injection can never succeed
      // there, so fall back to the footer entry instead of an unreachable tab.
      ctx.effect(function () {
        var since = 0;
        var timer = window.setInterval(function () {
          if (stopped) return;
          if (entryMode.mode === "center" && marketTab.container) {
            if (footerDisposer) closeFooterEntry(); // injection recovered
            since = 0;
            return;
          }
          if (entryMode.mode === "footer" || footerDisposer) return;
          if (document.querySelector(MARKET_TAB_PAGE)) return; // observer handles the tab bar
          var selected = false;
          try {
            var face = ctx.get("layout");
            var info = face && face.panelInfo;
            var snap = info && typeof info.getSnapshot === "function" ? info.getSnapshot() : null;
            selected = !!(snap && snap.activePanelId === "skill-explorer");
          } catch (e) { /* older host without panelInfo */ }
          if (!selected) { since = 0; return; }
          if (!since) { since = Date.now(); return; }
          if (Date.now() - since > 2000) { since = 0; openFooterEntry(); }
        }, 1500);
        return function () {
          window.clearInterval(timer);
          if (domRow) { try { domRow(); } catch (e) { /* ignore */ } domRow = null; }
        };
      }, "dsh-skill-hub: host markup watch");

      // 2. Shell overlay — fallback panel + render host for the injected tab
      ctx.effect(function () {
        return ctx.slots.inject("shell.overlay", function () {
          return ctx.slots.register({
            name: "shell.overlay",
            id: "skill-hub",
            order: 30,
            inject: function () { return { rpc: rpc, onUseSkill: useSkillInComposer }; }
          }, SkillHubOverlay);
        });
      }, "dsh-skill-hub: overlay");

      // 3. Conversation input left — quick skill picker button
      // This is a session-scope list slot. The framework provides inputActions
      // (with setDraft(text)) as a standard prop to all session-scope slots.
      // + button and / slash commands are resident chrome / overlay slots —
      // our entry sits BESIDE them, never replaces them.
      ctx.effect(function () {
        return ctx.slots.inject("conversation.input.left", function () {
          return ctx.slots.register({
            name: "conversation.input.left",
            id: "skill-hub",
            order: 100,
            inject: function () { return { rpc: rpc }; }
          }, function (props) {
            // inputActions is a framework standard prop for session-scope slots
            var inputActions = props.inputActions;

            // Listen for insert requests from the overlay (SkillHubOverlay)
            // The overlay is in shell.overlay (root scope) and has no inputActions,
            // so it dispatches a CustomEvent that we handle here.
            useEffect(function () {
              var handler = function (e) {
                var skillName = e.detail && e.detail.skill;
                if (skillName && inputActions) {
                  inputActions.setDraft("/" + skillName + " ");
                }
              };
              window.addEventListener("dsh-skill-hub-insert", handler);
              return function () { window.removeEventListener("dsh-skill-hub-insert", handler); };
            }, [inputActions]);

            // Direct insertion when user picks a skill from the quick picker
            var onInsertSkill = function (skill) {
              var name = skill.slug || skill.name;
              if (inputActions) {
                inputActions.setDraft("/" + name + " ");
              }
            };
            return h(ChatInputButton, { rpc: rpc, onInsertSkill: onInsertSkill });
          });
        });
      }, "dsh-skill-hub: input button");
    }

    // ── Shell overlay wrapper (manages open/close state) ─────────────

    function SkillHubOverlay(props) {
      var _a = useState(false), open = _a[0], setOpen = _a[1];
      var _b = useState("market"), initialTab = _b[0], setInitialTab = _b[1];
      var rpc = props.rpc;
      var tab = useMarketTab();

      useEffect(function() {
        var toggleHandler = function() { setOpen(function(prev) { return !prev; }); };
        var openHandler = function(e) {
          if (e.detail && e.detail.tab) setInitialTab(e.detail.tab);
          setOpen(true);
        };
        var insertHandler = function(e) {
          // The overlay is rendered in the shell.overlay slot, which does NOT
          // receive inputActions. Instead, the input.left slot listens for
          // this event and does the actual setDraft call. But we also try a
          // direct DOM approach as a universal fallback: find the textarea and
          // insert text at the caret.
          if (e.detail && e.detail.text) {
            var textareas = document.querySelectorAll("textarea");
            for (var i = 0; i < textareas.length; i++) {
              var ta = textareas[i];
              if (ta.offsetParent !== null) { // visible
                var start = ta.selectionStart || ta.value.length;
                var end = ta.selectionEnd || ta.value.length;
                var newVal = ta.value.slice(0, start) + e.detail.text + ta.value.slice(end);
                // Use native setter to trigger React's onChange
                var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
                nativeInputValueSetter.call(ta, newVal);
                ta.dispatchEvent(new Event("input", { bubbles: true }));
                ta.selectionStart = ta.selectionEnd = start + e.detail.text.length;
                ta.focus();
                break;
              }
            }
          }
        };
        window.addEventListener("dsh-skill-hub-toggle", toggleHandler);
        window.addEventListener("dsh-skill-hub-open", openHandler);
        window.addEventListener("dsh-skill-hub-insert", insertHandler);
        return function() {
          window.removeEventListener("dsh-skill-hub-toggle", toggleHandler);
          window.removeEventListener("dsh-skill-hub-open", openHandler);
          window.removeEventListener("dsh-skill-hub-insert", insertHandler);
        };
      }, []);

      var onUseSkill = props.onUseSkill || function(skill) {
        var name = skill.slug || skill.name;
        // Dispatch event — the ChatInputButton (conversation.input.left) listens
        // and calls inputActions.setDraft() to insert text into the chat input
        var event = new CustomEvent("dsh-skill-hub-insert", { detail: { skill: name } });
        window.dispatchEvent(event);
      };

      var overlayNode = open
        ? h(SkillCenterPanel, {
            rpc: rpc,
            onClose: function() { setOpen(false); },
            onUseSkill: onUseSkill,
            initialTab: initialTab
          })
        : null;

      // The 技能市场 tab injected into the host skill center. Rendered through
      // a portal so it shares this component's React tree (no second root) and
      // keeps its state while the user switches between host tabs. The pane is
      // mounted on first activation and only removed when the panel closes.
      var tabNode = (tab.container && tab.mounted && ReactDOM && ReactDOM.createPortal)
        ? ReactDOM.createPortal(
            h(SkillCenterPanel, {
              rpc: rpc,
              variant: "embed",
              onClose: function() {},
              onUseSkill: onUseSkill
            }),
            tab.container
          )
        : null;

      return h(React.Fragment, null, overlayNode, tabNode);
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
