# Builds desktop et signatures

Ce document décrit la construction et la future publication des installateurs
StreamShare Desktop. Les commandes locales ne publient rien : la création d’une
GitHub Release reste une action de maintenance distincte et explicitement
contrôlée.

## Cibles prises en charge

Les commandes nomment toujours l'architecture afin de ne pas hériter
accidentellement de celle de la machine de build.

| Système | Architecture | Commande |
| --- | --- | --- |
| macOS | ARM64 | `pnpm run dist:mac:arm64` |
| macOS | x64 | `pnpm run dist:mac:x64` |
| Windows | x64 | `pnpm run dist:win:x64` |
| Windows | ARM64, expérimental | `pnpm run dist:win:arm64` |
| Linux | x64 | `pnpm run dist:linux:x64` |
| Linux | ARM64 | `pnpm run dist:linux:arm64` |

Les alias `dist:mac`, `dist:win` et `dist:linux` ciblent respectivement macOS
ARM64, Windows x64 et Linux x64. `dist:host` reste disponible pour un paquet de
développement correspondant à la machine courante. Toutes ces commandes
passent `--publish never` à Electron Builder.

Les noms des fichiers contiennent la version, le système et l'architecture.
Les source maps générées par notre build restent disponibles dans `dist` pour
le diagnostic local, mais elles sont exclues des installateurs.

## Validation continue

Le workflow public compile et teste le client avec des permissions en lecture
seule. Il ne reçoit aucun secret, ne construit aucun installateur officiel et ne
crée aucune release. Les Actions utilisées sont épinglées à des SHA de commit
immuables et pnpm est installé à la version exacte déclarée par le dépôt.

La chaîne de release ajoutera ensuite une matrice native macOS ARM64 et x64,
Windows x64, Linux x64 et Linux ARM64. Windows ARM64 restera expérimental jusqu’à
validation sur du matériel réel. Chaque paquet devra être lancé brièvement sur
son système cible, puis accompagné de ses sommes SHA-256 et de son manifeste de
build.

Les paquets Linux conservent trois formats : DEB, archive portable `tar.gz` et
AppImage. L’AppImage exige `libfuse.so.2` sur certaines distributions ; le DEB
ou l’archive portable restent donc les choix documentés sans prérequis FUSE.

## Contenu d'un paquet Electron

La liste Electron Builder `files` limite le paquet à `dist` et au
`package.json` du client. Aucun fichier de développement, certificat ou secret
ne doit être ajouté à cette liste.

Un bundle JavaScript Electron reste inspectable par son utilisateur. Le dépôt
public contient donc le même code client que les installateurs officiels, ainsi
que les licences et assets nécessaires à leur reconstruction.

## Préparation macOS signée

Les builds macOS de développement utilisent une signature ad hoc, sans
certificat ni secret. Elle scelle le bundle et ses helpers, mais n'identifie pas
l'éditeur auprès d'Apple et ne remplace pas la notarisation.

Après avoir vérifié le SHA-256 et copié l'application dans `/Applications`,
essayer de l'ouvrir une première fois. macOS doit alors permettre de choisir
`Ouvrir quand même` dans **Réglages Système > Confidentialité et sécurité**.
Le bouton reste disponible pendant une durée limitée après la tentative.

Si cette option n'est pas proposée sur la version de macOS utilisée, le testeur
peut lever uniquement la quarantaine de l’artefact local contrôlé :

```bash
xattr -dr com.apple.quarantine "/Applications/Streamshare TV Client.app"
```

Il ne faut pas désactiver Gatekeeper globalement. L'alerte disparaîtra seulement
lorsque les builds Developer ID notariés seront activés.

Les commandes signées sont déjà déclarées :

```bash
pnpm run dist:signed:mac:arm64
pnpm run dist:signed:mac:x64
```

Elles imposent `forceCodeSigning=true` et `mac.notarize=true`. Elles refusent de
démarrer si le certificat ou les identifiants de notarisation sont absents.

Variables requises pour le certificat :

- `CSC_LINK` : chemin, URL privée ou contenu base64 du certificat Developer ID
  Application au format P12 ;
- `CSC_KEY_PASSWORD` : mot de passe du P12.

La notarisation accepte l'une de ces deux familles :

- clé API App Store Connect : `APPLE_API_KEY`, `APPLE_API_KEY_ID` et
  `APPLE_API_ISSUER` ;
- compte Apple : `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` et `APPLE_TEAM_ID`.

La clé API est préférable en CI. Les valeurs doivent être stockées dans les
secrets ou l'environnement protégé du dépôt, jamais dans un fichier suivi, un
artefact ou un log.

## Préparation Windows signée

La commande préparée pour un certificat Authenticode exportable est :

```bash
pnpm run dist:signed:win:x64
```

Elle exige `WIN_CSC_LINK` et `WIN_CSC_KEY_PASSWORD`, puis active
`forceCodeSigning=true`. Azure Artifact Signing pourra remplacer ce mécanisme,
mais sa configuration devra être ajoutée et testée lorsque le compte et le
profil de certificat existeront.

Il n'existe volontairement aucun workflow de release signé tant que les
certificats n'existent pas. Cela évite de transformer un tag en publication non
signée par erreur.

## FFmpeg

Les builds officiels compilent et embarquent FFmpeg 7.1.1 et FFprobe à partir de
la source officielle épinglée. Chaque couple système/architecture reçoit des
exécutables contrôlés. La chaîne :

1. vérifie leur version et leur architecture ;
2. refuse `--enable-gpl` et `--enable-nonfree` pour les binaires embarqués ;
3. vérifie l’empreinte SHA-256 figée de l’archive source ;
4. conserve la configuration de compilation, les licences et les sources
   correspondantes ;
5. exécute `ffmpeg -version` et `ffprobe -version` depuis l'application
   packagée sur le système cible.

Le choix d’un exécutable externe dans les réglages n’est pas soumis au refus
de `--enable-nonfree`, car ce fichier est fourni et utilisé localement par
l’utilisateur et n’est jamais redistribué par Streamshare.

Les règles juridiques détaillées restent dans `FFMPEG_DISTRIBUTION.md`.

## Activation des releases officielles

Une release publique ne sera créée qu’après :

1. réussite de la validation du code et de la matrice de plateformes ;
2. activation des secrets et des commandes signées ;
3. smoke-tests des paquets sur les OS cibles ;
4. vérification des sommes, licences et sources FFmpeg correspondantes ;
5. approbation explicite de la release par un mainteneur.

Références :

- [Electron Builder — builds multi-plateformes](https://www.electron.build/docs/features/multi-platform-build/)
- [Electron Builder — signature](https://www.electron.build/docs/features/code-signing/)
- [Electron Builder — notarisation macOS](https://www.electron.build/docs/notarization/)
- [GitHub — runners hébergés](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
