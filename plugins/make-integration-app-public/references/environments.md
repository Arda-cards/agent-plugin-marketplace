# Production connection binding

**Arda Beta (Public)** supports production only. Read [app-profile.json](app-profile.json)
and require published status before acting. Its fixed API origin is
`https://prod.alpha001.io.arda.cards`; browser sign-in uses
`prod-alpha001.auth.us-east-1.amazoncognito.com`. These are reference values;
agents do not paste hosts into module paths or modify identity headers.

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
