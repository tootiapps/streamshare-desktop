# Streamshare TV Client

Client de lecture distante open source pour Windows, macOS et Linux. Il reçoit
les commandes du protocole Streamshare Remote v1 sur le réseau local et lit les
flux avec le moteur multimédia d’Electron et hls.js. Les codecs audio non pris
en charge par Chromium (notamment AC-3, E-AC-3, DTS et TrueHD) basculent vers
un sidecar FFmpeg qui convertit l’audio en AAC et, uniquement si le codec vidéo
n’est pas décodable, réencode la vidéo en H.264. La vidéo compatible reste
copiée sans réencodage ; un tampon audio initial et une
reprise unique évitent le double démarrage et les ruptures aux limites de
segments. Dans ce mode, les sous-titres texte compatibles sont diffusés
indépendamment en WebVTT avec leur timeline d’origine ; les
sous-titres image restent visibles mais sont signalés indisponibles.

Le panneau de configuration permet d’activer ou désactiver ce mode et affiche
la version ainsi que l’emplacement des exécutables détectés. Les flux HLS qui
annoncent un codec compatible ne sont pas analysés par FFmpeg. Lors d’un
changement de piste ou d’un seek, le nouveau flux audio est préparé avant la
bascule afin de préserver l’image et la position de lecture. Le lecteur se met
en pause au point courant et affiche un indicateur de chargement jusqu’à ce que
la vidéo, une réserve audio validée et les sous-titres sélectionnés soient
prêts sur la même timeline. Il reprend ensuite les deux éléments une seule fois,
sans correction permanente de vitesse. Les incidents HLS ultérieurs utilisent
les reprises réseau ou média de hls.js sans redémarrer automatiquement le
pipeline FFmpeg ni afficher une nouvelle boucle de chargement.

Pour Dolby Vision profil 5, le client sonde le codec exact `dvh1.05.xx` avec
MSE, l’élément vidéo et Media Capabilities. Le mode **Automatique** conserve la
lecture native uniquement lorsque cette capacité est explicitement annoncée ;
sinon il demande une conversion SDR. Le mode **Natif** force la conservation du
flux Dolby Vision et le mode **SDR** force la conversion. Cette conversion
nécessite le filtre `libplacebo`, son option `apply_dolbyvision` et un backend
GPU fonctionnel. Le client vérifie ces trois conditions au démarrage. Si elles
ne sont pas réunies, il refuse de produire une conversion aux couleurs fausses
et indique qu’une version externe de FFmpeg avec libplacebo doit être choisie.
Les paquets Windows incluent libplacebo et son runtime Vulkan. Les paquets
macOS incluent libplacebo, le chargeur Vulkan et MoltenVK afin d’exécuter ce
traitement sur Metal. La disponibilité effective reste vérifiée au démarrage,
car le pilote et le GPU doivent fournir un backend utilisable. Le paquet Linux
conserve pour l’instant le moteur natif et le choix d’un FFmpeg externe comme
solutions.
Les profils Dolby Vision copiés sont remuxés sous le tag `dvh1` avec leur profil
et leur niveau, au lieu d’être annoncés comme du HEVC générique `hvc1`.

Lorsqu’une conversion vidéo est réellement nécessaire, elle conserve par
défaut la résolution originale sans agrandissement. Le réglage **Qualité de
conversion vidéo** permet de la plafonner à 2160p, 1080p ou 720p pour les
machines moins puissantes. Le débit H.264 et son niveau sont adaptés au palier
obtenu : 24 Mbit/s au-dessus du 1080p, 8 Mbit/s au-dessus du 720p et 4 Mbit/s
jusqu’au 720p. Le même choix est réappliqué après un déplacement ou un changement
de piste et apparaît dans le panneau d’informations techniques.

Les segments produits par FFmpeg sont temporaires. La source est lue au rythme
de la lecture, la playlist HLS ne conserve qu’une fenêtre glissante de six
segments et les anciens segments sont supprimés automatiquement. Le répertoire
temporaire est nettoyé au démarrage, à l’arrêt de la lecture et avant la sortie
de l’application. Le premier démarrage après mise à jour supprime également
l’ancien cache situé dans `sessionData/media-fallback`.

## Développement

```bash
pnpm install
pnpm ffmpeg:build:host
pnpm start
```

La première commande FFmpeg prépare et vérifie le bundle natif de la machine.
Elle requiert `libplacebo` et `molten-vk` via Homebrew sur macOS. `start`
reconstruit ensuite l’application, recopie ce bundle dans `dist/ffmpeg` et
l’utilise réellement. Si le cache n’existe pas encore, `start` tente de le
construire automatiquement. Une version système différente n’est donc plus
sélectionnée silencieusement en développement.

Le client reste actif dans la zone de notification lorsque sa fenêtre est
fermée. Il ne contient ni Wake-on-LAN, ni mécanisme destiné à réveiller ou
relancer un appareil Android arrêté.

Le panneau **Informations techniques** s’ouvre depuis le menu
**Présentation** ou avec `Cmd+I` sur macOS et `Ctrl+I` sur Windows/Linux. Il
affiche en direct la décision de lecture native ou FFmpeg, les codecs et pistes,
le profil Dolby Vision, le tone mapping, l’encodeur, le processus FFmpeg, les
buffers, la résolution rendue, les images perdues et les dernières sorties du
processus. L’adresse affichée masque les segments intermédiaires afin de ne pas
exposer accidentellement un jeton de téléchargement lors d’une capture.

L’interface détecte par défaut la langue du système et permet de choisir
explicitement l’allemand, l’anglais, l’espagnol, le français, l’italien, le
portugais ou le russe. Pendant une lecture, le survol de la vidéo affiche les
commandes locales de lecture, pause, arrêt, plein écran et déplacement dans le
média. Le panneau de pistes permet de choisir l’audio, la qualité vidéo et les
sous-titres exposés par hls.js. Il est entièrement navigable par la télécommande
Streamshare.

Le logo affiché est copié depuis `assets/logo.svg` à chaque build.
Les assets natifs conservés sont uniquement ceux consommés par le packaging :
le PNG 1024 px exporté depuis Icon Composer sous macOS, l’ICO multirésolution
sous Windows et le jeu de PNG aux tailles Freedesktop sous Linux. Ils sont
préparés dans `dist/icons` et Electron Builder génère les ressources finales du
bundle. Le masque, les marges et le relief du PNG macOS ne sont pas retraités
par le build. L’application packagée laisse macOS lire l’icône du bundle ; le
remplacement dynamique du Dock est réservé au mode de développement. Le projet
éditable `assets/streamshare.icon` reste la source Icon Composer et n’est pas
copié dans l’application distribuée.

## Paquets installables

Electron Builder produit les formats de distribution propres à chaque système :

```bash
pnpm dist:mac
pnpm dist:win
pnpm dist:linux
```

Ces commandes créent respectivement un DMG macOS, un installateur NSIS Windows,
puis une AppImage, un paquet DEB et une archive portable `tar.gz` Linux. Le DEB
est recommandé sous Ubuntu et Debian. L'archive `tar.gz` permet un lancement
portable sur les autres distributions sans dépendre de FUSE. L'AppImage reste
fournie pour les systèmes qui disposent de `libfuse.so.2` ; sur une installation
Ubuntu récente qui ne fournit pas FUSE 2 par défaut, utiliser le DEB ou l'archive
portable.

Les versions de publication doivent être construites sur le système cible :
macOS pour la signature et la notarisation Apple, Windows pour la signature Authenticode, et
Linux pour les paquets AppImage/DEB/tar.gz. La chaîne de publication attachera
les artefacts, sommes SHA-256 et notices de licence à une même release signée.

Les architectures sont explicites dans les scripts `dist:*`. La validation
continue compile et teste le client sans créer de release. La matrice de
plateformes et l'activation des signatures sont décrites dans
[`BUILD_AND_SIGNING.md`](BUILD_AND_SIGNING.md).

## Sécurité

- identité TLS auto-signée persistante et épinglée lors de la découverte ;
- code SAS à deux chiffres affiché localement et jamais transmis au récepteur ;
- jeton aléatoire chiffré avec RSA-OAEP/SHA-256 ;
- seul le condensat SHA-256 du jeton est conservé côté récepteur ;
- accès révocable depuis le panneau de configuration.

## Indépendance et licences

Ce paquet est publié sous licence Apache-2.0 et n’importe aucun code propriétaire
de l’application Streamshare. Il implémente uniquement le
[protocole distant public](https://docs.tootiapps.com/clients/). Cette séparation
permet de publier le client comme projet open source indépendant, sous réserve
de disposer des droits nécessaires sur le nom et les assets de marque. FFmpeg
est exécuté comme programme séparé et ne doit être ajouté aux
paquets publiés qu’après validation de sa configuration de build et de ses
sources correspondantes. Les binaires marqués `--enable-nonfree` sont refusés.
Voir `FFMPEG_DISTRIBUTION.md` et `THIRD_PARTY_NOTICES.md`.
