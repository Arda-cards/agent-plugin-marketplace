# Production scenario patterns

Read the [app profile](app-profile.json) and require published status before configuring
or running this app. Use [live discovery and authorization](app-reference.md), then
`module_spec` for every module, its version, required parameters, mapper fields and
output envelope. Refer to [production bindings](environments.md).

## First read: Search Items → Get an Item

The user supplies a known, current, non-retired production item visible to their
connection, with its expected stable entity UUID and name. Search by exact name,
limit one result across all pages, then map `payload.eId` to Get an Item. Stop an
empty search with an existence filter; zero bundles is not a passing read.
Verify searched/fetched IDs and names, the returned `rId` and non-retired state.
Keep the scenario on demand and inspect all other reachable modules before running.

For a generic read, use Make an API Call with a supported relative JSON endpoint.
Supply method/path and schema-defined query fields; never provide a full URL or
identity headers. Some GET endpoints create drafts or other effects: classify the
actual operation from live help and its complete downstream flow.

## Agent-callable scenario

Use **Scenarios / Start scenario**, the declared Arda modules and **Scenarios /
Return output** when the current schemas support that interface. Declare explicit
inputs/outputs, map schema domains correctly and preserve filters/error handlers.
Creating or editing a scenario does not authorize running or activating it.

## Explicit writes

A write test requires the user's intended production effects, one owned fixture,
current record basis, downstream effects and cleanup owner. Preserve live explicit
intent and replacement acknowledgements; retain unselected fields in selective
updates and use current `rId` when required. A read-before-write is not atomic.
Never borrow another user's saved connection or alter unrelated scenarios.

Run once within existing authorization, retain the exact execution ID and poll that
attempt until terminal. Preserve at most three concurrent workers and 100 aggregate
search/list results across pages. Do not add automatic business-write retries.
Reconcile pending/uncertain dispatch, original execution and current record state
before considering another invocation. Cleanup only positively identified fixtures
created for that test; verify the exact entity and retirement result separately.

A scenario-wide read test must have no reachable write elsewhere, including email,
HTTP side effects, loops or error handlers. The Make connection's permissions and
module confirmation fields do not replace task intent or provide direct-Arda
retained proposal receipts. Report exact assertions, outcomes, cleanup and gaps;
one passing scenario does not qualify every declared module or another tenant.
