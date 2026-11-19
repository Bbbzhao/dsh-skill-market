# dsh-skill-market

[简体中文](./README.md) | **English**

A skill marketplace plugin for DeepSeek Harness — aggregated search across SkillHub + ClawHub, in-app README preview, one-click install/uninstall, a chat-input skill picker (hover the ⓘ for details), and two selectable entry points: a "Skill Market" tab inside the Skill Center (default) or the bottom-left of the sidebar.

<p align="center">
  <img src="docs/screenshots/market.png" alt="Skill marketplace" width="720" />
</p>

## Features

- **Skill search**: aggregated results from SkillHub (Tencent Cloud China mirror, fast direct connection) and ClawHub (the official OpenClaw source); supports Chinese queries
- **One-click install/uninstall**: installs into `$DSH_HOME/skills/`, auto-discovered by skill-filesystem
- **In-app README preview**: Markdown rendered natively in the detail view, no external redirects
- **Star / download stats**: stars, downloads and installs shown on cards and in the detail view
- **Two entry points, pick one**: "Skill Center tab" (default, next to Skills / Import / Create) or "sidebar bottom-left" (beside Settings, opens the panel as an overlay). Switch under About → Entry position; takes effect immediately and is remembered
- **Chat-input picker**: a "⚡ Skills" button in the input bar for quick insertion of `/skill-name`; the ⓘ on each row shows description, source, author, downloads/stars and when-to-use on hover
- **Source failover**: falls back to ClawHub when SkillHub fails, and vice versa
- **The entry never disappears**: without the Skill Center, with changed tab-bar markup, or when the host no longer seeds `react-dom`, the plugin degrades to the bottom-left entry (last resort: a plain DOM sidebar row)

## Design principle: only adds, never rewrites the host

This plugin **never replaces, renames or hides official DSH UI**. It does exactly two things:

- **inserts** its own tab button and its own content container (`data-dsh-skillhub-tab` / `data-dsh-skillhub-pane`) into the Skill Center panel
- while that tab is selected, temporarily sets the neighbouring host content area to `display:none`; selecting any host tab restores it immediately (display only — no DOM structure is removed or rewritten)

Beyond that:

- It does not replace or hide the sidebar's official whale logo or the `deepseek harness` wordmark
- It does not modify the browser favicon, and does not rename or hide any host-provided entry, including the Skill Center itself
- It does not invent sidebar rows: the bottom-left form uses the official `sidebar.footer.action` slot, rendered beside Settings
- It does not use a MutationObserver to rename/replace host elements; the observer only re-inserts its own two nodes after a React re-render drops them
- Switching entries removes both injected nodes (and restores the hidden host content area), leaving no residue

## Screenshots

> These show the **bottom-left entry** overlay panel; in the default Skill Center tab form the same UI renders inside "Skill Center → Skill Market".

| Marketplace | Skill detail |
|---|---|
| <img src="docs/screenshots/market.png" width="360" /> | <img src="docs/screenshots/detail.png" width="360" /> |

Chat-input skill picker (the ⓘ on each row shows the detail card on hover):

<p align="center">
  <img src="docs/screenshots/picker.png" alt="Chat input skill picker" width="480" />
</p>

## Entry position (pick one)

The default is the "Skill Center tab". To switch: open the market → About → Entry position → pick the other option. It applies immediately and is stored in `localStorage["dsh-skill-hub:entry-mode"]` (`center` / `footer`).

| Form | Behaviour |
|---|---|
| "Skill Center tab" (`center`, default) | An extra "Skill Market" tab inside the Skill Center; while selected the market fills the content area, and switching to Skills / Import / Create restores the host content |
| "Sidebar bottom-left" (`footer`) | A "Skill Market" button in the official `sidebar.footer.action` slot (beside Settings) that opens the panel as an overlay; no tab in the Skill Center |

When switching from the tab to the bottom-left entry, the current page is handed over to the overlay first, so you never lose what you were looking at.

## Installation

```bash
dsh plugin --profile web add "github:pn1024/dsh-skill-market"
```

> Replace `--profile web` with your own profile name (usually `desktop` on the desktop app).

Or install from a local path:

```bash
dsh plugin --profile desktop add "/path/to/dsh-skill-market"
```

## Architecture

```
dsh-skill-market/
├── package.json           # dsh.bundle.patch + dsh.client declarations
├── cordis.patch.yml       # plugin registration + config
├── src/
│   ├── index.js           # Host side: RPC intercept (skill-hub/*)
│   └── client.js          # Browser side: Skill Center tab + overlay + footer entry + input bar
├── test/                  # Injection lifecycle / real React / footer start / degradation suites
├── docs/screenshots/      # UI screenshots
├── LICENSE
└── README.md
```

### Host-side RPC endpoints

| Endpoint | Description |
|----------|-------------|
| `skill-hub/search` | Search skills (SkillHub + ClawHub aggregated) |
| `skill-hub/detail` | Skill detail (README, version, stats) |
| `skill-hub/installed` | List locally installed skills |
| `skill-hub/install` | Download and install a skill locally |
| `skill-hub/uninstall` | Uninstall a local skill |
| `skill-hub/readme` | Read an installed skill's README/SKILL.md |

### Browser-side UI slots

| Slot | Description |
|------|-------------|
| `shell.overlay` | Always-mounted host: the bottom-left entry's overlay panel, and the React portal that renders the market UI into the Skill Center tab |
| `sidebar.footer.action` | "Sidebar bottom-left" entry (beside Settings; registered only in that form, or when the tab form is unavailable) |
| `conversation.input.left` | "⚡ Skills" quick picker in the chat input bar (with the ⓘ detail card) |
| Skill Center tab | Not a slot: injects a "Skill Market" button into `[data-dsh-skill-explorer-view]`'s `[data-dsh-part="tab-bar"]` plus its own container next to the content area |

Degradation order: Skill Center tab → bottom-left entry (Skill Center absent / markup changed / no `react-dom`) → plain DOM sidebar row (when even `sidebar.footer.action` cannot be claimed).

### Tests

```bash
npm install    # jsdom + react + react-dom (dev only)
npm test
```

`npm test` runs every `test/*.test.cjs`: tab injection lifecycle, real-React portal rendering, footer-start boot, and the two degradation paths (no `react-dom`; Skill Center page missing). If your `node_modules` are elsewhere, point `NODE_PATH` at them instead.

## Data sources

| Platform | API base | Notes |
|----------|----------|-------|
| SkillHub | `https://api.skillhub.tencent.com` | Tencent Cloud China mirror, fast direct connection, Chinese search |
| ClawHub | `https://clawhub.com` | Official OpenClaw skill community, globally available |

## Configuration

Configurable in `cordis.patch.yml`:

```yaml
- insert:
    - id: dsh-skill-market
      name: 'dsh-skill-market'
      config:
        skillhubApiBase: https://api.skillhub.tencent.com
        clawhubApiBase: https://clawhub.com
        localSkillsDir: ''        # empty = use $DSH_HOME/skills
        preferSkillHub: true       # prefer SkillHub for users in China
```

## Changelog

### 1.2.1

- Fix: hovering the picker's ⓘ scattered the detail card across the page and over the editor. The card was `position: fixed` inside the composer, whose transformed/clipped ancestors re-anchor such children. It is now portalled to `<body>` and positioned in viewport coordinates, and hides on scroll/resize
- The dropdown now fits the space actually available above the button (opening downwards when needed) instead of running off the top of the window

### 1.2.0

- **Two entry points, pick one**: About → Entry position switches between "Skill Center tab" and "sidebar bottom-left"; applies immediately and is persisted (`localStorage["dsh-skill-hub:entry-mode"]`)
- The bottom-left form now uses the official `sidebar.footer.action` slot, rendered beside Settings, and collapses into a round icon on the 56px rail
- **Hardening**: a host that no longer seeds `react-dom` degrades to the bottom-left entry instead of killing the plugin; if the plugin is the selected Skill Center panel but the page root marker disappears (host DOM changes), a bottom-left entry appears after a 2s grace period, so the market never becomes unreachable
- Switching entries hands the host content area back properly (`display` restored, selection marker restored) — no blank panel residue
- Each chat-input picker row gained an ⓘ: hover/focus shows a detail card (description, source, author, downloads, stars, when-to-use, directory); clicking ⓘ never selects the skill. Rows also show a one-line description and an "installed" badge
- Added `test/` and `npm test`: injection lifecycle, real React portal, footer start, degradation paths — 4 suites

### 1.1.0

- **Entry moved**: the sidebar "Skill Market" row is gone; the market now lives as a "Skill Market" tab inside the official Skill Center panel (next to Skills / Import / Create)
- Embedded layout for the tab: search box + a Browse / Installed / About segmented switcher + responsive card grid filling the panel
- Injected nodes are re-inserted after React re-renders, keeping the selected tab active
- Falls back to a sidebar entry + standalone panel when the Skill Center is missing, or when its tab bar cannot be found within 4s
- "Use" now returns to the conversation first, then seeds the composer with `/skill-name`

## License

MIT
