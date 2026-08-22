# Desktop builds and signing

This document describes how StreamShare Desktop installers are built and how
official releases will eventually be published. Local commands never publish
anything: creating a GitHub Release remains a separate, explicitly controlled
maintenance action.

## Supported targets

Every command names its target architecture so it cannot accidentally inherit
the build machine's architecture.

| System | Architecture | Command |
| --- | --- | --- |
| macOS | ARM64 | `pnpm run dist:mac:arm64` |
| macOS | x64 | `pnpm run dist:mac:x64` |
| Windows | x64 | `pnpm run dist:win:x64` |
| Windows | ARM64, experimental | `pnpm run dist:win:arm64` |
| Linux | x64 | `pnpm run dist:linux:x64` |
| Linux | ARM64 | `pnpm run dist:linux:arm64` |

The `dist:mac`, `dist:win` and `dist:linux` aliases target macOS ARM64,
Windows x64 and Linux x64 respectively. `dist:host` remains available for a
development package matching the current machine. All these commands pass
`--publish never` to the packaging tool.

Artifact names contain the version, operating system and architecture. Source
maps produced by the build remain available under `dist` for local
diagnostics but are excluded from installers.

## Continuous validation

The public workflow builds and tests the client with read-only permissions. It
receives no secrets, creates no official installer and publishes no release.
GitHub Actions dependencies are pinned to immutable commit SHAs, and pnpm is
installed at the exact version declared by the repository.

The future release pipeline will add native macOS ARM64 and x64, Windows x64,
Linux x64 and Linux ARM64 jobs. Windows ARM64 remains experimental until it is
validated on physical hardware. Every package must be launched briefly on its
target system and accompanied by SHA-256 checksums and a build manifest.

Linux keeps three distribution formats: DEB, portable `tar.gz` and AppImage.
AppImage requires `libfuse.so.2` on some distributions, so DEB and the
portable archive remain the documented options without a FUSE prerequisite.

## Package contents

The package `files` allowlist limits output to `dist` and the client
`package.json`. Development files, certificates and secrets must never be
added to this list.

The distributed application code can be inspected by its users. This public
repository therefore contains the same client code as official installers,
along with the licences and assets required to rebuild it.

## Signed macOS preparation

Development macOS builds use ad-hoc signing without a certificate or secret.
This seals the application bundle and its helpers but does not identify the
publisher to Apple and does not replace notarization.

After verifying the SHA-256 checksum and copying the application to
`/Applications`, try to open it once. macOS should then offer **Open Anyway**
under **System Settings > Privacy & Security**. The button remains available
for a limited time after the launch attempt.

If that option is unavailable on the tested macOS version, a tester may remove
quarantine only from the locally verified artifact:

```bash
xattr -dr com.apple.quarantine "/Applications/Streamshare TV Client.app"
```

Do not disable Gatekeeper globally. This warning will disappear only after
notarized Developer ID builds are enabled.

Signed commands are already declared:

```bash
pnpm run dist:signed:mac:arm64
pnpm run dist:signed:mac:x64
```

They enforce `forceCodeSigning=true` and `mac.notarize=true`, and refuse to
start if the certificate or notarization credentials are missing.

Certificate variables:

- `CSC_LINK`: path, private URL or base64 content of the Developer ID
  Application certificate in P12 format;
- `CSC_KEY_PASSWORD`: P12 password.

Notarization accepts either credential family:

- App Store Connect API key: `APPLE_API_KEY`, `APPLE_API_KEY_ID` and
  `APPLE_API_ISSUER`;
- Apple account: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
  `APPLE_TEAM_ID`.

An API key is preferred in CI. Values must be stored in repository secrets or
a protected environment, never in a tracked file, artifact or log.

## Signed Windows preparation

The prepared command for an exportable Authenticode certificate is:

```bash
pnpm run dist:signed:win:x64
```

It requires `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, then enables
`forceCodeSigning=true`. Azure Artifact Signing may eventually replace this
mechanism, but its configuration must be added and tested after an account and
certificate profile exist.

There is deliberately no signed release workflow until signing credentials
exist. This prevents a tag from accidentally producing an unsigned public
release.

## FFmpeg

Official builds compile and bundle FFmpeg 7.1.1 and FFprobe from pinned
official source. Each operating system and architecture pair receives
validated executables. The process:

1. verifies their version and architecture;
2. rejects `--enable-gpl` and `--enable-nonfree` in bundled binaries;
3. verifies the pinned SHA-256 digest of the source archive;
4. retains the build configuration, licences and corresponding sources;
5. runs `ffmpeg -version` and `ffprobe -version` from the packaged
   application on the target system.

A user-selected external executable is not rejected when it contains
`--enable-nonfree`, because that file is supplied and used locally by the
user and is never redistributed by StreamShare.

Detailed compliance rules are documented in
[`FFMPEG_DISTRIBUTION.md`](FFMPEG_DISTRIBUTION.md).

## Enabling official releases

A public release will be created only after:

1. code validation and the platform matrix both succeed;
2. secrets and signed build commands are enabled;
3. packages pass smoke tests on their target operating systems;
4. checksums, licences and matching FFmpeg sources are verified;
5. a maintainer explicitly approves the release.

References:

- [Electron Builder — multi-platform builds](https://www.electron.build/docs/features/multi-platform-build/)
- [Electron Builder — code signing](https://www.electron.build/docs/features/code-signing/)
- [Electron Builder — macOS notarization](https://www.electron.build/docs/notarization/)
- [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
