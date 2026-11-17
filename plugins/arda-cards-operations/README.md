# arda-cards-operations

Connect to Arda through remote HTTP MCP using your own OAuth authorization. This package
contains no credentials, executable hooks, or local server process. Installation does not
grant Arda permissions, execute changes, or enable automatic confirmation.

## Arda connection

Use the arda-cards-prod connection for the user's production account. Authenticate separately
when prompted. Installation grants no authority; existing Arda permissions and confirmation
requirements apply. Use only discovered capabilities.

## Authentication and capabilities

In **Claude Code or Claude Desktop Code tab**, open `/mcp`, select the intended named
connection, and authenticate or re-authorize it in the browser. In **Codex**, inspect
`codex mcp list`, verify the intended connection's endpoint/environment, then run:

```sh
codex mcp login <connection-name> --scopes 'workflow:write,email:read,email:manage,offline_access'
```

Use this scoped login for initial authorization and renewed consent, whether the connection
comes from the native plugin or manual configuration. If Codex retains an old grant, run
`codex mcp logout <connection-name>` and repeat the scoped login for that same intended
connection. Complete the provider's browser flow and verify the actual consent; do not copy
credentials between connections or paste passwords, tokens or callback URLs into prompts.

The plugin requests `workflow:write email:read email:manage offline_access` for every
connection. Existing grants do not expand through an update or token refresh. Re-authorize
the intended connection to request new scopes, then refresh discovery or restart the session.
Email management additionally requires current tenant-scoped Workspace `ADMIN` authority.
Cognito `openid`, `email`, and `profile` are upstream sign-in scopes, not MCP scope settings.

Use the connected server's discovered tools and current schemas. A smaller set of schemas
loaded into the conversation is not evidence of missing tools. Package installation does not
establish deployment or live qualification. The same release offers the same capabilities in
each environment, subject to current permissions and scopes.

## Skills

| Workflow | Claude Code / Desktop Code tab | Codex |
| --- | --- | --- |
| Getting started | `/arda-cards-operations:getting-started` | `$arda-cards-operations:getting-started` |
| Catalogue maintenance | `/arda-cards-operations:catalogue-maintenance` | `$arda-cards-operations:catalogue-maintenance` |
| Card ordering | `/arda-cards-operations:card-ordering` | `$arda-cards-operations:card-ordering` |
| Email operations | `/arda-cards-operations:email-operations` | `$arda-cards-operations:email-operations` |

Invoke the qualified skill name or choose the discovered skill in the skill picker.
Refresh discovery/session state after authentication
as required by the client; installation alone does not establish tool availability.

## Confirming proposed changes

Preparation changes no business record. Inspect readiness, unknowns and dependencies before
requesting review. Obtain the exact server-recorded receipt with `confirm_changes` before
execution. A chat assertion, tool-permission prompt, or browser handoff is not a receipt.
Approval cannot override readiness, current permissions, record versions, or native rules.

“Approve all actions in this proposal” selects the current proposal only. Automatic
confirmation requires a separate authenticated human opt-in through `set_confirmation_mode`.
The grant is scoped to the environment, user, tenant, delegation, workflow and proposal family,
lasts at most 1 hour, and can expire sooner. It grants no new permissions or permanent identity
trust. Use `mode: status` to inspect it and `mode: manual` to revoke it immediately.
Loops retain the same workflow context and call `confirm_changes` for every new proposal's
exact receipt. An agent cannot opt itself in, manufacture a receipt or auto-answer a form.

## Browser review and recovery

Use `reviewMode: browser` when supported and the client cannot present the inline form.
Observed Claude Desktop Code connections have returned declines without showing a form;
report that no approval was recorded rather than infer that a person declined. A real human
decline ends that attempt. Do not automatically repeat a prompt or switch review interfaces.
After an explicitly requested browser handoff, fetch the retained proposal's status and receipt.
Inspect status after interruptions; do not repeat an uncertain write or recreate it to bypass
an uncertain outcome. Never share OAuth URLs, tokens, cookies, review proofs or resume secrets.

For email, discover the supported inspection and management tools. Management consent does
not imply support for sending, replay, suppression mutation, force-lock or deletion. Follow the
email skill and current schemas. Catalogue, Card and email workflow guidance preserves the
server's approval and authorization controls.
