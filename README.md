# 🧠 Hermes Memory — DSH (Cordis) 移植版

把 [pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory) 的**核心记忆闭环**移植到 [DeepSeek Harness (DSH)](https://github.com/ycmlxs/DSH) 的 Cordis 插件框架。DSH 与上游 Pi 在架构上不兼容（上游依赖 `@earendil-works/pi-coding-agent` 的 `ExtensionAPI`），此仓库提供一套可在 DSH 中运行的等价实现，并**复用 DSH 现有能力**（会话检索 `sessionQuery`、`fs`、`systemPrompt`、`commands`），避免重复造轮子。

- **持久记忆** — `memory/user/failure/project` 多目标，`§` 分隔 + 老化元数据，落盘为可读 Markdown
- **schema-safe 工具** — `memory_add` / `memory_replace` / `memory_remove` / `memory_search`
- **安全扫描** — 密钥、注入、不可见 Unicode 写入拦截（`content-scanner`）
- **自动整合** — 写满时自动按老化逐出最旧条目，绝不静默丢新增
- **纠错检测** — 监听会话事件，把用户纠正自动保存为 failure/correction
- **常驻指令** — `STANDING.md` 每次会话注入 + `/memory-pin` 管理 + `/memory-preview` 预览
- **策略注入** — `policy-only` 系统提示（省 token）
- **会话检索** — `session_search` 复用 DSH `sessionQuery`（部署已配置 `first-search` 索引）
- **Web 设置栏页面** — DSH 设置侧栏自带 “Hermes Memory” 页：看记忆用量、切三个功能开关（持久化到 `config.json`）

## 文件结构

```
hermes-memory-dsh/
├── src/
│   └── host-plugin.js        # Cordis 插件 Host 半数（唯一源码，动态/常驻共用）
├── deploy/
│   └── hermes-memory-dsh/    # 可直接部署的具名包（host 半数 + Web 设置页 client）
│       ├── package.json      # exports "./client" + dsh.client 声明
│       └── lib/
│           ├── index.js      # Host 半数（ESM）
│           └── client.js     # settings.section 设置页 bundle
├── docs/
│   ├── ARCHITECTURE.md      # 架构与 pi→DSH 映射
│   └── MEMORY_FORMAT.md     # 记忆文件格式与老化元数据
├── README.md
└── LICENSE                  # MIT
```

## 快速开始（DSH 动态插件）

在 DSH 会话中把 [`src/host-plugin.js`](src/host-plugin.js) 作为动态插件（Cordis `apply` 函数体）注册并运行：

1. `cordis_define`（plugin kind `new`，host code = 本文件内容）
2. `cordis_run`（mode `run`）

激活后自动获得：

| 类型 | 名称 | 说明 |
|---|---|---|
| 工具 | `memory_add` | 新增条目（target: memory/user/failure/project；failure 可带 category） |
| 工具 | `memory_replace` / `memory_remove` | 用 `old_text` 子串定位更新/删除 |
| 工具 | `memory_search` | 关键词（多词 AND）/类别过滤检索 |
| 工具 | `session_search` | 复用 DSH 会话索引全文检索 |
| 命令 | `/memory-insights` | 各目标条目数与容量 |
| 命令 | `/memory-preview` | 预览注入的 memory-policy 与 STANDING 块 |
| 命令 | `/memory-pin <规则>` | 常驻指令管理（`list` / `remove <n>` / `clear`） |
| 提示 | `<hermes-memory-policy>` | 引导模型何时调用记忆工具 |
| 提示 | `<hermes-standing-instructions>` | STANDING.md 常驻注入 |

## 数据位置

记忆跟随**会话工作区**（`agent.session.header.cwd`）落盘：

```
{会话工作区}/.hermes-memory/
├── MEMORY.md    # agent 笔记（5000 字符上限）
├── USER.md      # 用户画像（5000）
├── FAILURES.md  # 失败经验/教训（5000）
├── PROJECT.md   # 项目事实（5000）
└── STANDING.md  # 常驻指令（20 条 / 2000 字符）
```

## 能力与验证

- content-scanner：密钥/注入/不可见 Unicode 写入拦截 ✅
- 条目编解码（`§` 分隔 + created/last 老化元数据）round-trip ✅
- 写满自动整合（按 created 最旧逐出，可关闭）✅
- 纠错检测（`session/event` → failure/correction，可关闭）✅
- STANDING 写入 → 读回 → 注入块结构 ✅
- `session_search`：依赖部署启用 `first-search` 索引 ✅（当前部署已启用）
- `memory_add/replace/remove/search` 实弹读写 ✅

> 注：早期“启动自检”已移除，启动时改为静默加载 STANDING 缓存，避免启动日志噪音。

## 已知限制

- **`session_search` 依赖部署启用会话索引**：部署 `cordis.patch.yml` 已将 `session-query-sqlite` 覆盖为 `openAt: first-search` + 持久磁盘路径（索引在首次检索时打开）。
- **动态插件（Host 半数）为 process-local**：进程重启后需重新激活；数据与配置文件持久保留。设置栏页面仅存在于常驻（具名包）部署方式。
- 背景学习环路等上游能力仍不在本期范围。

## 固化长期可用（DSH 常驻插件 + Web 设置栏页面）

仓库 `deploy/hermes-memory-dsh/` 提供可直接部署的**具名包**（`dsh.client` 声明 → 设置栏页面，host 半数 → 工具/命令/API）：

1. 把 `deploy/hermes-memory-dsh/` 放到 profile 的 `node_modules/`：
   ```
   ~/.dsh/profiles/web/node_modules/hermes-memory-dsh/{package.json, lib/…}
   ```
2. 在 profile 的 `cordis.patch.yml` 用**具名包名**挂载（host entry 名须与包名一致，clientModules 才会装饰其 Web 设置页）：
   ```yaml
   - insert:
       - id: hermes-memory
         name: 'hermes-memory-dsh'
   ```
3. 重启 DSH（Web profile）：
   - 记忆工具/命令每会话自动加载
   - 设置侧栏出现 **Hermes Memory** 页（记忆用量 + 功能开关）
   - `session_search` 可用

> 动态插件方式（`cordis_define`/`cordis_run`，仅 Host 半数、无设置页）仍可用：用 `src/host-plugin.js` 原文注册；它同样读取 `config.json` 的开关门控。

### 配置（config.json）

位于 `{部署 workspaceRoot}/.hermes-memory/config.json`，host 插件启动读取、设置页切换可改：

```json
{ "autoEvict": true, "correctionDetect": true, "standingEnabled": true }
```

| 字段 | 作用 |
|---|---|
| `autoEvict` | `memory_add` 写满时自动逐出最旧条目（false 则报容量错误） |
| `correctionDetect` | 侦测用户纠正并自动保存为 failure/correction（false 则关闭） |
| `standingEnabled` | 是否把 STANDING.md 注入每次会话（false 则不解入） |

## 技术要点（移植踩坑）

1. `sandboxPolicy.workspaceRoot` 可能与会话工作区不同（WSL 下可能是 Windows 侧路径）——记忆目录须取 `agent.session.header.cwd`。
2. `fs.writeText` 受 sandbox 约束：以部署 workspaceRoot 为默认写入边界；本插件每次写入以会话 cwd 为边界 `sandboxPolicy.resolve({ session })` 传入。
3. 动态工具返回值必须是 **lossless JSON**（`undefined` 字段被拒）——统一做 `undefined → null` 清洗。
4. 常驻插件**没有 `harness` 内置对象**：工具注册改用标准 `ctx.get('tools').register(手写 ToolDefinition)`，并在插件 `inject` 声明 `fs/sandboxPolicy/agents/commands/systemPrompt/sessionQuery/tools/webServer` 等硬依赖（否则 root 层 apply 早于服务就绪）。`settings.section` 设置页由 package.json 的 `dsh.client` + `exports["./client"]` 声明、经 clientModules 扫入。
5. GitHub Contents API 创建新文件用 **PUT**（不带 `sha`），不是 POST。curl 无法连 `github.com:443` 时可用 contents API 走 `api.github.com` 上传。

## 许可证

MIT。移植自 [chandra447/pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory)（MIT），源头为 [NousResearch/Hermes-Agent](https://github.com/nousresearch/hermes-agent)。
