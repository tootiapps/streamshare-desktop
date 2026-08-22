# Distribution de FFmpeg

Le client lance FFmpeg comme processus séparé pour convertir en AAC les pistes
audio que Chromium ne sait pas décoder. La vidéo est copiée sans réencodage
lorsque le codec exact est pris en charge, ou réencodée en H.264 lorsque le
fallback vidéo est nécessaire. Les sous-titres texte
sélectionnés sont diffusés par un processus indépendant en WebVTT en conservant
leurs timestamps source. Les résultats sont servis uniquement sur `127.0.0.1`
sous forme de flux temporaires.

## Résolution des exécutables

L’ordre de recherche est le suivant :

1. le dossier choisi par l’utilisateur dans les réglages, qui doit contenir
   `ffmpeg[.exe]` et `ffprobe[.exe]` ;
2. `STREAMSHARE_FFMPEG_PATH` et `STREAMSHARE_FFPROBE_PATH` ;
3. `dist/ffmpeg/ffmpeg[.exe]` et `dist/ffmpeg/ffprobe[.exe]` dans le paquet ;
4. les emplacements système usuels (`/opt/homebrew/bin` et `/usr/local/bin`
   sur macOS, `/usr/local/bin` et `/usr/bin` sur Linux) ;
5. `ffmpeg` et `ffprobe` disponibles dans le `PATH` de la machine.

Le répertoire `dist/ffmpeg` est déjà déclaré dans `asarUnpack`, car un
exécutable ne peut pas être lancé depuis `app.asar`.

L’application ne télécharge aucun binaire à l’exécution. Les builds officiels
compilent FFmpeg 7.1.1 à partir de l’archive source officielle dont l’empreinte
SHA-256 est figée, puis contrôlent et copient les deux exécutables dans
`dist/ffmpeg`. La compilation est native pour macOS et Linux. Le package
Windows ARM64 expérimental utilise temporairement le binaire Windows x64 via
l’émulation intégrée de Windows 11 ARM.

Un chemin externe est explicitement choisi et possédé par l’utilisateur. Il
peut donc utiliser une configuration différente, y compris
`--enable-nonfree`. Streamshare l’indique dans l’interface mais ne bloque pas
son utilisation et ne redistribue jamais ce binaire.

La version distribuée doit être FFmpeg 6.0 ou ultérieure. La chaîne embarquée
utilise actuellement FFmpeg 7.1.1.

## Construction manuelle macOS

Le bundle est construit nativement pour l’architecture du Mac. Homebrew fournit
les dépendances de compilation LGPL/Apache/MIT/BSD, mais elles sont relocalisées
dans le paquet : aucune installation Homebrew n’est requise sur la machine du
testeur.

```bash
brew install nasm pkgconf libplacebo molten-vk
pnpm run ffmpeg:build:host
pnpm run dist:mac:arm64 # ou dist:mac:x64 sur un Mac Intel
node scripts/smoke-packaged.mjs mac arm64
node scripts/artifact-manifest.mjs mac arm64
```

Le script copie récursivement les bibliothèques Mach-O non système, remplace
leurs chemins Homebrew par `@loader_path`, appose une signature ad hoc après
modification et fournit un manifeste Vulkan local pour MoltenVK. L’application
transmet explicitement ce manifeste à FFmpeg ; elle ne dépend ni d’un Vulkan
SDK ni d’un fichier placé globalement dans `/usr/local/share` ou
`/opt/homebrew/share`.

## Construction manuelle Windows

En attendant le rétablissement des runners, le bundle x64 se construit dans un
shell **MSYS2 UCRT64** installé sur la machine Windows cible :

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

Le script télécharge uniquement la source FFmpeg officielle dont l’empreinte
est figée. Les paquets MSYS2 ne sont que des entrées de construction ; les DLL
effectivement liées et leurs licences sont recopiées dans le paquet final. Le
binaire x64 fonctionne aussi sur Windows 11 ARM via son émulation x64.

## Dolby Vision et libplacebo

Un Dolby Vision profil 5 ne doit jamais passer dans un filtre SDR générique :
il faut appliquer les métadonnées RPU et le reshaping Dolby Vision avant le
tone mapping. Le client n’autorise donc la conversion SDR que si FFmpeg expose
le filtre `libplacebo`, l’option `apply_dolbyvision` et réussit un court test du
backend GPU. `libplacebo` est sous LGPL-2.1-or-later et n’impose pas
`--enable-nonfree`. La présence du filtre dans une version choisie par
l’utilisateur reste indépendante de la politique de redistribution du paquet.

Les bundles Windows et macOS embarquent désormais `libplacebo` et leur backend
Vulkan sous forme de bibliothèques dynamiques remplaçables, à côté de FFmpeg.
Sous macOS, MoltenVK traduit Vulkan vers Metal. Le script résout récursivement
les DLL ou dylib nécessaires, inscrit leur paquet et leur version dans
`RUNTIME_COMPONENTS.txt`, et copie leurs licences dans
`THIRD_PARTY_LICENSES`. Les en-têtes Vulkan employés à la compilation sont
également inventoriés dans `BUILD_COMPONENTS.txt` avec leur licence. Le script
refuse de produire le paquet si une licence manque.
Cette intégration ne requiert ni `--enable-gpl` ni `--enable-nonfree`.

Sur macOS comme sur Windows, le mode Automatique conserve la lecture native si
`dvh1.05.xx` est explicitement pris en charge ; sinon il utilise la conversion
SDR validée au démarrage. Si le backend GPU n’est réellement pas disponible,
il affiche une erreur exploitable au lieu de générer une image violette. Sur
toutes les plateformes, un utilisateur peut sélectionner un FFmpeg externe
avec libplacebo ou choisir explicitement le mode Natif. L’application ne
télécharge jamais de binaire à l’exécution.

## Règles de publication

- refuser tout binaire **embarqué** dont `ffmpeg -version` contient
  `--enable-nonfree` ;
- produire le binaire embarqué sans `--enable-gpl` et sans
  `--enable-nonfree` ;
- conserver les textes de licence et la configuration complète du build ;
- pour les bundles Windows et macOS, conserver l’inventaire des bibliothèques
  dynamiques et leurs notices de licence, et permettre leur remplacement
  conformément à la LGPL ;
- publier l’archive des sources correspondant exactement au binaire sur le même
  canal que la version de l’application ;
- construire et vérifier séparément chaque couple plateforme/architecture ;
- inscrire version, empreinte SHA-256 et URL des sources dans les notices de la
  version.

La page juridique officielle de FFmpeg reste la référence pour la checklist de
conformité : https://ffmpeg.org/legal.html.
