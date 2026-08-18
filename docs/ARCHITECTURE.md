# 架构与 pi→DSH 映射

本文档记录 pi-hermes-memory 能力在 DSH（Cordis）中的实现位置与映射关系，基于对上游源码 `src/`（约 1.55 万行 TS）与 DSH Host 服务的对照。

## 总体结构

```
┌────────────────────────────────────────────────────────────┐
│ DSH Host 进程（Cordis）                                      │
│                                                            │
│  src/host-plugin.js (apply)                                 │
│   ├─ MemoryStore（内存闭包 + fs 落盘）                       │
│   │    MEMORY / USER / FAILURES / PROJECT.md                │
│   ├─ content-scanner（31 条正则 + 不可见 Unicode）            │
│   ├─ harness.defineTool/registerTool → 5 个动态工具          │
│   ├─ commands.register → /memory-insights /memory-pin       │
│   ├─ systemPrompt.section → policy + standing               │
│   └─ agents/sessionQuery/fs/sandboxPolicy 服务消费           │
└────────────────────────────────────────────────────────────┘
         │ 记忆：跟随会话工作区 {cwd}/.hermes-memory/*.md
         └ 检索：session_query（部署启用时为 DSH 索引）
```

## 能力映射表

| pi-hermes-memory | DSH 移植版 | 说明 |
|---|---|---|
| `~/.pi/agent/pi-hermes-memory/MEMORY.md` 等 | `{cwd}/.hermes-memory/{MEMORY,USER,FAILURES,PROJECT}.md` | 同构 Markdown、`§` 分隔、5000 字符上限、老化元数据 |
| `memory tool`（add/replace/remove） | `memory_add`/`memory_replace`/`memory_remove` | Pi 的 #151 已改为 schema-safe 分动作，移植保持同一设计 |
| `memory_search`（SQLite FTS5 镜像） | `memory_search`（现读现扫 Markdown） | 首版用子串/分词 AND 匹配，未引入 SQLite 依赖 |
| `session_search`（FTS5 索引自己建） | `session_search`（复用 DSH `sessionQuery`） | **按用户选择复用 DSH**，不重复建索引；依赖部署开启会话索引 |
| `content-scanner.ts` | `scanContent()` | 正则原样移植（威胁 11 + 密钥 20 + 不可见 Unicode） |
| `STANDING.md` + `/memory-pin` | `STANDING.md` + `/memory-pin` | 20 条 / 2000 字符上限、注入块沿用 |
| `before_agent_start` 系统提示注入 | `systemPrompt.section` | policy order 45 / standing order 46 |
| `pi.registerCommand` | `commands.register` | `/memory-insights` 同构 |
| `session_start` / `session_shutdown` 事件 | 无（下次迭代） | 背景学习、纠错检测等属后续范围 |
| `auto-consolidation` / `correction-detector` / `skill` | 未移植 | 本期核心闭环之外 |

## 关键实现决策

1. **remember 跟工作区、STANDING 跟部署**：记忆目录取 `agent.session.header.cwd`（每工作区独立记忆）；曾误用 `sandboxPolicy.workspaceRoot`，其在 WSL 部署解析为 Windows 侧路径 `/mnt/c/Users/...`，与真实工作区不符。
2. **sandbox 边界以会话 cwd 为准**：`fs.writeText` 的默认写入边界是部署 workspaceRoot；本插件每次写入显式传 `sandboxPolicy.resolve({ session })`（session 的不可变 cwd 即边界），否则越界被拒。
3. **lossless-JSON 终端清洗**：`harness.defineTool` 的 guard 拒绝 execute 返回值中的 `undefined` 字段（如可选 `category`）。统一在注册层 `sanitizeJson`（undefined→null）兜底。
4. **每次调用现读现写**：单文件 ≤ 数千字符，读/写盘开销可忽略；避免内存缓存与外部编辑的竞态（对齐上游"disk is source of truth"）。
5. **启动自检**：`agents.currentInitiator()` 取真实会话 cwd 后执行一次真实落盘增删查演练并清理，输出报告。

## 依赖的 DSH Host 服务

| Service | 用途 |
|---|---|
| `fs` | 记忆文件读写（resolve/stat/readText/writeText） |
| `sandboxPolicy` | 以会话 cwd 为边界的写入策略 |
| `agents` | 启动自检取 `currentInitiator` 及其 `session.header.cwd` |
| `commands` | 斜杠命令注册 |
| `systemPrompt` | 系统提示 section 注入 |
| `sessionQuery` | `session_search` 检索源（部署启用时） |
| `harness`（Builtin） | 动态工具定义与注册 |
