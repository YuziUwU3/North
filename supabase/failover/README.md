# License failover

This directory contains the missing invite-table foundation needed to deploy
the existing `phone-license` subsystem into an otherwise empty Supabase
project. The old project remains untouched and supported by the client.

Deployment order:

1. `license_invites_base.sql`
2. the existing license migrations, in timestamp order
3. `supabase/functions/phone-license`
4. copy current invite/license rows, preserving primary keys and hashed tokens

Never expose invite codes, service-role keys, session hashes, challenge data,
or passkey public keys in deployment logs.
