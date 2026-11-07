---
name: card-ordering
description: Inspect Arda cards, prepare a card ordering plan, and execute reviewed accept or start-processing actions. Use for card-based ordering in the selected Arda environment.
---

Use the selected Arda environment MCP server and its current tool schemas.

1. Inspect the queue or ordered cards using available `get_kanban_order_queue` and
   `get_ordered_kanban_cards` tools. Report observed states and missing context.
   Load/search the needed schemas first; a smaller loaded set does not contradict
   discovery of the earlier 18-tool non-email profile; confirmation controls can add
   `set_confirmation_mode` to the supported grant. For a qualification test, use
   a designated eligible disposable Card fixture. If none is designated or its current
   state is ineligible, report the missing fixture instead of selecting an unrelated
   Card, forcing a lifecycle state, or setting up a bypass through direct API calls.
2. Use `prepare_kanban_order_plan` when available for requested ordering work.
   Present the selected Cards, proposed actions, priorities, and dependencies using
   the server's review flow. Keep Card IDs and record versions (`rId`) distinct
   from the retained proposal identity and review version.
   Use `confirm_changes` when available on the exact workflow/proposal reference.
   Actions start unchecked; select only approved actions and their prerequisites.
   Supporting clients show a server-generated form; unsupported clients use
   authenticated browser review. Explain readable item/Card names, state changes,
   quantities, price unknowns, locator effects and action dependencies rather than
   raw JSON. Confirmation itself executes no command. Decline/cancel/error/timeout
   produces no approval; do not auto-answer the form or substitute a chat assertion.
   Observed CLI `2.1.311` showed the inline form; Desktop Code tab `3.6556.2` with
   embedded `2.1.308` returned a client decline without showing it. This is scoped to
   those observations, not every version. If `reviewMode` is exposed, `auto` defaults
   Claude Code's Desktop entrypoint marker to browser; `browser` explicitly selects
   browser review, while `form` requests inline review subject to protocol/capability checks.
   Report a client decline neutrally; it does not prove human rejection. Never retry
   an actual human decline or switch review interfaces automatically. When the user
   explicitly chooses browser review, use supported `reviewMode: "browser"` or
   `get_change_status` with `requestReview: true` and the same exact context/proposal/version.
   Follow its authenticated handoff, then read that exact status for the recorded receipt
   and selected actions. Browser navigation or a chat assertion alone cannot authorize commands.
3. Execute only the approved scope with available `accept_kanban_card` and
   `start_kanban_processing` tools. An accept action does not silently approve its
   later processing step. Preserve the recorded successful predecessor when
   following an approved dependency. Native client prompts are optional additional
   protection, not a required duplicate confirmation of unchanged approved scope.
4. The MCP server re-reads the current Card and evaluates relevant payload changes
   before execution. A different `rId` can remain compatible with the approved
   action. Return material discrepancies for re-evaluation as directed by the
   tool; do not invent an internal cycle-identity requirement or an atomic version
   precondition. The backend governs contention and current transition eligibility.
5. Report native results and resulting Card state/version. Use retained status
   when available to distinguish completion from current state. Do not repeat an
   uncertain command automatically.
   After expiry or interruption, inspect status before preparing again. A still-prepared
   proposal may need renewed exact review; an expired proposal needs a fresh comparison.
   Keep prior successful/uncertain attempts intact and do not dispatch them again.

Do not claim that an Arda transition sent an order to a supplier, acknowledged a
shipment, or received stock. `prepare_delivery_update`, when available, prepares a
comparison and does not authorize a note or lifecycle write. Report missing tools
and native refusals explicitly; do not bypass them with direct API requests. Keep
credentials and retained workflow resume secrets out of output and saved notes.

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
