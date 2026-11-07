---
name: catalogue-maintenance
description: Inspect Arda catalogue items and suppliers, prepare changes for review, and execute approved changes. Use for catalogue lookup and maintenance through the selected Arda environment.
---

Use the selected Arda environment MCP server and its current tool schemas.

1. For reads, use available `search_items`, `get_item`, `search_suppliers`,
   `get_supplier`, and `get_catalog_options` capabilities as appropriate. Resolve
   ambiguous targets with the user before preparing a mutation.
   Load/search the needed schema before concluding a tool is absent. The earlier baseline
   of 18 discovered tools can coexist with fewer schemas loaded into the current context.
2. Summarize observed facts with record identities, units, currencies, and coverage
   limits. Distinguish missing evidence from an empty result; do not infer prices,
   unit conversions, supplier identities, or unseen records.
3. For requested changes, use `prepare_catalog_changes` when available. Preserve
   the returned proposal identity and version through the supported workflow.
   Before any approval request, inspect every action's `ready` value, `unknowns`,
   and dependencies. A proposal in `prepared` state is not necessarily executable.
   Never request `confirm_changes`, browser approval, or `apply_catalog_changes` for
   an unready action. Report each blocked action and its returned reason instead.
   If no actions are ready, stop requesting approval. Do not repeat confirmation or
   re-prepare on the same unchanged facts to try to clear a readiness guard.
   If ready actions form an independent, dependency-valid subset, explain the reduced
   scope and obtain the user's acceptance before reviewing only that subset. An
   action with an unready prerequisite is not an executable subset.
   Present the intended effects and unresolved choices for ready actions using the
   server's review flow. Use `confirm_changes` when available with the exact returned workflow
   context and proposal reference. Every action starts unchecked; select only the
   desired complete actions and their prerequisites. Supporting clients show the
   server's form; unsupported clients receive authenticated browser review. Present readable
   names, before/after fields, shared effects and dependencies rather than raw JSON.
   Preparation and confirmation are not execution. Decline/cancel/error/timeout
   produces no approval; do not auto-answer the form or substitute a chat assertion.
   CLI `2.1.311` showed inline confirmation; Desktop Code tab `3.6556.2` with embedded
   `2.1.308` returned a client decline without displaying it. Do not generalize to other
   versions or call that a human rejection. Where the current schema exposes `reviewMode`,
   `auto` defaults Claude Code's Desktop entrypoint marker to browser; `browser` selects
   browser review and `form` requests inline review subject to protocol/capability checks.
   Never retry a human decline or automatically switch its review interface. When the user
   explicitly chooses browser review, use supported `reviewMode: "browser"` or call
   `get_change_status` with the same exact context/proposal/version and `requestReview: true`.
   Follow the returned authenticated handoff, then read that exact status for the recorded
   receipt and action selection. Do not execute from a chat assertion or handoff alone.
4. Recheck retained readiness and use `apply_catalog_changes` only for ready actions
   in the exact approved version and selected
   scope through the server's authorization mechanism. Do not treat a guessed ID
   or a caller-supplied confirmation flag as a substitute for that mechanism.
5. Report each native outcome, including partial success and uncertainty. Use
   `get_change_status` and `get_entity_history` when available to inspect retained
   outcomes or supported history. Do not automatically repeat an uncertain write.
   After expiry or an interruption, inspect status before preparing again. Renew review
   of an unchanged still-prepared proposal only when its selected actions are ready
   and its receipt needs renewal; an expired proposal needs a new
   comparison. Existing successful/uncertain attempts are never permission to dispatch again.

In catalogue actions, `item.update` targets the Item's `entityId`. Supply actions use
`itemId` for the parent Item; `supply.update` additionally targets the supply's `entityId`.
Use entity IDs, not `rId` record/version IDs or retained proposal IDs. Do not substitute
one field for another or copy a schema from a similarly named tool.

If a required capability is absent, finish supported read steps and report the
blocked action. Do not fall back to raw affiliate writes or direct REST calls.
Existing instructions can authorize unchanged actions without another question;
native client prompts are optional additional protection, not a mandatory second
confirmation. Materially changed effects require renewed review. Never display or persist
credentials or retained workflow resume secrets.

Readiness guard: `item_supply_healing_or_reference_effects_not_bounded` means the
native Item update can heal Item/supply references even when the requested edit is
SKU-only. The current guard flags Items with supplies because those effects are not
bounded by the MCP comparison. Restricting the requested fields does not bypass it;
there is no tool argument that overrides it. Additional approval does not make the
action ready. Backend/MCP support for bounded effects is needed before it can execute.
Do not disable the guard or use generic write tools, raw API calls, or another route
to bypass it.

For a batch such as 12 requested SKU edits, a valid browser receipt with no execution
attempts can still accompany this readiness refusal. Read the exact retained status:
report blocked actions and their reasons, distinguish approval from readiness and
execution, and leave the writes untouched. Do not attribute a documented readiness
refusal to a failed browser review or start another approval loop.

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
