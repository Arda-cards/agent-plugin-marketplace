---
name: connect
description: Connect Claude Code or Codex to Make MCP and the published Arda Beta (Public) app. Use for installation, choosing the user's Make team and Arda connection, browser authorization, or invite-app discovery problems.
---

First read the bundled [public app profile](../../references/app-profile.json).
If its status is not `published`, report that Arda Beta (Public) is awaiting release.
Do not install it, create its Arda connections, configure its modules or run its scenarios.
Do not guess an invitation, app identity or substitute another app. Read-only investigation of
an existing Make workspace remains available when requested, without invoking this pending app.
When published, require the profile's exact app identity/version and production binding before
the procedures below. Plugin installation is not evidence of application readiness.

Read the bundled [app reference](../../references/app-reference.md) and
[environment/connection guidance](../../references/environments.md) before acting.
Use [troubleshooting](../../references/troubleshooting.md) for a failed connection.
Resolve these paths relative to this installed skill, without assuming an Arda
workspace checkout or a particular agent client's tool-name prefix.

1. Discover the Make MCP tools actually available in this session. Tool loading,
   authentication and an app's available modules are separate observations. If
   only execution tools are exposed, explain that scenario construction needs a
   management-capable Make connection; the human can still use the Make UI.
2. If Make MCP needs authorization, use the client's supported browser OAuth
   flow for the packaged Make endpoint. Follow its actual consent; do not invent
   scope strings. Reuse an already authorized intended connection. Never request
   passwords, API tokens, authorization codes or OAuth callback URLs in chat.
3. Establish the intended Make organization/team from the user or current task.
   Call `environment_get` to resolve its current IDs and zone. The Arda destination is always production, independently of the Make zone.
   Ask only for missing Make workspace, production account or connection details.
   Never infer the Arda identity from a Make team or substitute another similarly named app.
4. Direct the human to the app invitation in the reference and to install
   **Arda Beta (Public)** in their selected Make organization/team. In a new scenario,
   they add an Arda module, choose **Add** in Connection and complete production Arda
   sign-in with their own authorized account. There is no Environment selector.
   Confirm the app's technical identity from the bundled profile and live module schema.
   Make OAuth authorizes Make access; that module connection separately supplies
   Arda identity and tenant permissions. Installation grants neither permission.
5. Try `app_find` for the requested Arda operation, then inspect the exact result.
   General app search can omit this invite-link app. Use the user's saved UI
   scenario with `scenario_get` to recover its exact module references, or use the
   verified reference snapshot as a discovery aid. Call `module_spec` in the
   selected organization/team to confirm every chosen module. Do not substitute
   an unrelated catalogue search result. If live specs do not resolve, report
   the missing app/module and stop the affected configuration step.
6. Select the user's intended Arda connection from the live module requirements.
   Confirm its environment and user from available nonsecret configuration or
   established UI-confirmed creation context; its label alone proves neither.
   If this evidence is unavailable, ask for that specific UI confirmation without
   reading credential/token fields. A team connection is not proof of Arda identity.
   Never borrow a maintainer/CI connection. If no intended connection exists,
   use the human UI route or discover `connection_create` requirements first.
   Present its browser handoff; after the human completes it, use
   `connection_get` with that request ID to obtain the resulting connection ID.
   If the tools cannot establish the exact public app and production connection,
   use Make's UI for that step; do not invent an environment parameter or substitute another app.
7. Return the selected Make zone/organization/team, Arda environment, app reference,
   module versions and connection label/ID, plus any concrete authentication gap.
   Successful browser sign-in alone does not prove Arda data access. Offer the
   known-fixture read in [scenario patterns](../../references/scenario-patterns.md)
   and follow the `run-scenario` skill when the user requests its execution.

Keep every connection and API request bound to production and the exact app in
the bundled profile. A different Arda destination is unsupported by this plugin.
There is no editable tenant
selector or identity-header override. Do not use direct REST, SDK management
credentials or the direct Arda MCP server to bypass a connection failure.
Plugin installation, authentication and a smaller loaded schema set are not
evidence of business-write authorization or complete app qualification.
