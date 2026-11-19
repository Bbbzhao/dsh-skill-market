# dsh-skill-market

**简体中文** | [English](./README.en.md)

DeepSeek Harness 技能市场插件 —— 聚合 SkillHub + ClawHub 双数据源，站内 README 预览，一键安装/卸载，聊天栏技能选择器（右侧 ⓘ 悬停看详情）；入口二选一：默认挂在「技能中心」里作为一个「技能市场」标签页，也可以切回侧边栏左下角。

<p align="center">
  <img src="docs/screenshots/market.png" alt="技能市场" width="720" />
</p>

## 功能

- **搜索技能**：聚合 SkillHub（腾讯云中国镜像，高速直连）和 ClawHub（OpenClaw 官方源）双数据源，支持中文搜索
- **一键安装/卸载**：安装到 `$DSH_HOME/skills/` 目录，skill-filesystem 自动热发现
- **站内 README 预览**：无需跳转外部页面，详情页原生渲染 Markdown
- **Star / 下载量展示**：卡片与详情页均展示 star、下载量、安装量统计
- **入口二选一**：「技能中心标签页」（默认，与「技能」「导入」「创建」并列）或「侧边栏左下角」（设置按钮旁，点击弹出面板）；在「关于 → 入口位置」里切换，立即生效并记住本机选择
- **聊天栏快捷入口**：输入栏「⚡ 技能」按钮，快速选择已装技能，自动填入 `/技能名`；每行右侧有 ⓘ，鼠标悬停即显示该技能的简介、来源、作者、下载/收藏、适用场景
- **多源容错**：SkillHub 失败自动回退 ClawHub，反之亦然
- **入口永不丢失**：没装技能中心、标签栏结构变了、甚至宿主不再提供 `react-dom` 时，都会自动退到左下角入口（最后一层是纯 DOM 侧边栏行），功能不缺

## 设计原则：只往宿主里加东西，不改宿主

本插件**不替换、不改名、不隐藏宿主的任何官方 UI**，只做两件事：

- 在技能中心面板内**插入**一个自己的标签按钮和一个自己的内容容器（`data-dsh-skillhub-tab` / `data-dsh-skillhub-pane`）
- 这个标签被选中时，临时把自己旁边的宿主内容区设为 `display:none`；切回任意宿主标签立刻还原（仅切换显示状态，不删除、不改结构）

除此之外：

- 不替换、不隐藏侧边栏官方鲸鱼 logo 与 `deepseek harness` 字标
- 不修改浏览器 favicon，不改名、不隐藏「技能中心」等任何官方入口
- 不往侧边栏塞自造的行：左下角形态用的是官方 `sidebar.footer.action` 插槽，和「设置」并排渲染
- 不使用 MutationObserver 对宿主元素做"改名/替换"式自愈；观察器只用于把自己被 React 重渲染丢掉的两个节点重新插回去
- 切换入口时把插进去的两个节点收干净（并还原被隐藏的宿主内容区），不留残迹

## 界面预览

> 下图是**左下角入口**（`sidebar.footer.action`）弹出的独立面板；默认的「技能中心标签页」形态下，同样的内容会直接渲染在「技能中心 → 技能市场」里。

| 技能市场 | 技能详情 |
|---|---|
| <img src="docs/screenshots/market.png" width="360" /> | <img src="docs/screenshots/detail.png" width="360" /> |

聊天输入栏技能选择器（每行右侧 ⓘ，悬停看详情）：

<p align="center">
  <img src="docs/screenshots/picker.png" alt="聊天栏技能选择器" width="480" />
</p>

## 入口位置（二选一）

默认是「技能中心标签页」。切换方式：打开技能市场 →「关于」→「入口位置」→ 点另一个选项，立即生效，并记在 `localStorage["dsh-skill-hub:entry-mode"]`（`center` / `footer`）。

| 形态 | 表现 |
|---|---|
| 「技能中心标签页」（`center`，默认） | 技能中心面板里多一个「技能市场」标签；选中时市场内容占满内容区，切到「技能 / 导入 / 创建」自动还原宿主内容 |
| 「侧边栏左下角」（`footer`） | 官方 `sidebar.footer.action` 插槽（与「设置」并排）渲染一个「技能市场」按钮，点击以浮层打开面板；技能中心里不再有标签 |

从标签页切到左下角时，当前页面会先转交给浮层再切换，不会中途丢掉你正在看的技能。

## 安装

```bash
dsh plugin --profile desktop add "github:pn1024/dsh-skill-market"
```

> 把 `desktop` 换成你自己的 profile 名（`dsh plugin list` 可查；Web 端常见的是 `web`，桌面端是 `desktop`）。

或本地路径安装：

```bash
dsh plugin --profile desktop add "/path/to/dsh-skill-market"
```

## 架构

```
dsh-skill-market/
├── package.json           # dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml       # 插件行注册 + 配置
├── src/
│   ├── index.js           # Host 端：RPC intercept (skill-hub/*)
│   └── client.js          # Browser 端：技能中心标签页 / 左下角入口 + 浮层 + 输入栏
├── test/                  # jsdom 测试（注入生命周期、真实 React portal、降级路径）
├── docs/screenshots/      # 界面截图
├── LICENSE
└── README.md
```

### 测试

```bash
npm install        # 安装 jsdom / react / react-dom
npm test           # 逐个跑 test/*.test.cjs
```

已经全局装过这些依赖时，可以不动 `node_modules`：

```bash
NODE_PATH=/path/to/node_modules npm test
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
| `shell.overlay` | 常驻挂载点：左下角入口的浮层面板，以及把技能市场 UI 用 React portal 渲染进技能中心标签页 |
| `sidebar.footer.action` | 「侧边栏左下角」入口（与「设置」并排；仅在选了该形态、或标签页形态不可用时注册） |
| `conversation.input.left` | 聊天输入栏「⚡ 技能」快捷选择器（含 ⓘ 详情卡） |
| 技能中心标签页 | 非插槽实现：在 `[data-dsh-skill-explorer-view]` 的标签栏 `[data-dsh-part="tab-bar"]` 插入「技能市场」按钮，并在内容区旁插入自己的容器 |

降级顺序：技能中心标签页 → 左下角入口（没装技能中心 / 页面结构变了 / 没有 `react-dom`）→ 纯 DOM 侧边栏行（连 `sidebar.footer.action` 也拿不到时）。

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

### 1.2.1

- 修复：鼠标移到技能选择器的 ⓘ 上时，详情卡会跑到页面别处、盖住编辑器、甚至顶出窗口。原因是详情卡以 `position: fixed` 渲染在输入框内部，而输入框外层带有 `transform` / 裁切，`fixed` 被就地重锚定。现在详情卡改为 portal 挂到 `<body>` 下按视口坐标定位，并随滚动 / 窗口尺寸变化自动收起
- 选择器下拉按"按钮上方实际可用高度"自适应，不够时改为向下弹出，不再顶出窗口顶部

### 1.2.0

- **入口二选一**：「关于 → 入口位置」新增切换项，可选「技能中心标签页」或「侧边栏左下角」，立即生效并持久化（`localStorage["dsh-skill-hub:entry-mode"]`）
- 左下角形态改用官方 `sidebar.footer.action` 插槽，与「设置」并排渲染；收起侧栏时自动变圆形图标
- **加固**：宿主不再提供 `react-dom` 时不再让整个插件失效，改为左下角入口；技能中心面板被选中但页面根标记消失（插件改了 DOM 结构）时，2 秒宽限后自动补一个左下角入口，市场不会变成"进不去"
- 切换入口时正确归还宿主内容区（`display` 还原 + 选中标记恢复），不再留下空白面板
- 聊天栏技能选择器每行右侧新增 ⓘ：悬停/聚焦显示该技能详情卡（简介、来源、作者、下载、收藏、适用场景、目录），点击 ⓘ 不会误选技能；行内同时显示一行简介与「已安装」标记
- 新增 `test/` 与 `npm test`：注入生命周期、真实 React portal、左下角启动、降级路径共 4 个套件

### 1.1.0

- **入口搬家**：删掉侧边栏底部/侧栏的「技能市场」行，改为在官方「技能中心」面板里新增「技能市场」标签页（与「技能」「导入」「创建」并列），标题栏不再重复出现第二个「技能中心」
- 标签页内的技能市场改用嵌入式布局：搜索框 + 「浏览 / 已安装 / 关于」分段切换 + 自适应卡片栅格，撑满技能中心内容区
- React 重渲染丢掉注入节点时自动补插，并保留当前标签的选中态
- 未安装技能中心、或技能中心标签栏结构变化 4 秒内仍匹配不上时，自动回退为侧边栏入口 + 独立面板
- 「使用」技能现在会先切回对话页，再往输入框填入 `/技能名`

## License

MIT
