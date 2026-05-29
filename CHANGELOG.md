# Changelog

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
