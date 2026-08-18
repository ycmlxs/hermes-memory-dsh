// Hermes Memory — DSH Web Client bundle
// =======================================
// 由 clientModules 扫描包声明（package.json 的 dsh.client + exports["./client"]）加载到
// 浏览器 __ModuleLoader__，注册「设置」侧栏的一页 settings.section。
// 数据桥：GET  /plugins/hermes-memory-dsh/status   ← 读取状态+配置
//          POST /plugins/hermes-memory-dsh/config  ← 修改配置（持久化到 host）
window.__ModuleLoader__.load({
	id: "hermes-memory-dsh",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		const React = require("react");

		const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 2px", borderBottom: "1px solid rgba(128,128,128,.18)" };
		const labelStyle = { fontSize: 13, lineHeight: 1.4 };
		const hintStyle = { fontSize: 11, opacity: .62, marginTop: 2 };

		function HermesMemorySection() {
			const [state, setState] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const refresh = React.useCallback(() => {
				fetch("/plugins/hermes-memory-dsh/status")
					.then((r) => r.json())
					.then(setState)
					.catch(() => setState({ error: "无法连接 Hermes Memory 状态接口" }));
			}, []);
			React.useEffect(() => { refresh(); }, [refresh]);

			if (!state) {
				return React.createElement("div", { style: { padding: 16, fontSize: 13, opacity: .7 } }, "Hermes Memory 状态加载中…");
			}
			if (state.error) {
				return React.createElement("div", { style: { padding: 16, fontSize: 13, color: "#f2a1a1" } }, String(state.error));
			}

			const config = state.config || {};
			const targets = state.targets || {};
			const toggles = [
				{ key: "autoEvict", title: "写满自动整合", hint: "memory_add 超出容量时自动逐出最旧条目（而非报错）" },
				{ key: "correctionDetect", title: "纠错检测", hint: "侦测用户纠正，自动保存为 failure/correction 记忆" },
				{ key: "standingEnabled", title: "STANDING 常驻注入", hint: "每次会话在系统提示中注入 STANDING.md（由 /memory-pin 管理）" },
			];
			const setToggle = (key, value) => {
				setBusy(true);
				fetch("/plugins/hermes-memory-dsh/config", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ [key]: value }),
				})
					.then((r) => r.json())
					.then((next) => setState((s) => (s ? Object.assign({}, s, { config: next }) : s)))
					.catch(() => {})
					.finally(() => setBusy(false));
			};

			const toggleRows = toggles.map((t) =>
				React.createElement("div", { key: t.key, style: rowStyle },
					React.createElement("div", null,
						React.createElement("div", { style: labelStyle }, t.title),
						React.createElement("div", { style: hintStyle }, t.hint)),
					React.createElement("input", {
						type: "checkbox",
						disabled: busy,
						checked: config[t.key] !== false,
						onChange: (e) => setToggle(t.key, e.target.checked),
					})));

			const targetRows = Object.keys(targets).map((t) => {
				const v = targets[t];
				return React.createElement("div", { key: t, style: rowStyle },
					React.createElement("span", { style: labelStyle }, t),
					React.createElement("span", { style: { fontSize: 12, opacity: .75 } },
						String(v.entries) + " 条 · " + String(v.chars) + "/" + String(v.limit) + " 字符"));
			});

			return React.createElement("div", { style: { padding: "4px 16px 16px" } },
				React.createElement("div", { style: { fontSize: 12, opacity: .65, padding: "8px 0 12px", wordBreak: "break-all" } },
					"记忆目录：", String(state.memoryRoot || "")),
				React.createElement("div", { style: { fontSize: 14, fontWeight: 600, padding: "14px 0 4px" } }, "功能开关"),
				React.createElement("div", null, toggleRows),
				React.createElement("div", { style: { fontSize: 14, fontWeight: 600, padding: "14px 0 4px" } }, "记忆用量（部署记忆根）"),
				React.createElement("div", null, targetRows));
		}

		const inject = ["slots", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "hermes-memory",
				order: 30,
				label: () => "Hermes Memory",
			}, () => React.createElement(HermesMemorySection))), "hermes-memory:settings.section");
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
