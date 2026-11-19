# dsh-skill-market

**简体中文** | [English](./README.en.md)

DeepSeek Harness 技能市场插件 —— 聚合 SkillHub + ClawHub 双数据源，站内 README 预览，一键安装/卸载，聊天栏技能选择器；入口常驻在「技能中心」里，是一个「技能市场」标签页。

<p align="center">
  <img src="docs/screenshots/market.png" alt="技能市场" width="720" />
</p>

## 功能

- **搜索技能**：聚合 SkillHub（腾讯云中国镜像，高速直连）和 ClawHub（OpenClaw 官方源）双数据源，支持中文搜索
- **一键安装/卸载**：安装到 `$DSH_HOME/skills/` 目录，skill-filesystem 自动热发现
- **站内 README 预览**：无需跳转外部页面，详情页原生渲染 Markdown
- **Star / 下载量展示**：卡片与详情页均展示 star、下载量、安装量统计
- **技能中心里的「技能市场」标签页**：入口不再占侧边栏，而是挂在官方「技能中心」面板里，与「技能」「导入」「创建」并列；点开技能中心即可搜索、安装、浏览
- **聊天栏快捷入口**：输入栏「⚡ 技能」按钮，快速选择已装技能，自动填入 `/技能名`
- **多源容错**：SkillHub 失败自动回退 ClawHub，反之亦然
- **无技能中心时自动回退**：未安装技能中心（或宿主标签栏结构变化）时，自动恢复侧边栏「技能市场」入口 + 独立面板，功能不缺

## 设计原则：只往宿主里加东西，不改宿主

本插件**不替换、不改名、不隐藏宿主的任何官方 UI**，只做两件事：

- 在技能中心面板内**插入**一个自己的标签按钮和一个自己的内容容器（`data-dsh-skillhub-tab` / `data-dsh-skillhub-pane`）
- 这个标签被选中时，临时把自己旁边的宿主内容区设为 `display:none`；切回任意宿主标签立刻还原（仅切换显示状态，不删除、不改结构）

除此之外：

- 不替换、不隐藏侧边栏官方鲸鱼 logo 与 `deepseek harness` 字标
- 不修改浏览器 favicon，不改名、不隐藏「技能中心」等任何官方入口
- 不使用 MutationObserver 对宿主元素做"改名/替换"式自愈；观察器只用于把自己被 React 重渲染丢掉的两个节点重新插回去

## 界面预览

> 下图是**回退形态**的独立面板（未安装技能中心时出现）；装好技能中心后，同样的内容会直接渲染在「技能中心 → 技能市场」标签页里。

| 技能市场 | 技能详情 |
|---|---|
| <img src="docs/screenshots/market.png" width="360" /> | <img src="docs/screenshots/detail.png" width="360" /> |

聊天输入栏技能选择器：

<p align="center">
  <img src="docs/screenshots/picker.png" alt="聊天栏技能选择器" width="480" />
</p>

## 安装

```bash
dsh plugin --profile web add "github:pn1024/dsh-skill-market"
```

> 把 `--profile web` 换成你自己的 profile 名（桌面端通常是 `desktop`）。

或本地路径安装：

```bash
dsh plugin --profile web add "/path/to/dsh-skill-market"
```

## 架构

```
dsh-skill-market/
├── package.json           # dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml       # 插件行注册 + 配置
├── src/
│   ├── index.js           # Host 端：RPC intercept (skill-hub/*)
│   └── client.js          # Browser 端：技能中心标签页 + overlay + 输入栏
├── docs/screenshots/      # 界面截图
├── LICENSE
└── README.md
```

### Host 端 RPC 端点

| 端点 | 功能 |
|------|------|
| `skill-hub/search` | 搜索技能（SkillHub + ClawHub 双源聚合） |
| `skill-hub/detail` | 获取技能详情（README、版本、统计） |
| `skill-hub/installed` | 列出本地已安装技能 |
| `skill-hub/install` | 下载并安装技能到本地 |
| `skill-hub/uninstall` | 卸载本地技能 |
| `skill-hub/readme` | 读取已安装技能的 README/SKILL.md |

### Browser 端 UI 插槽

| 插槽 | 功能 |
|------|------|
| `shell.overlay` | 常驻挂载点：回退面板，以及把技能市场 UI 用 React portal 渲染进技能中心标签页 |
| `conversation.input.left` | 聊天输入栏「⚡ 技能」快捷选择器 |
| 技能中心标签页 | 非插槽实现：在 `[data-dsh-skill-explorer-view]` 的标签栏 `[data-dsh-part="tab-bar"]` 插入「技能市场」按钮，并在内容区旁插入自己的容器（无技能中心时自动回退为侧边栏入口） |

## 数据源

| 平台 | API Base | 特点 |
|------|----------|------|
| SkillHub | `https://api.skillhub.tencent.com` | 腾讯云中国镜像，高速直连，支持中文搜索 |
| ClawHub | `https://clawhub.com` | OpenClaw 官方技能社区，全球可用 |

## 配置

在 `cordis.patch.yml` 中可配置：

```yaml
- insert:
    - id: dsh-skill-market
      name: 'dsh-skill-market'
      config:
        skillhubApiBase: https://api.skillhub.tencent.com
        clawhubApiBase: https://clawhub.com
        localSkillsDir: ''        # 空则用 $DSH_HOME/skills
        preferSkillHub: true       # 中国用户优先用 SkillHub
```

## 更新日志

### 1.1.0

- **入口搬家**：删掉侧边栏底部/侧栏的「技能市场」行，改为在官方「技能中心」面板里新增「技能市场」标签页（与「技能」「导入」「创建」并列），标题栏不再重复出现第二个「技能中心」
- 标签页内的技能市场改用嵌入式布局：搜索框 + 「浏览 / 已安装 / 关于」分段切换 + 自适应卡片栅格，撑满技能中心内容区
- React 重渲染丢掉注入节点时自动补插，并保留当前标签的选中态
- 未安装技能中心、或技能中心标签栏结构变化 4 秒内仍匹配不上时，自动回退为侧边栏入口 + 独立面板
- 「使用」技能现在会先切回对话页，再往输入框填入 `/技能名`

## License

MIT
