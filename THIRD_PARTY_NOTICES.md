# Third-party notices

Runtime dependencies used directly by Streamshare TV Client:

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

Le mode de compatibilité exécute `ffmpeg` et `ffprobe` comme programmes
séparés. Les packages officiels embarquent un build FFmpeg 7.1.1 sous LGPL,
compilé sans `--enable-gpl` et sans `--enable-nonfree`. Les textes LGPL, la
configuration de compilation et l’URL de l’archive source exacte sont inclus
avec les exécutables dans le package. L’archive source correspondante devra
être publiée avec les packages destinés au public. Voir
`FFMPEG_DISTRIBUTION.md`.

Le bundle Windows ajoute libplacebo sous LGPL-2.1-or-later et ses dépendances
Vulkan/shader sous forme de DLL séparées. Le paquet contient l’inventaire exact
`RUNTIME_COMPONENTS.txt` ainsi qu’une copie des licences de chaque paquet dans
`THIRD_PARTY_LICENSES`. Les en-têtes Vulkan sont inventoriés séparément dans
`BUILD_COMPONENTS.txt`. Aucun de ces composants n’active les options FFmpeg
`--enable-gpl` ou `--enable-nonfree`.

Versions are locked by the workspace lockfile. Release automation must produce
and review a complete transitive dependency notice before publishing binaries.
