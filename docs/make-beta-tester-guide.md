# Arda Beta (Public): customer tester guide

## 1. Release availability

Check the current release status in the authoritative app profile:
https://github.com/Arda-cards/agent-plugin-marketplace/blob/main/plugins/make-integration-app-public/references/app-profile.json

Proceed only when the profile records published status, its installation invitation,
exact app identity/version and verified source provenance. If pending-publication,
stop: plugin installation does not publish or qualify the app. Use only that app
and invitation. The public plugin README also links its current installation details:
https://github.com/Arda-cards/agent-plugin-marketplace/blob/main/plugins/make-integration-app-public/README.md

## 2. What you can test

Arda Beta (Public) exposes 188 declared modules in 17 flat functional groups.
Capabilities include item search/detail, suppliers/catalogue, Kanban cards/history,
email configuration/jobs/diagnostics, demand/orders/order lines, inventory/settings,
drafts/lifecycle operations, rendering/upload instructions and management reads.
Make an API Call remains available for supported relative JSON endpoints.

Groups use dotted functional labels. They are flat groups in Make; search by the
resource or module label when finding an operation. Module availability is separate
from qualification. Read the current module help and schema, because some GETs
create drafts or otherwise have effects and output shapes vary between modules.

This customer app always targets production:
https://prod.alpha001.io.arda.cards

The published app profile records its active browser sign-in provider in
authBaseUrl. The pre-migration provider is:
https://prod-alpha001.auth.us-east-1.amazoncognito.com

There is no Environment selector or editable tenant/identity-header field. Your
own Arda account and tenant permissions apply to every selected connection.

## 3. Install and connect in Make

Once the profile is published, open its installation invitation while signed in
to your own Make account and select the intended organization. In the scenario
builder, click +, find Arda Beta (Public), and choose a module or functional group.
Confirm its technical identity from the published profile and live module details.

In Connection, select Add and complete production Arda sign-in with your own
account. Give the connection a useful label, such as Arda production - my account.
There is no environment choice. A label alone does not prove the app, user or tenant;
retain the confirmed creation context and select that same connection in your modules.
Do not borrow another person's saved connection or switch a scenario's binding casually.

Reconnect interactively when consent expires or is revoked. Updating the plugin or
running scenarios does not extend the original refresh-token deadline. Make account
sign-in and Arda account sign-in are separate; both must succeed for their own purposes.

### Production sign-in pool migration

Production sign-in is moving to:
https://prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com

After the coordinator confirms the updated app and published profile, create a fresh
production connection, select it in every module and repeat the one-item read below.
Old refresh tokens and their 90-day lifetime do not transfer. First sign-in can
migrate your account and issue a new user identity; preserve your scenario/run history.

## 4. First scenario: Search Items then Get an Item

Ask your beta coordinator for one known, current, non-retired production item
visible to your account, with its exact name and stable entity UUID. Keep the
scenario on demand and use a total search limit of one across all pages.

Add Search Items, choose your production connection and search by exact name using
its live Filter JSON schema. Add an existence filter before Get an Item so an
empty search cannot issue a missing-ID request. Map the search result's payload.eId
to Get an Item. The stable entity ID differs from the current record version rId.

Run once only when that read is the intended task. Verify the searched/fetched
IDs and names match the known item, record the returned rId, and confirm the item
is not retired. Zero results, a skipped Get module or HTTP success alone is not a
passing positive read. Save the scenario/execution IDs and relevant nonsecret outputs.

For Make an API Call, use a supported relative /v... path, method and separate
query/body fields. Do not supply a full URL, host override or identity headers.
Inspect the actual operation and all downstream modules before treating a flow as read-only.

## 5. Install the optional agent plugin

The public marketplace needs no private GitHub checkout. Its repository is:
https://github.com/Arda-cards/agent-plugin-marketplace

Use these commands only when the profile is published and the marketplace lists
make-integration-app-public.

For Claude Code, enter:

```text
/plugin marketplace add https://github.com/Arda-cards/agent-plugin-marketplace.git#main
/plugin install make-integration-app-public@arda-cards
```

Refresh or restart when prompted. Open /mcp, select the intended Make connection
and complete browser OAuth if it is not already authorized.

For Codex, enter in your terminal:

```sh
codex plugin marketplace add Arda-cards/agent-plugin-marketplace --ref main
codex plugin add make-integration-app-public@arda-cards
codex plugin list --available --json
codex mcp list
```

Both clients load the same plugin format. Reuse your intended existing Make MCP
connection when it points to this endpoint:
https://mcp.make.com/v2

Do not overwrite another explicit server configuration. For a confirmed server
named make, Codex sign-in is:

```sh
codex mcp login make
```

Use the actual server key if different. Make OAuth grants the agent access to the
selected Make workspace; the Arda production connection separately authorizes the
scenario. The plugin does not install a direct Arda MCP connection or supply its scopes.

## 6. Use the four agent skills

Claude Code uses /make-integration-app-public:connect, :build-scenario,
:run-scenario and :diagnose. Codex uses $make-integration-app-public:connect,
:build-scenario, :run-scenario and :diagnose, or its skill picker. These skills
establish the actual workspace and production connection, discover live schemas,
inspect complete effects, run authorized work once and diagnose exact executions.

After activation and authentication, try this request:

```text
Use make-integration-app-public in my Make team <TEAM> with my confirmed
Arda production connection <CONNECTION>. Build and run an on-demand read
scenario. Search for the exact known item <NAME>, total limit 1, then Get
its expected entity UUID <EID>. Verify searched/fetched ID and name,
record ID and non-retired state. Do not write business data or enable
recurring schedules. Report the scenario and execution IDs and assertions.
```

An agent with an existing management-capable Make MCP connection can follow the
same process without installing the optional plugin. Missing schemas, installation,
account authorization or fixture access are concrete gaps; the agent should report
them and stop the affected action rather than substitute another application.

## 7. Writes, execution limits and uncertainty

During beta, manually initiate runs, use at most three concurrent workers and
100 aggregate search/list results across pages. Begin with one result. Inspect
all reachable modules, routes, error handlers, retries, loops, triggers and
non-Arda actions: a read module can feed a later email or other business write.

A write requires explicit task intent, a positively identified owned fixture,
current record basis, intended downstream effects and cleanup owner. Preserve
live confirmation/replacement fields and user permissions. Do not activate timers
or webhooks as a shortcut for a one-off run or treat installation as write consent.
Unchanged work already authorized by the user does not need repeated approval.

Retain the exact execution ID and inspect pending runs. Before another dispatch
after an ambiguous write, reconcile its execution and current record state.
Do not replay an uncertain run or automatically retry business writes. Cleanup
only fixtures created for that authorized test and verify cleanup separately.
The Make workflow has no retained direct-Arda proposal receipt or exactly-once guarantee.

## 8. Troubleshooting and feedback

If the app is missing, verify published profile status, the invitation installation
and the selected Make organization/team. Search may omit invite apps; a user-owned
saved UI scenario and live module specs can establish exact module references.
An unexpected Environment selector or technical app identity is a binding error.

For account errors, reconnect the intended production Arda connection interactively.
For empty reads, verify the known item, visibility and filters. For mapping errors,
read the current module schema rather than assuming all modules share an envelope.
For stale edits, refresh edit metadata and reconcile changes. For pending/uncertain
runs, inspect the original execution; do not retry as a diagnostic shortcut.

Share the app/plugin version, Make zone, relevant scenario/execution IDs, intended
operation, known assertion and sanitized error/result. Keep passwords, tokens,
private keys, raw OAuth callback URLs, identity headers and arbitrary customer
content out of prompts, logs and feedback. A successful first read does not qualify
all declared modules, every production tenant or every agent client's browser flow.
