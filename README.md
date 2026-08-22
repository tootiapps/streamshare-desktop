# StreamShare TV Client

Open-source remote playback client for Windows, macOS and Linux. It receives
StreamShare Remote v1 commands over the local network and plays compatible
media streams. Unsupported audio codecs, including AC-3, E-AC-3, DTS and
TrueHD, use an FFmpeg compatibility process that converts audio to AAC. Video
is copied without re-encoding whenever possible and converted to H.264 only
when the original codec cannot be decoded. An initial audio buffer and a
single coordinated resume prevent duplicate starts and interruptions at
segment boundaries. Compatible text subtitles remain available as WebVTT on
their original timeline; image-based subtitles are listed but reported as
unavailable in this mode.

The settings panel can enable or disable compatibility playback and displays
the application version and detected executable paths. Compatible HLS streams
are played directly without FFmpeg inspection. After seeking or switching
tracks, the replacement audio stream is prepared before the transition so the
video and playback position remain stable. Playback pauses at the current
position and shows a loading indicator until video, a validated audio reserve
and the selected subtitles are ready on the same timeline. It then resumes
once, without permanent playback-speed correction. Later HLS incidents use
ordinary network or media recovery without automatically restarting the
FFmpeg pipeline or entering another loading loop.

For Dolby Vision Profile 5, the client checks support for the exact
`dvh1.05.xx` codec. **Automatic** mode preserves native playback only when
that capability is explicitly reported; otherwise it requests SDR conversion.
**Native** mode always preserves the Dolby Vision stream, while **SDR** mode
always requests conversion. Conversion requires the `libplacebo` filter, its
`apply_dolbyvision` option and a working GPU backend. The client verifies all
three at startup. If any requirement is missing, it refuses to generate
incorrect colours and asks the user to select an external FFmpeg build with
libplacebo. Windows packages include libplacebo and its Vulkan runtime. macOS
packages include libplacebo, the Vulkan loader and MoltenVK for execution on
Metal. Availability is still verified at runtime because the driver and GPU
must provide a usable backend. Linux currently relies on native playback or a
user-selected external FFmpeg build. Copied Dolby Vision profiles are remuxed
with their exact profile and level under the `dvh1` tag instead of being
announced as generic `hvc1` HEVC.

When video conversion is required, the original resolution is preserved by
default and never upscaled. The **Video conversion quality** setting can cap
the output at 2160p, 1080p or 720p for less powerful devices. The H.264 bitrate
and level follow the resulting tier: 24 Mbit/s above 1080p, 8 Mbit/s above
720p, and 4 Mbit/s up to 720p. The same setting is reapplied after seeking or
switching tracks and is shown in the technical information panel.

FFmpeg output segments are temporary. The source is read at playback speed,
the HLS playlist retains a sliding window of six segments, and older segments
are removed automatically. Temporary data is cleared at startup, when
playback stops and before the application exits. The first launch after an
upgrade also removes the former `sessionData/media-fallback` cache.

## Development

```bash
pnpm install
pnpm ffmpeg:build:host
pnpm start
```

The FFmpeg command prepares and validates a native bundle for the current
machine. On macOS it requires `libplacebo` and `molten-vk` from Homebrew.
`start` then rebuilds the application, copies that bundle to `dist/ffmpeg`
and uses it for playback. If the cache does not exist yet, `start` attempts
to build it automatically. Development therefore never switches silently to
a different system FFmpeg version.

The client remains active in the notification area after its window is
closed. It does not provide Wake-on-LAN and cannot wake or restart a powered-off
Android device.

The **Technical information** panel opens from the **View** menu or with
`Cmd+I` on macOS and `Ctrl+I` on Windows/Linux. It displays the active
native or FFmpeg playback decision, codecs and tracks, Dolby Vision profile,
tone mapping, encoder, FFmpeg process, buffers, rendered resolution, dropped
frames and recent process output. Displayed addresses mask intermediate path
segments so a screenshot cannot accidentally expose a media access token.

The interface follows the system language by default and supports explicit
selection of German, English, Spanish, French, Italian, Portuguese or Russian.
During playback, moving the pointer over the video reveals local play, pause,
stop, fullscreen and seek controls. The tracks panel selects audio, video
quality and available subtitles. It is also fully navigable from the
StreamShare remote control.

The displayed logo is copied from `assets/logo.svg` during each build. Native
assets are limited to those required by the packaging process: the 1024 px PNG
exported from Icon Composer on macOS, the multi-resolution ICO on Windows and
the Freedesktop PNG sizes on Linux. They are prepared under `dist/icons`
before final package resources are generated. The macOS PNG mask, margins and
depth are preserved. Packaged builds let macOS load the bundle icon; dynamic
Dock icon replacement is limited to development mode. The editable
`assets/streamshare.icon` project remains the Icon Composer source and is
not copied into distributed packages.

## Installable packages

Build commands produce the native distribution formats for each system:

```bash
pnpm dist:mac
pnpm dist:win
pnpm dist:linux
```

These commands create a macOS DMG, a Windows NSIS installer, and Linux
AppImage, DEB and portable `tar.gz` packages. DEB is recommended for Ubuntu
and Debian. The `tar.gz` archive provides a portable option on other
distributions without requiring FUSE. AppImage remains available for systems
that provide `libfuse.so.2`; on recent Ubuntu installations without FUSE 2,
use the DEB or portable archive instead.

Release builds are produced on their target system. The beta release workflow
attaches artifacts, SHA-256 checksums, SPDX SBOMs, build metadata and licence
notices to a manually reviewed GitHub prerelease. macOS beta bundles use ad-hoc
signing, while Windows beta packages remain unsigned until the project obtains
a trusted signing service.

The `dist:*` scripts select architectures explicitly. Continuous validation
builds and tests the client without creating a release. The platform matrix
and signing requirements are documented in
[`BUILD_AND_SIGNING.md`](BUILD_AND_SIGNING.md).

## Security

- a persistent self-signed TLS identity, pinned during discovery;
- a two-digit SAS code displayed locally and never sent to the controller;
- a random token encrypted with RSA-OAEP/SHA-256;
- only the token's SHA-256 digest stored by the receiver;
- access that can be revoked from the settings panel.

Please report vulnerabilities through
[GitHub private vulnerability reporting](https://github.com/tootiapps/streamshare-desktop/security/advisories/new).
Do not include credentials, pairing tokens, media URLs or sensitive
diagnostics in a public issue.

See the repository's [`PRIVACY.md`](PRIVACY.md) and
[`CODE_SIGNING_POLICY.md`](CODE_SIGNING_POLICY.md) for the public privacy and
release-trust commitments.

## Independence and licensing

This project is licensed under Apache-2.0 and contains no proprietary code
from the StreamShare applications. It implements only the
[public remote protocol](https://docs.tootiapps.com/clients/), allowing the
desktop receiver to remain an independent open-source project.

FFmpeg runs as a separate program and may be included in public packages only
after its build configuration and matching sources have been validated.
Builds marked `--enable-nonfree` are rejected. See
[`FFMPEG_DISTRIBUTION.md`](FFMPEG_DISTRIBUTION.md) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
