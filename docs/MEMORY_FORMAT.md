# 记忆文件格式

记忆是**人类可读的 Markdown**，可通过任何文本编辑器直接维护；插件解析时按条目块拆分。

## 布局

文件（`MEMORY.md` / `USER.md` / `FAILURES.md` / `PROJECT.md`）由若干**条目块**组成，块之间用 `§` 分隔符（前后各一空行）：

```
<!-- created:2026-08-18T10:50:30Z last:2026-08-18T10:50:30Z -->
第一条记忆内容，例如：“项目使用 pnpm 而非 npm”

§

<!-- created:2026-08-18T11:00:00Z last:2026-08-19T09:00:00Z category:preference -->
第二条记忆内容
```

## 条目块结构

每条目块 = 元数据注释行 + 正文：

```
<!-- created:<ISO 时间> last:<ISO 时间> category:<可选> -->
正文文本
```

### 元数据字段

| 字段 | 必选 | 说明 |
|---|---|---|
| `created` | 是 | 条目创建时间（ISO 8601） |
| `last` | 是 | 最近一次更新/引用时间；首次创建时等于 `created` |
| `category` | 否 | 类别标签，当前用于 failure 目标：`failure` \| `correction` \| `insight` \| `preference` \| `convention` \| `tool-quirk` |

元数据以 HTML 注释形式存储，因此：
- 显示/检索时正文纯净；
- 直接编辑文件不会破坏可读性；
- 向后兼容：无注释头的旧条目（如 Hermes 迁移数据）解析为 `created='' last=''`，原样保留。

## 容量与追加

- 每个目标独立上限：`memory`/`user`/`failure`/`project` 各 **5000 字符**（正文长度合计）。
- 去重：完全一致的正文不重复追加。
- 超限：`memory_add` 返回明确错误（含当前用量），不静默丢弃；第一版未实现自动整合（上游的「写满自动合并」不在本期范围），可手动整理或后续接入。

## 数据位置

记忆随**会话工作区**落盘：

```
{会话工作区}/.hermes-memory/{MEMORY,USER,FAILURES,PROJECT}.md
```

同一工作区的所有会话共享这份记忆；切换工作区即切换记忆空间。

## 兼容上游

沿用 pi-hermes-memory 与 Hermes 的 `§` 分隔与 `MEMORY.md`/`USER.md` 结构，因此从 Hermes / pi 迁移的历史 Markdown 可直接放入对应文件并被解析（新增注释元数据即可享受老化跟踪）。
