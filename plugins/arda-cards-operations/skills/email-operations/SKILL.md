---
name: email-operations
description: Inspect Arda tenant email configurations and known EmailJobs, explain diagnostic coverage, and prepare or apply supported configuration lifecycle changes through exact server review. Use for Arda email operations, not personal mailboxes or sending messages.
---

Use the selected Arda environment MCP server and its current discovered tool schemas.
This skill is guidance, not evidence of deployment, authorization or qualification.

## Discover and authorize

1. Discover actual tools and load/search their schemas. Do not confuse a small set of loaded
   schemas with the discovery result. Discover inspection, configuration management and
   diagnostic tools separately; the package version and a fixed tool count do not establish
   capabilities or permission. Diagnostic reads also require the supporting backend contract.
   Missing capabilities stop the affected step.
2. Email grants are independent of catalogue, Card and workflow grants. Inspection requires
   explicit `email:read` or supported `email:manage`. Management requires `email:manage`
   plus authoritative current same-user, same-tenant Workspace `ADMIN` membership. Do not
   infer authority from chat, record authors, a role label or scope alone. The server checks
   authority during preparation, review and dispatch; no user-supplied flag replaces it.
3. Plugin `0.1.0` requests `workflow:write email:read email:manage offline_access`. Existing grants do not
   expand through installation, updates or refresh tokens. Follow the
   [email onboarding guidance](../../README.md#authentication-and-capabilities): update from `main`,
   re-authorize the intended connection through `/mcp`, verify `email:read` and `email:manage` on actual browser
   consent, then refresh discovery. A separately configured connection needs its own explicit
   requested scopes. Do not edit bearer headers or ask for credentials in chat. `email:manage`
   is explicitly requested by this version; release it only after the server supports management.
   Consent alone is never write intent. Do not repeatedly request unsupported scopes or bypass held tools.

## Inspect first

Use only schemas actually exposed by this connection:

- `search_email_configurations`: exact supported filters and one bounded page. Describe page
  coverage; do not invent fuzzy matching, exhaustive totals or reusable native cursors.
- `get_email_configuration`: exact Arda configuration UUID, optional bounded recorded-time
  history. Distinguish operational and administrative state; unknown facts remain unknown.
  History is partial. Configuration readiness does not prove recipient eligibility or delivery.
- `get_email_message`: exact **Arda EmailJob UUID**, not a provider message ID, with supported
  as-of coordinates when needed. Report observed status, attempts and safe recipient counts.
  Known-job inspection is not discovery of all sends, pre-send rejections or event history.

Useful sanity prompts: “List available email tools and granted scope names without changing
anything”; “Inspect one page of configurations and explain what it covers”; “Inspect this
known EmailJob and identify facts that remain unknown.” Installation is not write intent.

When exposed by a later supported deployment, `search_email_messages` and
`get_email_suppressions` provide bounded backend-backed diagnostics. Follow their exact filters,
projections, time windows and coverage metadata. A later `get_email_message` schema may add
backend-backed event evidence; do not assume that evidence exists in the first milestone.
Do not fabricate an event timeline, an
unretained pre-send rejection or an absent suppression. Failed lookup is not proof of absence;
empty pages and partial evidence do not establish complete history. Delivery is not human reading.

Keep output within safe server projections. Do not request or expose provider resources or
credentials, webhook/routing tokens, message bodies/attachments, or raw free-text failure,
lock or recovery notes. The initial reads omit recipient addresses; do not reconstruct them.
Later recipient-scoped diagnostics use only their explicitly supported safe projection and
minimum needed identifiers. Keep OAuth URLs, browser proofs, resume secrets and raw native
payloads out of logs, saved notes, Git and issue reports.

## Reviewed configuration management

Only when requested, authorized and exposed, use `prepare_email_configuration_changes`, then
`confirm_changes`, then `apply_email_configuration_changes`. Never substitute direct REST,
provider calls, raw legacy writes or invented tool arguments for missing support.

- Resolve the exact target and requested effects. Supported lifecycle targets are create,
  provision, graceful lock, unlock, re-provision, re-verify and restore, subject to the actual
  action schema. Generic field editing and bulk operations are not implied. Preparation must
  make no native mutation, DNS, provider or email calls.
- Preserve returned workflow context, proposal ID/version and action dependencies. Present
  business-friendly target/current facts, proposed effects, readiness, unknowns and dependencies.
  Show sender/tracking choices for creation; external provisioning and enabling sending are
  separate effects. Explain graceful lock/drain and unlock's possible cancellation of draining.
  Never infer verification or a completed lifecycle state from command acceptance.
- Stop if any proposed action is not ready. Explain unresolved facts; do not repeatedly confirm
  or apply an unchanged blocked proposal. For create/provision, first create and observe the
  native configuration identity/state, then prepare and review a fresh provision proposal.
- Use exact server review. All actions start unchecked; the user selects only approved actions
  and their required prerequisites. Preparation, a handoff, chat approval and confirmation alone
  do not dispatch. Apply only the server-recorded exact version and selected scope.
- Match existing host guidance: CLI `2.1.311` showed inline review; Desktop Code tab `3.6556.2`
  with embedded `2.1.308` returned a client decline without showing it. These observations do
  not predict other versions. Where supported, `reviewMode: auto` conservatively chooses browser
  review for the Desktop entrypoint; `browser` explicitly requests it and `form` remains subject
  to protocol/capability checks. No mode grants approval. Do not auto-answer client forms.
- Report client decline neutrally: no approval was recorded, not proof of human rejection.
  Never retry an actual human decline or automatically switch its interface. When the user
  explicitly chooses browser review, use supported `reviewMode: browser`, or `get_change_status`
  with the exact context/proposal/version and `requestReview: true`. Follow authenticated
  handoff instructions, then read that same status for the recorded receipt and selection.
- After interruption or expiry, inspect retained status before preparing again. An unchanged
  still-prepared proposal may need fresh review; an expired proposal needs a fresh comparison.
  Successful and uncertain attempts remain evidence, never permission to redispatch.
- Report each action separately: not started, refused, native command accepted, asynchronous
  work pending, completion actually observed, or unknown outcome. Read-only bounded polling
  and reconciliation are distinct from retrying create/provision/unlock/recovery commands.
  A lost response can have created a configuration or external resources; preserve uncertainty.

Sending, resend/replay, test email, suppression mutation, force-lock and deletion are outside
scope. A management approval never authorizes these effects. Use designated eligible disposable
configurations for explicitly authorized management qualification; do not pick unrelated records
or bypass MCP to manufacture a test fixture. Local plugin validation is not live qualification.

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
