# 🧠 Hermes Memory — DSH (Cordis) 移植版

把 [pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory) 的**核心记忆闭环**移植到 [DeepSeek Harness (DSH)](https://github.com/ycmlxs/DSH) 的 Cordis 插件框架。DSH 与上游 Pi 在架构上不兼容（上游依赖 `@earendil-works/pi-coding-agent` 的 `ExtensionAPI`），此仓库提供一套可在 DSH 中运行的等价实现，并**复用 DSH 现有能力**（会话检索 `sessionQuery`、`fs`、`systemPrompt`、`commands`），避免重复造轮子。

- **持久记忆** — `memory/user/failure/project` 多目标，`§` 分隔 + 老化元数据，落盘为可读 Markdown
- **schema-safe 工具** — `memory_add` / `memory_replace` / `memory_remove` / `memory_search`
- **安全扫描** — 密钥、注入、不可见 Unicode 写入拦截（`content-scanner`）
- **自动整合** — 写满时自动按老化逐出最旧条目，绝不静默丢新增
- **纠错检测** — 监听会话事件，把用户纠正自动保存为 failure/correction
- **常驻指令** — `STANDING.md` 每次会话注入 + `/memory-pin` 管理 + `/memory-preview` 预览
- **策略注入** — `policy-only` 系统提示（省 token）
- **会话检索** — `session_search` 复用 DSH `sessionQuery`（部署已配置 `first-search` 索引，重启后可用）

## 文件结构

```
hermes-memory-dsh/
├── src/
│   └── host-plugin.js        # Cordis 插件 Host 半数（唯一源码文件）
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

## 验证状态

启动自检会真实执行一次「写入 → 检索 → 删除 → 复原」演练并输出报告：

- 密钥样本被 content-scanner 阻断 ✅
- 条目编解码 round-trip ✅
- 增删查全部通过、无残留 ✅
- `session_search` 集成探针（结果取决于部署是否启用会话索引）

## 已知限制

- **`session_search` 需要重启使会话索引生效**：已在部署 `cordis.patch.yml` 将 `session-query-sqlite` 改为 `openAt: first-search` + 持久磁盘路径；**重启 DSH 后**可用。未重启前工具仍报索引禁用。
- **动态插件为 process-local**：进程重启后需重新激活；数据文件持久保留。本仓库同时提供**固化路径**（见下）。
- 背景学习环路等上游能力仍不在本期范围。

## 固化长期可用（DSH 常驻插件）

仓库同步维护一份可直接作为常驻插件的源码；部署步骤：

1. 把 `src/host-plugin.js` 顶层 `return {` 改为 `export default {` 生成 ESM `index.js`（本部署已生成于 `~/.dsh/plugins/hermes-memory-dsh/index.js`）。
2. 在 profile 的 `cordis.patch.yml` 追加：
   ```yaml
   - insert:
       - id: hermes-memory
         name: '/home/ycqmlxs/.dsh/plugins/hermes-memory-dsh/index.js'
   ```
3. 重启 DSH 后插件每个会话自动加载（当前部署已按此配置）。

## 技术要点（移植踩坑）

1. `sandboxPolicy.workspaceRoot` 可能与会话工作区不同（WSL 下可能是 Windows 侧路径）——记忆目录须取 `agent.session.header.cwd`。
2. `fs.writeText` 受 sandbox 约束：以部署 workspaceRoot 为默认写入边界；本插件每次写入以会话 cwd 为边界 `sandboxPolicy.resolve({ session })` 传入。
3. `harness.defineTool` 的 execute 返回值必须是 **lossless JSON**（`undefined` 字段会被拒绝）——统一做 `undefined → null` 清洗。

## 许可证

MIT。移植自 [chandra447/pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory)（MIT），源头为 [NousResearch/Hermes-Agent](https://github.com/nousresearch/hermes-agent)。
