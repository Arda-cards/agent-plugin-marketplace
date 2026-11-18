# Arda Beta (Public): app and authorization

Install [Arda Beta (Public)](https://www.make.com/en/hq/app-invitation/bfb5eedba3373f70b002e36ace3e3a05) in your own Make organization.
Technical app identity: `app#arda-beta-public-2d4282-myuvmd`, version 1.

The authoritative [app profile](app-profile.json) binds the published installation
invitation, technical app identity, native version, production target and verified
source provenance. Require published status before installing or using this app.
The profile's identity is `app#arda-beta-public-2d4282-myuvmd`. Do not guess it from an app's label
or replace it with another similarly named integration.

The shared declaration covers 188 first-class/generic modules in 17 flat functional
groups. See the [module catalog](modules.json). Dotted group names are flat labels,
not nested folders. In Make's scenario builder, click **+**, find **Arda Beta (Public)**,
then browse its group or search by resource/module label. Keep all available choices;
module availability and API qualification are separate observations.

Use Make MCP at `https://mcp.make.com/v2`, preferably through the user's already
configured intended connection. Its browser authorization gives the agent Make
workspace access. A separate Arda browser sign-in creates the production connection
used by scenario modules; that connection's owner supplies the Arda identity and
tenant permissions. Successful Make sign-in alone does not prove Arda data access.

The app uses authorization code with PKCE. Trusted identity supplies required headers;
there is no tenant selector, editable identity-header input, password grant or shared
API-key fallback. No password, token, client secret or SDK management credential belongs
in prompts or scenario module inputs. Reauthorize interactively when consent expires
or is revoked; updating plugin instructions does not extend an existing grant.

Call `environment_get` to resolve the user's actual Make zone/organization/team.
Try `app_find`, then `module_spec` to confirm exact modules and their schemas. If
invite-app search omits this app, inspect a user-owned saved UI scenario for its
module references and confirm them live. Static catalog entries are a discovery aid;
missing live specs are a concrete blocker, not permission to substitute another app.

Resolve or create only the user's intended production connection through the supported
Make flow or UI. This app has no Environment selector. Confirm app identity and user
from nonsecret requirements/configuration and established connection-creation context;
labels alone are insufficient. Read the [connection guidance](environments.md).
