# Code signing policy

Official StreamShare Desktop binaries must be built from a protected commit in
this public repository by the reviewed GitHub Actions release workflow. Every
release requires an explicit maintainer action and must pass the repository's
tests, packaging checks, licence validation, checksum generation and provenance
attestation.

## Current beta status

- Windows beta packages are currently unsigned.
- macOS beta packages use ad-hoc signing and are not notarized.
- Linux packages are distributed with checksums and build provenance.

Release notes must state this status plainly. The project does not distribute
a self-signed root certificate and never asks users to disable operating-system
security controls globally.

## Planned Windows signing

The project intends to apply for the free open-source signing programme
provided by SignPath Foundation after its first public beta is available.

Planned provider statement: **Free code signing provided by SignPath.io,
certificate by SignPath Foundation.**

If the application is accepted, this document and the release notes will be
updated before any SignPath-signed binary is described as signed. The
certificate publisher will be SignPath Foundation rather than TootiApps.

## Roles

- Committer and reviewer: [@tootiapps](https://github.com/tootiapps)
- Release and signing approver: [@tootiapps](https://github.com/tootiapps)

The repository requires pull requests, successful validation, linear history
and resolved review conversations before changes reach the release branch.
Signing or release approval remains a separate manual action.

## Privacy

The client privacy policy is available in [`PRIVACY.md`](PRIVACY.md).
