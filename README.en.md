# dsh-skill-market

[简体中文](./README.md) | **English**

A skill marketplace plugin for DeepSeek Harness — aggregated search across SkillHub + ClawHub, in-app README preview, one-click install/uninstall, a chat-input skill picker, and a "Skill Market" tab inside the Skill Center.

<p align="center">
  <img src="docs/screenshots/market.png" alt="Skill marketplace" width="720" />
</p>

## Features

- **Skill search**: aggregated results from SkillHub (Tencent Cloud China mirror, fast direct connection) and ClawHub (the official OpenClaw source); supports Chinese queries
- **One-click install/uninstall**: installs into `$DSH_HOME/skills/`, auto-discovered by skill-filesystem
- **In-app README preview**: Markdown rendered natively in the detail view, no external redirects
- **Star / download stats**: stars, downloads and installs shown on cards and in the detail view
- **"Skill Market" tab inside the Skill Center**: no sidebar footprint any more — the entry lives in the official Skill Center panel next to Skills / Import / Create
- **Chat-input picker**: a "⚡ Skills" button in the input bar for quick insertion of `/skill-name`
- **Source failover**: falls back to ClawHub when SkillHub fails, and vice versa
- **Automatic fallback**: without the Skill Center (or if its tab bar markup changes) the plugin restores a sidebar entry plus the standalone panel, so nothing is lost

## Design principle: only adds, never rewrites the host

This plugin **never replaces, renames or hides official DSH UI**. It does exactly two things:

- **inserts** its own tab button and its own content container (`data-dsh-skillhub-tab` / `data-dsh-skillhub-pane`) into the Skill Center panel
- while that tab is selected, temporarily sets the neighbouring host content area to `display:none`; selecting any host tab restores it immediately (display only — no DOM structure is removed or rewritten)

Beyond that:

- It does not replace or hide the sidebar's official whale logo or the `deepseek harness` wordmark
- It does not modify the browser favicon, and does not rename or hide any host-provided entry, including the Skill Center itself
- It does not use a MutationObserver to rename/replace host elements; the observer only re-inserts its own two nodes after a React re-render drops them

## Screenshots

> These show the **fallback** standalone panel (used only when the Skill Center is absent). With the Skill Center installed, the same UI renders inside its "Skill Market" tab.

| Marketplace | Skill detail |
|---|---|
| <img src="docs/screenshots/market.png" width="360" /> | <img src="docs/screenshots/detail.png" width="360" /> |

Chat-input skill picker:

<p align="center">
  <img src="docs/screenshots/picker.png" alt="Chat input skill picker" width="480" />
</p>

## Installation

```bash
dsh plugin --profile web add "github:pn1024/dsh-skill-market"
```

> Replace `--profile web` with your own profile name (usually `desktop` on the desktop app).

Or install from a local path:

```bash
dsh plugin --profile web add "/path/to/dsh-skill-market"
```

## Architecture

```
dsh-skill-market/
├── package.json           # dsh.bundle.patch + dsh.client declarations
├── cordis.patch.yml       # plugin registration + config
├── src/
│   ├── index.js           # Host side: RPC intercept (skill-hub/*)
│   └── client.js          # Browser side: Skill Center tab + overlay + input bar
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
| `shell.overlay` | Always-mounted host: the fallback panel, and the React portal that renders the market UI into the Skill Center tab |
| `conversation.input.left` | "⚡ Skills" quick picker in the chat input bar |
| Skill Center tab | Not a slot: injects a "Skill Market" button into `[data-dsh-skill-explorer-view]`'s `[data-dsh-part="tab-bar"]` plus its own container next to the content area (falls back to a sidebar entry when the Skill Center is absent) |

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

### 1.1.0

- **Entry moved**: the sidebar "Skill Market" row is gone; the market now lives as a "Skill Market" tab inside the official Skill Center panel (next to Skills / Import / Create)
- Embedded layout for the tab: search box + a Browse / Installed / About segmented switcher + responsive card grid filling the panel
- Injected nodes are re-inserted after React re-renders, keeping the selected tab active
- Falls back to a sidebar entry + standalone panel when the Skill Center is missing, or when its tab bar cannot be found within 4s
- "Use" now returns to the conversation first, then seeds the composer with `/skill-name`

## License

MIT
