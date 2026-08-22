# Third-party notices

Runtime dependencies used directly by StreamShare TV Client:

| Component | Resolved version | License selected for distribution |
| --- | ---: | --- |
| Electron | 42.7.0 | MIT |
| hls.js | 1.6.16 | Apache-2.0 |
| ws | 8.20.1 | MIT |
| bonjour-service | 1.4.0 | MIT |
| node-forge | 1.4.0 | BSD-3-Clause option |

`hls.js` includes work Copyright (c) 2017 Dailymotion and portions derived from
videojs-contrib-hls, Copyright (c) 2013-2015 Brightcove. Those components are
distributed under the Apache License 2.0 included with their package.

Compatibility playback runs `ffmpeg` and `ffprobe` as separate programs.
Official packages include an LGPL FFmpeg 7.1.1 build compiled without
`--enable-gpl` or `--enable-nonfree`. The LGPL texts, build configuration and
exact source archive URL are included with the executables. The matching
source archive must be published alongside packages intended for public
distribution. See `FFMPEG_DISTRIBUTION.md`.

The Windows bundle adds libplacebo under LGPL-2.1-or-later and its Vulkan and
shader dependencies as separate DLLs. The package contains the exact
`RUNTIME_COMPONENTS.txt` inventory and a copy of every package licence under
`THIRD_PARTY_LICENSES`. Vulkan headers are recorded separately in
`BUILD_COMPONENTS.txt`. None of these components enables FFmpeg's
`--enable-gpl` or `--enable-nonfree` options.

Versions are locked by the workspace lockfile. Release automation must produce
and review a complete transitive dependency notice before publishing binaries.
