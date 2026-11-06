---
name: getting-started
description: Connect to the selected Arda environment and explain the available catalogue, card and email workflows. Use when a user is getting started with Arda cloud access or needs connection help.
---

Help the user work with the selected Arda environment MCP server.

1. Identify the plugin's Arda tools actually available in this session. Use their
   current schemas; do not invent arguments or claim planned tools are callable.
   Discover `set_confirmation_mode` before offering automatic confirmation. A smaller set of schemas
   loaded into the model context is not the discovered tool count: load/search the
   needed tools first. Refresh discovery after server schema changes as the client requires.
2. If the server needs authentication, direct the user to `/mcp`, select the
   plugin's intended connection, and complete browser sign-in. Confirm that consent
   includes `workflow:write`, `email:read` and `email:manage`; plugin `0.4.0` requests
   `workflow:write email:read email:manage offline_access`. Existing grants do not expand automatically.
   If only `query_business_affiliates` and `get_business_affiliate` appear, explain
   that an affiliate-only grant exposes exactly those two tools. Have the user update
   to current plugin from `main`, re-authorize this connection through `/mcp`, and start
   a new session to refresh discovery. Token refresh or a new chat alone does not
   expand a grant. A manually configured connection needs its own `oauth.scopes`
   setting. Do not request an API key, password, token, or OAuth URL in chat.
3. Explain which environment the connection targets and that requests act as the signed-in Arda user. Do
   not infer the current user's identity or tenant from a record's author fields.
4. For an authorized read request, use the corresponding available read tool and
   present its result. Installation or sign-in alone is not intent to create,
   update, delete, or transition any record.
5. Offer catalogue inspection, a card ordering plan, or email inspection when their tools
   are available. For email, follow `email-operations`: start with the three supported reads
   `search_email_configurations`, `get_email_configuration` and `get_email_message`.
   These require independent `email:read` or supported `email:manage` consent. Update from
   `main`, re-authorize through `/mcp`, verify `email:read` and `email:manage` on actual browser consent, then
   refresh discovery. A manually configured connection needs its own explicit requested scopes.
   Never claim email is deployed from this skill or version alone. Discover the actual
   capabilities of each connection separately; tool counts are not permission guarantees.
   Management also requires current tenant-scoped Workspace `ADMIN` and exact review.
   State missing capabilities clearly and stop the affected step.
6. Before requesting catalogue approval, inspect each prepared action's `ready`,
   `unknowns`, and dependencies. `prepared` does not mean executable, and approval
   cannot override a readiness guard. Never request confirmation, browser approval,
   or execution for unready actions; report the blocked scope and reasons. If none
   are ready, stop approval requests until the underlying facts or server support
   change. Review an independent ready subset only after the user accepts the
   reduced scope. Follow the catalogue-maintenance skill for Item/supply effects.
   Explain `confirm_changes` when available: the server presents a business-friendly
   review for the exact proposal and returns a receipt after confirmation. All actions
   start unchecked; select only approved actions and their prerequisites. Confirmation
   does not execute the change. Decline/cancel/error/timeout approves nothing.
7. Match review guidance to the observed host. CLI `2.1.311` showed an inline form;
   Desktop Code tab `3.6556.2` with embedded `2.1.308` returned a client decline without
   showing it, with HTTP User-Agent `claude-code/2.1.308 (claude-desktop, agent-sdk/0.3.308)`.
   These observations do not establish behavior for other versions. If the current schema
   exposes `reviewMode`, `auto` defaults Claude Code's Desktop entrypoint marker to browser
   review; `browser` explicitly selects it, and `form` requests inline review subject to
   protocol/capability support. No mode authorizes a write.
8. Report a returned decline as a client result, not proof that a person saw/rejected
   a form. Never retry an actual human decline or switch to browser automatically.
   When the user explicitly chooses browser review, use supported `reviewMode: "browser"`
   or `get_change_status` with `requestReview: true` and the exact retained context,
   proposal ID and version. Follow its authenticated handoff, then read the same status
   to obtain the recorded receipt and exact selected scope. Inspect status after expiry
   or interruption before preparing a replacement; completed/uncertain work must not redispatch.

Respect existing user intent without repeated confirmations for unchanged approved
actions. Native tool prompts are optional client protection, not a required second
approval of unchanged scope. Client-mediated confirmation trusts the authenticated
client; do not claim independently verified human presence or auto-answer its form
on the user's behalf. Follow the server's review and authorization flow for writes. Do not
substitute direct REST calls or raw legacy writes for an unavailable workflow tool.
Report observations and native results without claiming that release qualification is
complete. Keep credentials and retained workflow resume secrets out of user-facing
output and persisted notes.

## Bulk and automatic confirmation

Use only features exposed by the connected schema. “Approve all actions in this proposal”
is an unchecked bulk choice in supported confirmation forms, including the browser page.
It selects the current proposal's complete actions; it grants no future approval.

Only after an explicit user request, call `set_confirmation_mode` with `mode: auto`,
the exact retained context and proposal ID/version to open authenticated browser review.
The tool call alone cannot enable automatic confirmation: the owning user must check the
separate option and approve there. Check the returned mode and actual expiry; do not infer
activation from a handoff or navigation. `mode: status` inspects the recorded mode.
Use `mode: manual` with that context and proposal reference to revoke immediately; pending
automatic receipts then cannot authorize further dispatch. Already dispatched effects remain.

The grant lasts at most 1 hour and can expire sooner with the existing authorization. It
binds the user, tenant, delegation, workflow and proposal family. Catalogue, Card and delivery
share one family; email configuration management is a separate family. This is not identity-wide
or permanent trust and does not extend to other workflows or future sign-ins. Installation,
authentication or an agent prompt never supplies this opt-in. It does not upgrade OAuth scopes;
a new grant still needs its own consent. Current permissions, role checks and readiness guards
remain in force, including current tenant ADMIN for email management.

For authorized loops, retain the same workflow context and call `confirm_changes` for each
new proposal to obtain its exact receipt before applying. While a valid grant is active, the
server can issue that receipt without another review prompt. Never invent a receipt, auto-answer
a form, skip readiness checks or retry uncertain effects. Expiry or revocation stops future
automatic dispatch; inspect status and obtain supported fresh review before continuing.

## Arda connection

Use the arda-cards-prod connection for the user's production account. Authenticate separately
when prompted. Installation grants no authority; existing Arda permissions and confirmation
requirements apply. Use only discovered capabilities.
