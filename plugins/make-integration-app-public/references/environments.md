# Production connection binding

**Arda Beta (Public)** supports production only. Read [app-profile.json](app-profile.json)
and require published status before acting. Its fixed API origin is
`https://prod.alpha001.io.arda.cards`; the profile's `authBaseUrl` identifies its
qualified browser sign-in provider. Agents do not paste hosts into module paths
or modify identity headers.

1. Resolve the user's actual Make zone, organization and team. Make workspace
   location is independent of the fixed Arda production destination.
2. Once the invitation is published, install that exact app in the intended Make
   organization. Add **Arda Beta (Public)** to your own scenario and choose **Add**
   in Connection. There is no Environment selector; sign in with your own production
   Arda account and existing tenant permissions.
3. Confirm the app's technical identity from the profile and live module requirements.
   Confirm the user's production connection through nonsecret configuration or
   established UI-confirmed creation context. A label or Make OAuth result alone
   does not establish Arda identity. Do not inspect token-bearing credential data.
4. Bind every Arda module to that intended connection. Existing connections keep
   their app and account binding. A connection from a different app cannot be borrowed
   as a shortcut. An unexpected Environment selector or unsupported destination is
   a binding error; report it and stop the affected operation.

The module catalog's current app identity is `app#arda-beta-public-2d4282-myuvmd`. First-class modules
and **Make an API Call** share its production binding. Generic calls accept supported
relative `/v…` paths with separate query/body fields. They do not accept a full URL,
arbitrary host, tenant override or alternative destination.

Use a known current production item for an authorized first read. Empty results do
not prove the connection or tenant is correct. A missing account, fixture or live
schema is a concrete gap. Installation does not authorize a scenario execution,
business write, schedule activation or broader endpoint qualification.

## Production sign-in pool migration

Production sign-in is moving from
`prod-alpha001.auth.us-east-1.amazoncognito.com` to
`prod-lowercase-alpha001.auth.us-east-1.amazoncognito.com`. The published profile's
`authBaseUrl` records the active, qualified binding. A plugin update or a migration
notice alone does not establish that the Make app has completed the cutover.

After the beta coordinator confirms the updated app is qualified, create a fresh
production Arda connection in Make, select it in every affected module, and run
Search Items then Get an Item once for a known item. The new pool issues a new user
identity; old refresh tokens and their remaining 90-day lifetime do not transfer.
Creating a fresh connection avoids retaining the old identity in a saved connection.
Use your own authorized account. First sign-in can migrate that account, so complete
it as part of the announced cutover rather than as a configuration-inspection probe.
Keep existing scenario links and execution history while updating their connections.
