# Independent companion cloud

The private-phone account, companion sync, APNs delivery, and background role
jobs run in the dedicated Supabase project `small-phone-companion-cloud`
(`qvuahlqimcfgeoetosnl`, Singapore).

Safety boundary:

- The legacy application project `lkhlyfpssmrjkkzhuzag` remains the web/API
  source for existing non-companion features.
- The invitation failover project `lovbzibismsjqvjujilz` remains limited to
  `phone-license`.
- Companion/account clients must use only `qvuahlqimcfgeoetosnl`.
- Never copy account, companion, or APNs tables into the invitation project.

Deployment state recorded on 2026-08-20:

- Twenty prerequisite migrations through
  `202608130003_background_delivery_diagnostics.sql` were installed.
- `phone-role-push` and `phone-companion-push` were deployed.
- APNs secrets were configured in the dedicated project.
- The scheduler URL was moved to the dedicated project; migration
  `202608200001` makes that endpoint reproducible.
- Email confirmation is disabled for this isolated account system because a
  phone number is represented internally by a non-deliverable private email.

The database password created during project provisioning was not retained.
Reset it in the Supabase dashboard before a future workflow needs direct
database-password access. Runtime clients and Edge Functions do not use it.
