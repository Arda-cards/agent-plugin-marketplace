# Arda Cards marketplace

Connect an AI assistant to your Arda production account for supported catalogue, card and email workflows. Access and changes remain subject to your Arda permissions and the server's confirmation controls.

The marketplace has two integration paths:

| Plugin | Connection | Availability |
| --- | --- | --- |
| `arda-cards-operations` | Direct Arda production MCP | Available now. |
| `make-integration-app-public` | Make MCP and the production-only **Arda Beta (Public)** app | Listed only after verified app publication; check the [current app profile](plugins/make-integration-app-public/references/app-profile.json). |

Check the app profile before customer setup. When its status is `pending-publication`, the Make
plugin is unlisted and its app cannot be installed or used through these instructions. Continue
only when the profile is `published`, supplies the actual invitation and the marketplace lists
the Make plugin. The direct Arda plugin remains available independently.

## Direct Arda MCP in Claude Code

In Claude Code CLI, add the marketplace and install the plugin:

```text
/plugin marketplace add Arda-cards/agent-plugin-marketplace
/plugin install arda-cards-operations@arda-cards
```

Restart the session if prompted. Open `/mcp`, select `arda-cards-prod` and sign in to Arda in your browser. Ask the assistant to use the Arda connection; the getting-started skill is `/arda-cards-operations:getting-started`.

Other supported client installation paths and their qualification status are in [the setup guide](docs/setup.md). An Arda account and an available production service are required.

## Arda through Make MCP

The customer plugin provides four agent skills: **Connect**, **Build Scenario**, **Run Scenario**
and **Diagnose**. They use your existing Make MCP access to discover live module schemas and work
with your own Make scenarios. A separate Arda production connection supplies the scenario's Arda
identity and tenant permissions. Each operation remains subject to your existing permissions.

Once `make-integration-app-public` is listed in this marketplace, install it in Claude Code with:

```text
/plugin marketplace add https://github.com/Arda-cards/agent-plugin-marketplace.git#main
/plugin install make-integration-app-public@arda-cards
```

In Codex, use:

```sh
codex plugin marketplace add Arda-cards/agent-plugin-marketplace --ref main
codex plugin add make-integration-app-public@arda-cards
codex mcp list
```

Reuse your intended existing Make MCP connection. If authentication is needed, confirm the `make`
server points to `https://mcp.make.com/v2`, then complete the client's browser sign-in; Codex uses
`codex mcp login make`. Make authorization grants access to the selected Make workspace; the Arda
connection inside each module separately authorizes production Arda access. Use your own accounts.

After publication, the bundled guide supplies the **Arda Beta (Public)** installation invitation.
The app connects only to production and has no Environment selector. Start with an on-demand
Search Items → Get an Item scenario against a known item. Use live `module_spec` before mapping
fields. Keep runs within the requested scope, inspect all reachable scenario effects before
dispatch, and reconcile uncertain executions before repeating them. Installation and sign-in
do not authorize business writes or recurring schedules.

Use `/make-integration-app-public:connect` in Claude Code or
`$make-integration-app-public:connect` in Codex to begin. The Make skills use Make's execution
model; the direct Arda plugin's proposal/confirmation receipts do not carry over to Make scenarios.
The [customer beta guide](docs/make-beta-tester-guide.md) and
[downloadable PDF](docs/make-beta-tester-guide.pdf) cover both human scenario-builder use and agent use.

## Support

Contact [customer-success@arda.cards](mailto:customer-success@arda.cards) privately. Do not include passwords, access tokens or confirmation links.

## Terms

Copyright © Arda Systems. All rights reserved. Use is subject to [Arda's Terms of Use](https://app.termly.io/policy-viewer/policy.html?policyUUID=08a78355-5593-4082-8f1d-edd32dd53aec) and [Privacy Policy](https://app.termly.io/policy-viewer/policy.html?policyUUID=eb58aa15-d066-45ca-9f63-0e3b1319bdfa). Do not reverse engineer or distribute this package without Arda's prior written permission, except as permitted by applicable law and applicable platform terms. Contact customer-success@arda.cards for permission requests.

## Maintaining a release

The `package.json` version and direct-Arda plugin version must agree. The Make plugin has its own
independent version. The changelog records the changes for each release. Both plugins are generated
from shared Arda sources and should be promoted through a reviewed pull request. An authorized
maintainer must compare it against the matching shared source before release; public CI
cannot read the internal source. Run `npm ci` and `npm run check` to validate this checkout.

The Make bundle's `references/app-profile.json` records its production binding and publication
status. Pending source remains outside the marketplace index; only a published profile with its
actual invitation and verified source artifact may register the Make plugin. Public validation
checks both bundles, their distinct MCP contracts and module identities, and rejects internal
identities, private source links and nonproduction Arda targets. Package checks do not establish
authenticated customer installation or qualify every API operation.

Put release notes in each pull request under `## CHANGELOG`; do not edit the assembled
changelog directly. After validation succeeds on `main`, release automation publishes
the configured package version and records the date. Changes made without a package
version increase are collected in the next release. Release automation requires the
configured changelog GitHub App and its branch-rules bypass, plus the optional Slack
notification secret; repository administrators maintain these credentials.
