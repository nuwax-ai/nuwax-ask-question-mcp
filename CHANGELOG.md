# Changelog

## 3.3.2 (2026-06-23)

Fix:

- Tool `structuredContent` now includes canonical `input` (`McpAskUserToolInput` with `schemaVersion`, `toolName`, and `ui.version` stamped). Platforms must prefer this field over the agent's raw tool arguments when publishing SSE `result.input`, otherwise Web/Mobile DockPanel cannot parse the ask card (missing `schemaVersion`).
- Exported `normalizeMcpAskUserToolInput` from `nuwax-ask-question-mcp/ask-user-payload` for sandbox/agent-platform to normalize agent payloads before persistence.
- Tool handler always runs `normalizeMcpAskUserToolInput` before `handleAsk`, ensuring internal and returned `input` are contract-complete.

## 3.3.1 (2026-06-23)

Fix:

- Agents (LLMs) could not call `nuwax_ask_question`: calls failed with a Zod `invalid_literal` error on `ui.version` because the model often omits or mistypes the required magic-string version constants (`nuwax.interaction.v1` / `nuwax.mcp_ask.v1`). `schemaVersion` and `ui.version` are now optional with a server-applied default at the agent-facing input schema; the MCP SDK fills them in during `safeParse`, so `handleAsk`'s strict parse still passes. The canonical `McpAskUserToolInputSchema` (`types.ts`) and `schemas/schema.json` remain strict — the backend/DockPanel contract is unchanged.
- Added 5 regression tests covering the omitted-version defaults and the still-rejected wrong-version cases.

## 3.0.1 (2026-06-02)

Refactor:

- Templated the MCP tool description in `registerTool` against `MCP_ASK_TOOL_NAME`, `INTERACTION_UI_SCHEMA_VERSION`, and the new `ASK_STATUS_PENDING` constant so the prose can no longer drift from the schema constants in `types.ts`.
- Templated the `McpServer` `instructions` string against `MCP_ASK_TOOL_NAME` for the same reason.
- Added a regression `describe("ASK_TOOL_DESCRIPTION")` test block asserting the registered description contains all three current constants.

Docs:

- Generalized the README callout about the `mcp__<server>__<tool>` prefix from "In Codex" to "Some MCP clients (e.g. OpenAI Codex CLI)" in both EN and CN, since the prefix is standard across compliant MCP clients.

## 3.0.0 (2026-05-29)

Breaking:

- Switched schema versions to the latest `nuwax.mcp_ask.v1` and `nuwax.interaction.v1`.
- Removed compatibility for the old `nuwaclaw.mcp_ask.v1` and `nuwaclaw.interaction.v1` schema namespaces.

## 2.0.0 (2026-05-29)

Breaking:

- Removed the legacy `nuwaclaw_ask_user` MCP tool entry.
- `nuwax_ask_question` is now the only registered and accepted MCP ask tool.

## 1.0.0 (2026-05-29)

Initial public release.

- MCP tool `nuwax_ask_question` for interactive question cards
- Zod-validated input schemas (strict mode)
- Stdio transport, no HTTP server required
- File upload widget support
- List widget (single-select vertical list) support
