---
name: run-scenario
description: Run and verify a user-authorized Make scenario containing Arda Beta (Public) modules. Use for a first read smoke test, bounded beta qualification, explicit test-owned writes, execution polling, or recording results and cleanup.
---

First read the bundled [public app profile](../../references/app-profile.json).
If its status is not `published`, report that Arda Beta (Public) is awaiting release.
Do not install it, create its Arda connections, configure its modules or run its scenarios.
Do not guess an invitation, app identity or substitute another app. Read-only investigation of
an existing Make workspace remains available when requested, without invoking this pending app.
When published, require the profile's exact app identity/version and production binding before
the procedures below. Plugin installation is not evidence of application readiness.

Read the [app reference](../../references/app-reference.md) and the relevant
[scenario pattern](../../references/scenario-patterns.md). Use `diagnose` for
failures and ambiguous outcomes. These procedures do not execute a scenario
merely because this skill or plugin was installed. Follow
[environment verification](../../references/environments.md) for every Arda connection.

1. Identify the exact user-selected scenario, Make team and each Arda connection
   with its intended environment. Confirm saved bindings from nonsecret configuration
   or established UI-confirmed creation context; do not trust a label alone.
   Read `scenario_get` and the relevant `scenario_module_get` configuration
   before dispatch. Inspect every reachable module, router arm, error handler,
   loop, trigger and non-Arda action. A read-only Arda module can feed an email,
   HTTP write or other side effect elsewhere in the flow.
2. Match those complete effects to the user's existing authorization. A request
   to build, inspect or connect does not authorize a run. A read-only test cannot
   execute a mixed write scenario. Ask only for a missing decision that blocks
   the intended scope; do not repeatedly confirm an unchanged authorized action.
   Never use Make as an alternate route around a blocked direct Arda-MCP proposal.
3. For a positive first read, use a current, non-retired fixture in the selected
   Arda environment visible to
   the intended connection. Record expected entity ID/name and, when supplied,
   current record ID. Previously retired CI fixtures are not reusable fixtures.
   Configure Search Items with an exact-name filter and total limit one, then
   Get an Item from the returned `payload.eId`. An empty search is not a pass.
4. Preserve manual/on-demand beta execution, at most three concurrent workers,
   and at most 100 aggregate search/list results across pages. If `scenario_run`
   requires activation, activate only the intended on-demand scenario when that
   activation is within the requested scope. If activation would enable a timer
   or webhook, explain that dependency rather than silently enabling it for a
   one-off test. Respect how the actual trigger must receive its input.
5. Before an authorized write test, identify the exact owned fixture, operation,
   expected current basis, downstream effects and cleanup owner. Supply the
   actual module's explicit intent/confirmation fields. Use current `rId` values
   where required and preserve unselected fields in curated selective updates.
   Full-record replacement requires its documented acknowledgement and complete
   intended record. A read-before-write check is not an atomic backend precondition.
   Inspect scenario-level retries/error handlers; do not enable automatic replay
   of business writes or adopt the direct Arda-MCP approval protocol here.
6. Invoke `scenario_run` once with the declared inputs. Retain its execution ID.
   If pending, poll that same execution with `scenario_execution_get`; never
   redispatch merely because it is slow or temporarily absent. When the response
   has no execution ID after an uncertain dispatch, inspect narrowly filtered
   execution history before considering any new run. Preserve uncertainty when
   the original attempt cannot be uniquely identified.
7. Require terminal success and the pattern's business assertions. Verify
   returned entity/name/record identity and non-retired state for a read. Follow
   declared outputs and `Return output`; inspect modules for absent outputs.
   A skipped module, no bundle, warning, HTTP success alone or metadata-only
   diagnostic result does not establish the requested positive assertion.
8. Clean up only fixtures created for this authorized test, through the supported
   operation and within the approved cleanup scope. For item retirement, verify
   HTTP 200, the same entity ID and `retired: true`. Record cleanup separately.
   If any write or retirement is ambiguous, inspect its original execution and
   current record before another invocation. Do not retire pre-existing records
   or use broad-search cleanup. Card/provider changes have no generic undo.
9. Report scenario and execution IDs, selected Arda environment and connection
   label/ID, exact module versions, expected/observed assertion fields, status and cleanup result.
   Distinguish passed, failed, blocked and unknown outcomes. Keep passwords,
   tokens, callback URLs and identity headers out of output and saved evidence.
   Passing this test does not qualify every available module or another tenant.
