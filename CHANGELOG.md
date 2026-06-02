# Changelog

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
