# FFmpeg distribution

The client runs FFmpeg as a separate process to convert unsupported audio
tracks to AAC. Video is copied without re-encoding when the exact codec is
supported, or converted to H.264 when a video fallback is required. Selected
text subtitles are served independently as WebVTT while preserving their
source timestamps. Output is exposed only on `127.0.0.1` as temporary
streams.

## Executable resolution

Executables are resolved in the following order:

1. the directory selected by the user in settings, which must contain
   `ffmpeg[.exe]` and `ffprobe[.exe]`;
2. `STREAMSHARE_FFMPEG_PATH` and `STREAMSHARE_FFPROBE_PATH`;
3. `dist/ffmpeg/ffmpeg[.exe]` and `dist/ffmpeg/ffprobe[.exe]` in the
   package;
4. common system locations (`/opt/homebrew/bin` and `/usr/local/bin` on
   macOS, `/usr/local/bin` and `/usr/bin` on Linux);
5. `ffmpeg` and `ffprobe` available on the machine's `PATH`.

The `dist/ffmpeg` directory is unpacked in distributed applications because
an executable cannot be launched from the application archive.

The application never downloads binaries at runtime. Official builds compile
FFmpeg 7.1.1 from an official source archive with a pinned SHA-256 digest, then
validate and copy both executables into `dist/ffmpeg`. Builds are native on
macOS and Linux. The experimental Windows ARM64 package temporarily uses the
Windows x64 binary through the emulation built into Windows 11 ARM.

An external path is explicitly selected and controlled by the user. It may
therefore use a different configuration, including `--enable-nonfree`.
StreamShare identifies this in the interface but does not block its use and
never redistributes that binary.

Distributed FFmpeg must be version 6.0 or later. The bundled toolchain
currently uses FFmpeg 7.1.1.

## Manual macOS build

The bundle is built natively for the Mac architecture. Homebrew provides
LGPL, Apache, MIT and BSD build dependencies, but they are relocated into the
package: testers do not need Homebrew installed.

```bash
brew install nasm pkgconf libplacebo molten-vk
pnpm run ffmpeg:build:host
pnpm run dist:mac:arm64 # or dist:mac:x64 on an Intel Mac
node scripts/smoke-packaged.mjs mac arm64
node scripts/artifact-manifest.mjs mac arm64
```

The build script recursively copies non-system Mach-O libraries, replaces
Homebrew paths with `@loader_path`, applies ad-hoc signing after modification
and provides a local Vulkan manifest for MoltenVK. The application passes this
manifest explicitly to FFmpeg and does not depend on a Vulkan SDK or a
globally installed file under `/usr/local/share` or `/opt/homebrew/share`.

## Manual Windows build

Until suitable runners are restored, the x64 bundle is built in an
**MSYS2 UCRT64** shell installed on the target Windows machine:

```bash
pacman --noconfirm -S --needed make diffutils \
  mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-nasm \
  mingw-w64-ucrt-x86_64-pkgconf mingw-w64-ucrt-x86_64-libplacebo \
  mingw-w64-ucrt-x86_64-vulkan-headers
export PATH="/ucrt64/bin:/usr/bin:$PATH"
bash scripts/build-bundled-ffmpeg.sh win x64
pnpm run dist:win:x64
node scripts/smoke-packaged.mjs win x64
node scripts/artifact-manifest.mjs win x64
```

The script downloads only the official FFmpeg source archive with its pinned
digest. MSYS2 packages are build inputs only; the linked DLLs and their
licences are copied into the final package. The x64 binary also runs on
Windows 11 ARM through x64 emulation.

## Dolby Vision and libplacebo

Dolby Vision Profile 5 must never be passed through a generic SDR filter. Its
RPU metadata and Dolby Vision reshaping must be applied before tone mapping.
The client therefore permits SDR conversion only when FFmpeg exposes the
`libplacebo` filter and its `apply_dolbyvision` option, and passes a short
GPU-backend test. `libplacebo` is licensed under LGPL-2.1-or-later and does
not require `--enable-nonfree`. Availability in a user-selected build remains
independent from the package redistribution policy.

Windows and macOS bundles include `libplacebo` and their Vulkan backend as
replaceable dynamic libraries alongside FFmpeg. On macOS, MoltenVK translates
Vulkan to Metal. The build script resolves the required DLLs or dylibs
recursively, records their package and version in `RUNTIME_COMPONENTS.txt`,
and copies their licences into `THIRD_PARTY_LICENSES`. Vulkan headers used
during compilation are also recorded in `BUILD_COMPONENTS.txt` with their
licence. The build refuses to produce a package if a licence is missing. This
integration requires neither `--enable-gpl` nor `--enable-nonfree`.

On macOS and Windows, Automatic mode preserves native playback when
`dvh1.05.xx` support is explicitly reported; otherwise it uses the SDR
conversion validated at startup. If the GPU backend is unavailable, the
client reports an actionable error instead of producing a purple image. On
every platform, users may select an external FFmpeg build with libplacebo or
explicitly choose Native mode. The application never downloads a binary at
runtime.

## Release requirements

- reject any **bundled** binary whose `ffmpeg -version` output contains
  `--enable-nonfree`;
- build bundled binaries without `--enable-gpl` or `--enable-nonfree`;
- retain licence texts and the complete build configuration;
- for Windows and macOS bundles, retain the dynamic-library inventory and
  licence notices and allow library replacement as required by the LGPL;
- publish the source archive matching the binary through the same channel as
  the application version;
- build and verify every platform and architecture pair independently;
- record the source version, SHA-256 digest and URL in the release notices.

The official FFmpeg legal page remains the reference compliance checklist:
https://ffmpeg.org/legal.html.
