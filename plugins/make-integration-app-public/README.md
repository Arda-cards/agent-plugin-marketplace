# make-integration-app-public

Use **Arda Beta (Public)** through Make MCP from Claude Code or Codex. This customer
variant targets **production only**. Its four skills help connect, build scenarios,
run authorized scenarios and diagnose recorded executions. The separate direct
Arda MCP plugin remains available for direct Arda workflows.

## Availability

**Awaiting publication.** This bundle is staged for review and is not registered in the marketplace. No installation invitation is available. Do not install a similarly named app or configure/run this pending app.

Read the bundled [app profile](references/app-profile.json) first. The plugin is
indexed in the marketplace only after that profile records published status,
a real invitation, the exact app identity/version and verified release provenance.
Installing plugin files alone cannot make a pending application available.

## Install after activation

In Claude Code:

```text
/plugin marketplace add https://github.com/Arda-cards/agent-plugin-marketplace.git#main
/plugin install make-integration-app-public@arda-cards
```

In Codex:

```sh
codex plugin marketplace add Arda-cards/agent-plugin-marketplace --ref main
codex plugin add make-integration-app-public@arda-cards
codex plugin list --available --json
codex mcp list
```

Both clients load the same native plugin format. Refresh or restart the session
when prompted. Reuse the user's intended existing Make MCP connection when it
points to `https://mcp.make.com/v2`; do not overwrite another explicit server.
If authorization is missing, use the client's browser OAuth flow (`/mcp` in Claude;
`codex mcp login make` for the confirmed `make` server in Codex). Use the available
server's actual key if it differs. No direct Arda MCP scopes are supplied to Make.

## Use

After the app profile is published, install its invitation in your own Make
organization and create your own Arda production connection inside a scenario.
Choose **Arda Beta (Public)**; there is no Environment selector. The exact technical
app identity is `app#arda-beta-public-2d4282-myuvmd`. Confirm it from live module requirements,
not from a display label alone. The agent runs as the selected connection owner.

| Skill | Claude Code | Codex |
| --- | --- | --- |
| Connect | `/make-integration-app-public:connect` | `$make-integration-app-public:connect` |
| Build | `/make-integration-app-public:build-scenario` | `$make-integration-app-public:build-scenario` |
| Run | `/make-integration-app-public:run-scenario` | `$make-integration-app-public:run-scenario` |
| Diagnose | `/make-integration-app-public:diagnose` | `$make-integration-app-public:diagnose` |

Start with this scoped request after activation:

```text
Use make-integration-app-public with my Make team <TEAM> and my confirmed
Arda production connection <CONNECTION>. Build and run an on-demand read
scenario: Search Items for the known item <NAME>, total limit 1, then Get
its expected entity ID <EID>. Verify the returned ID/name, record ID and
non-retired state. Do not make business writes or enable recurring schedules.
```

See the bundled [app reference](references/app-reference.md),
[production connections](references/environments.md), [scenario patterns](references/scenario-patterns.md)
and [troubleshooting](references/troubleshooting.md). The [module catalog](references/modules.json)
records 188 declared modules in 17 flat groups. Pending source is a discovery plan,
not evidence of a deployed app; after activation use live `module_spec` for every
module's current configuration, version and effects.

A [customer guide](https://github.com/Arda-cards/agent-plugin-marketplace/blob/main/docs/make-beta-tester-guide.md)
and [PDF](https://github.com/Arda-cards/agent-plugin-marketplace/blob/main/docs/make-beta-tester-guide.pdf)
cover the Make UI and agent paths without a private repository checkout.

Installation and OAuth do not grant business-write intent. Preserve user permissions,
explicit writes, full-flow effect inspection, manual beta execution, at most three
workers and 100 aggregate search/list results across pages. Reconcile pending or
uncertain executions before another dispatch. The Make workflow does not implement
retained direct-Arda proposal receipts or an exactly-once guarantee.
