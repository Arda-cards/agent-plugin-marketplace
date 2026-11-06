# Connecting to Arda

The production MCP endpoint is `https://arda-cards-mcp-prod.arda-cards.workers.dev/mcp`. Sign in with your own Arda account. Your existing Arda permissions determine what you can access.

## Claude Code CLI

Follow the installation commands in the [README](../README.md). Use `/mcp` to authenticate `arda-cards-prod`, then discover the available tools.

## Claude Cloud and Claude Desktop

In Claude, open **Customize → Connectors → Add → Custom → Web**. Enter a name such as `Arda Cards` and the production MCP endpoint above, then follow the authentication prompts. See [Anthropic's custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) for current plan and administrator requirements. This adds a connector; it does not install the Claude Code plugin or its skills.

## ChatGPT Cloud and ChatGPT Desktop

Add a custom MCP server using [OpenAI's instructions](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt), enter the production endpoint above, and sign in when prompted. Access depends on your plan and workspace settings. A custom MCP connection does not install Claude Code skills in ChatGPT.

These connection paths, requested scopes and confirmation flows still require end-to-end qualification with the deployed production service on each client and version. Interface labels and availability can change.

## Confirmations

Review changes before approving them. If your client cannot display a confirmation form, request browser review when offered. Automatic confirmation is a separate, scoped and time-limited human opt-in; use the server's confirmation-mode controls to inspect or revoke it.

## Help

Contact [customer-success@arda.cards](mailto:customer-success@arda.cards). Never send tokens, passwords or review links.
