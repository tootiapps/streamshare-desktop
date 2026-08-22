# Contributing

Issues describing reproducible desktop playback, pairing, packaging or
compatibility problems are welcome. Please include the operating system,
architecture, StreamShare Desktop version and non-sensitive diagnostics.

Pull requests may be reviewed, but accepted changes can be reproduced by the
maintainers through the controlled public distribution process instead of
being merged directly.

## Before opening a change

1. Do not include credentials, media access tokens, personal data, signing
   certificates, private endpoints or generated build output.
2. Add or update tests for behavior changes.
3. Keep the receiver compatible with the documented public remote protocol.
4. Update user-facing or build documentation when supported behavior changes.
5. Run the validation commands below.

## Validation

```bash
corepack enable
pnpm install
pnpm test
pnpm build
```

Official installers are produced only by the reviewed release process. Local
unsigned packages must not be presented as official StreamShare releases.
