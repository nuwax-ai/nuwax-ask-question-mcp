# MCP Ask / Question 开发计划

| 项 | 内容 |
| --- | --- |
| 日期 | 2026-05-29 |
| 目标 | 将 `nuwax-ask-question-mcp` 的 v1 契约、文档和测试稳定下来，并给 Web/Mobile/Bridge 落地提供明确验收边界 |
| 当前决策 | v1 canonical 继续使用 `nuwaclaw.mcp_ask.v1` / `nuwaclaw.interaction.v1`；接受 `nuwax.*` 命名空间作为迁移别名，但不得要求现有 Web/Mobile 立即切换 |

## 1. 范围

本仓库负责：

- MCP stdio server 工具注册与输入校验。
- v1 schema 常量、兼容别名和历史工具名兼容。
- README / research / plan 文档。
- 契约级单元测试。

本仓库不直接负责但需要约束：

- `nuwaclaw` / `agent-platform` 必须完整透传 `tool_call.rawInput`。
- `nuwax` Web 必须从标准 tool_call 事件渲染 MCP Ask 卡片。
- `nuwax-mobile` 必须与 Web 使用同一识别路径和 resume 文案。

## 2. 分阶段计划

### P0：契约收敛与本仓库可验证修复

| 工作项 | 交付物 | 验收 |
| --- | --- | --- |
| 明确 schema 命名策略 | `src/types.ts` 导出 canonical 版本与别名数组 | 单测证明 `nuwaclaw.*` 与 `nuwax.*` 都可解析 |
| 恢复历史工具名兼容 | 接受 `nuwax_ask_user` / `nuwaclaw_ask_user`，保留 `nuwaclaw_ask_user` 注册工具 | 单测覆盖主工具名和历史工具名 |
| 修正竞品调研 | `docs/COMPETITIVE-RESEARCH.md` 更新 MCP Elicitation 最新限制、URL mode 和风险 | 文档不再引用过期 2025-06-18 作为唯一依据 |
| 补充计划文档 | `docs/DEVELOPMENT-PLAN.md` | P0/P1/P2、风险、验收命令可直接执行 |

### P1：跨端落地

| 仓库 | 工作项 | 验收 |
| --- | --- | --- |
| `nuwax` | 新增 `utils/mcpAsk.ts`，识别 `data.rawInput`、`data.ext.rawInput`、根级 `rawInput`；新增 `McpAskQuestionCard` | Web 收到 `agentSessionUpdate/tool_call` 后渲染卡片，不出现 `acpRequestPermission` |
| `nuwax` | 提交/取消/跳过/超时走普通聊天消息 | 不调用 `apiResolveAcpPermission` / intervention respond |
| `nuwax-mobile` | 识别路径补齐 `data.rawInput`，与 Web resume 文案统一 | 标准 NuwaClaw 事件与当前 mobile 事件形态都可识别 |
| `nuwaclaw` | 文档化 MCP 注入配置，确认 `rawInput` 不被裁剪 | 日志/SSE 样例包含完整 `rawInput.ui` |

### P2：体验与治理

| 工作项 | 说明 |
| --- | --- |
| 防重复提交 | 用 `requestId + revision` 去重，迟到提交只生成明确状态，不重复发消息 |
| timeout UI | 客户端展示超时态；超时也以普通聊天消息进入下一轮 |
| Elicitation 子集映射 | 简单 flat primitive 表单可映射 MCP Elicitation form mode；敏感信息/OAuth/支付类只走 URL mode 或自有安全页面 |
| 示例集 | 补充 single-select、multi-select、wizard、file、fallback 样例 |

## 3. 关键风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| schema 命名空间分裂 | Web/Mobile 识别不到卡片 | v1 canonical 保持 `nuwaclaw.*`，`nuwax.*` 仅作为兼容别名 |
| `rawInput` 位置不一致 | 不同端解析结果不同 | 客户端 parser 必须兼容 `data.rawInput`、`data.ext.rawInput`、根级 `rawInput`，但权威契约仍写 `data.rawInput` |
| 自然语言 resume 被模型误读 | Agent 下一轮不知道哪个表单已回答 | resume 文案包含标题、字段 label、展示值；复杂场景可在消息中增加 `requestId/revision` 的可读行 |
| 敏感数据进入 LLM 上下文 | 安全风险 | `business` 和表单消息禁止 token、secret、支付凭据；敏感流程使用 URL fallback / Elicitation URL mode |
| Ask 被误接到 permission 通道 | 回调路径错误，Agent 无法恢复 | 验收必须确认不出现 `acpRequestPermission`，不调用 `/computer/notify-resolved` |

## 4. 本仓库验收命令

```bash
npm test
npm run typecheck
npm run build
```

## 5. 完成定义

本仓库完成定义：

- 代码接受 canonical 和迁移别名，但输出文档清楚标明 canonical。
- 历史工具名兼容测试通过。
- README 与竞品调研不再和源码契约冲突。
- `npm test`、`npm run typecheck`、`npm run build` 均通过。

端到端完成定义：

- Web/Mobile 都能从标准 `agentSessionUpdate/tool_call` 事件渲染 Ask。
- 用户响应只作为下一条普通聊天消息发送。
- ACP permission 与 MCP Ask 两条链路在日志、API 调用和 UI 状态上可区分。
