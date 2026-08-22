export const SUPPORTED_LANGUAGES = ['de', 'en', 'es', 'fr', 'it', 'pt', 'ru'] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type LanguagePreference = SupportedLanguage | 'system';

export interface Messages {
  readyTitle: string;
  readyDescription: string;
  settings: string;
  pairingTitle: string;
  pairingRequested: string;
  pairingHelp: string;
  nowPlaying: string;
  preparingPlayback: string;
  reduce: string;
  fullscreen: string;
  reduceAria: string;
  fullscreenAria: string;
  configuration: string;
  cancel: string;
  remoteReception: string;
  remoteReceptionDescription: string;
  deviceName: string;
  language: string;
  systemLanguage: string;
  authorizedDevices: string;
  save: string;
  saving: string;
  saved: string;
  settingsSaveError: string;
  noAuthorizedDevices: string;
  revoke: string;
  play: string;
  pause: string;
  stop: string;
  playbackControls: string;
  seek: string;
  tracks: string;
  audioTracks: string;
  videoTracks: string;
  subtitleTracks: string;
  automatic: string;
  off: string;
  ffmpegCompatibility: string;
  ffmpegCompatibilityDescription: string;
  ffmpegAvailable: string;
  ffmpegUnavailable: string;
  ffmpegPath: string;
  ffmpegPathDescription: string;
  automaticFfmpeg: string;
  chooseFfmpeg: string;
  externalNonfreeFfmpeg: string;
  invalidFfmpeg: string;
  openDiagnosticLogs: string;
  dolbyVisionMode: string;
  dolbyVisionModeDescription: string;
  dolbyVisionAutomatic: string;
  dolbyVisionNative: string;
  dolbyVisionSdr: string;
  dolbyVisionSdrAvailable: string;
  dolbyVisionSdrUnavailable: string;
  dolbyVisionToneMappingUnavailable: string;
  videoTranscodeResolution: string;
  videoTranscodeResolutionDescription: string;
  videoTranscodeSource: string;
  videoTranscode2160p: string;
  videoTranscode1080p: string;
  videoTranscode720p: string;
  unsupportedFormat: string;
  loadError: string;
  fileMenu: string;
  viewMenu: string;
  technicalInformation: string;
  openNetworkStream: string;
  networkStreamUrl: string;
  networkStreamUrlDescription: string;
  invalidNetworkStreamUrl: string;
  dolbyVisionUnsupported: string;
  open: string;
  showApp: string;
  quit: string;
  about: string;
  aboutDescription: string;
}

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский'
};

const translations: Record<SupportedLanguage, Messages> = {
  en: {
    readyTitle: 'Ready to receive playback',
    readyDescription: 'From Streamshare on your phone or tablet, choose “Streamshare TV Client”, then select this device.',
    settings: 'Settings', pairingTitle: 'Pairing code', pairingRequested: 'Code requested by {name}',
    pairingHelp: 'Enter this code in the Streamshare application.', nowPlaying: 'Streamshare playback', preparingPlayback: 'Preparing playback…',
    reduce: 'Reduce', fullscreen: 'Fullscreen', reduceAria: 'Reduce playback', fullscreenAria: 'Show fullscreen',
    configuration: 'Settings', cancel: 'Cancel', remoteReception: 'Remote playback receiver',
    remoteReceptionDescription: 'Advertise this client on the local network.', deviceName: 'Device name',
    language: 'Language', systemLanguage: 'System default', authorizedDevices: 'Authorized devices', save: 'Save', saving: 'Saving…', saved: 'Saved', settingsSaveError: 'Unable to save settings.',
    noAuthorizedDevices: 'No authorized devices', revoke: 'Revoke', play: 'Play', pause: 'Pause', stop: 'Stop', playbackControls: 'Playback controls',
    seek: 'Playback position', tracks: 'Tracks', audioTracks: 'Audio', videoTracks: 'Quality', subtitleTracks: 'Subtitles', automatic: 'Auto', off: 'Off', unsupportedFormat: 'This format or codec is not supported on this system',
    ffmpegCompatibility: 'FFmpeg compatibility mode', ffmpegCompatibilityDescription: 'Automatically handle unsupported video, audio and subtitle formats.', ffmpegAvailable: 'Available: {version} — {path}', ffmpegUnavailable: 'Unavailable: {path}',
    ffmpegPath: 'FFmpeg location', ffmpegPathDescription: 'Use the bundled version automatically, or select an external ffmpeg executable.', automaticFfmpeg: 'Automatic (bundled version)', chooseFfmpeg: 'Choose FFmpeg…', externalNonfreeFfmpeg: 'This external build uses nonfree components. Streamshare does not redistribute it.', invalidFfmpeg: 'FFmpeg and FFprobe could not be validated.', openDiagnosticLogs: 'Open logs folder',
    dolbyVisionMode: 'Dolby Vision Profile 5', dolbyVisionModeDescription: 'Choose how Profile 5 is handled when FFmpeg compatibility mode is enabled.', dolbyVisionAutomatic: 'Automatic (recommended)', dolbyVisionNative: 'Always use native playback', dolbyVisionSdr: 'Always convert to SDR', dolbyVisionSdrAvailable: 'SDR conversion is available through libplacebo.', dolbyVisionSdrUnavailable: 'SDR conversion is unavailable with the selected FFmpeg build.', dolbyVisionToneMappingUnavailable: 'Native Dolby Vision playback is not supported and this FFmpeg build cannot convert it to SDR. Select an FFmpeg build with libplacebo or force native playback in Settings.',
    videoTranscodeResolution: 'Video conversion quality', videoTranscodeResolutionDescription: 'Keep the source resolution or limit conversion to reduce GPU usage.', videoTranscodeSource: 'Original resolution (best quality)', videoTranscode2160p: 'Up to 2160p', videoTranscode1080p: 'Up to 1080p', videoTranscode720p: 'Up to 720p',
    loadError: 'Playback error', fileMenu: 'File', viewMenu: 'View', technicalInformation: 'Technical information', openNetworkStream: 'Open network stream…', networkStreamUrl: 'Network stream URL', networkStreamUrlDescription: 'Enter an HTTP or HTTPS media address.', invalidNetworkStreamUrl: 'Enter a valid HTTP or HTTPS address.', dolbyVisionUnsupported: 'This Dolby Vision Profile 5 video requires GPU tone mapping, which is unavailable on this system.', open: 'Open', showApp: 'Show Streamshare TV', quit: 'Quit',
    about: 'About Streamshare TV Client', aboutDescription: 'Open-source Streamshare remote playback receiver.'
  },
  fr: {
    readyTitle: 'Prêt à recevoir une lecture',
    readyDescription: 'Depuis Streamshare sur votre téléphone ou tablette, choisissez « Streamshare TV Client », puis sélectionnez cet appareil.',
    settings: 'Configuration', pairingTitle: 'Code d’appairage', pairingRequested: 'Code demandé par {name}',
    pairingHelp: 'Saisissez ce code dans l’application Streamshare.', nowPlaying: 'Lecture Streamshare', preparingPlayback: 'Préparation de la lecture…',
    reduce: 'Réduire', fullscreen: 'Plein écran', reduceAria: 'Réduire la lecture', fullscreenAria: 'Afficher en plein écran',
    configuration: 'Configuration', cancel: 'Annuler', remoteReception: 'Réception distante',
    remoteReceptionDescription: 'Annonce ce client sur le réseau local.', deviceName: 'Nom de l’appareil',
    language: 'Langue', systemLanguage: 'Langue du système', authorizedDevices: 'Appareils autorisés', save: 'Enregistrer', saving: 'Enregistrement…', saved: 'Enregistré', settingsSaveError: 'Impossible d’enregistrer les réglages.',
    noAuthorizedDevices: 'Aucun appareil autorisé', revoke: 'Révoquer', play: 'Lecture', pause: 'Pause', stop: 'Arrêter', playbackControls: 'Contrôles de lecture',
    seek: 'Position de lecture', tracks: 'Pistes', audioTracks: 'Audio', videoTracks: 'Qualité', subtitleTracks: 'Sous-titres', automatic: 'Auto', off: 'Désactivés', unsupportedFormat: 'Format ou codec non pris en charge par ce système',
    ffmpegCompatibility: 'Mode de compatibilité FFmpeg', ffmpegCompatibilityDescription: 'Prend automatiquement en charge les formats vidéo, audio et de sous-titres incompatibles.', ffmpegAvailable: 'Disponible : {version} — {path}', ffmpegUnavailable: 'Indisponible : {path}',
    ffmpegPath: 'Emplacement de FFmpeg', ffmpegPathDescription: 'Utilisez automatiquement la version intégrée ou sélectionnez un exécutable ffmpeg externe.', automaticFfmpeg: 'Automatique (version intégrée)', chooseFfmpeg: 'Choisir FFmpeg…', externalNonfreeFfmpeg: 'Cette version externe utilise des composants non libres. Streamshare ne la redistribue pas.', invalidFfmpeg: 'FFmpeg et FFprobe n’ont pas pu être validés.', openDiagnosticLogs: 'Ouvrir le dossier des journaux',
    dolbyVisionMode: 'Dolby Vision profil 5', dolbyVisionModeDescription: 'Choisissez le traitement du profil 5 lorsque le mode de compatibilité FFmpeg est activé.', dolbyVisionAutomatic: 'Automatique (recommandé)', dolbyVisionNative: 'Toujours utiliser la lecture native', dolbyVisionSdr: 'Toujours convertir en SDR', dolbyVisionSdrAvailable: 'La conversion SDR est disponible grâce à libplacebo.', dolbyVisionSdrUnavailable: 'La conversion SDR est indisponible avec la version de FFmpeg sélectionnée.', dolbyVisionToneMappingUnavailable: 'La lecture Dolby Vision native n’est pas prise en charge et cette version de FFmpeg ne peut pas convertir en SDR. Sélectionnez une version avec libplacebo ou forcez la lecture native dans les réglages.',
    videoTranscodeResolution: 'Qualité de conversion vidéo', videoTranscodeResolutionDescription: 'Conservez la résolution du fichier ou limitez la conversion pour réduire la charge du GPU.', videoTranscodeSource: 'Résolution originale (meilleure qualité)', videoTranscode2160p: 'Jusqu’à 2160p', videoTranscode1080p: 'Jusqu’à 1080p', videoTranscode720p: 'Jusqu’à 720p',
    loadError: 'Erreur de lecture', fileMenu: 'Fichier', viewMenu: 'Présentation', technicalInformation: 'Informations techniques', openNetworkStream: 'Ouvrir un flux réseau…', networkStreamUrl: 'URL du flux réseau', networkStreamUrlDescription: 'Saisissez une adresse HTTP ou HTTPS vers un média.', invalidNetworkStreamUrl: 'Saisissez une adresse HTTP ou HTTPS valide.', dolbyVisionUnsupported: 'Cette vidéo Dolby Vision profil 5 nécessite une conversion des couleurs par le GPU, indisponible sur ce système.', open: 'Ouvrir', showApp: 'Afficher Streamshare TV', quit: 'Quitter',
    about: 'À propos de Streamshare TV Client', aboutDescription: 'Récepteur open source de lecture distante Streamshare.'
  },
  de: {
    readyTitle: 'Bereit für die Wiedergabe',
    readyDescription: 'Wählen Sie in Streamshare auf Ihrem Smartphone oder Tablet „Streamshare TV Client“ und anschließend dieses Gerät aus.',
    settings: 'Einstellungen', pairingTitle: 'Kopplungscode', pairingRequested: 'Code angefordert von {name}',
    pairingHelp: 'Geben Sie diesen Code in der Streamshare-App ein.', nowPlaying: 'Streamshare-Wiedergabe', preparingPlayback: 'Wiedergabe wird vorbereitet…',
    reduce: 'Verkleinern', fullscreen: 'Vollbild', reduceAria: 'Wiedergabe verkleinern', fullscreenAria: 'Im Vollbild anzeigen',
    configuration: 'Einstellungen', cancel: 'Abbrechen', remoteReception: 'Remote-Wiedergabe',
    remoteReceptionDescription: 'Diesen Client im lokalen Netzwerk ankündigen.', deviceName: 'Gerätename',
    language: 'Sprache', systemLanguage: 'Systemsprache', authorizedDevices: 'Autorisierte Geräte', save: 'Speichern', saving: 'Wird gespeichert…', saved: 'Gespeichert', settingsSaveError: 'Einstellungen konnten nicht gespeichert werden.',
    noAuthorizedDevices: 'Keine autorisierten Geräte', revoke: 'Widerrufen', play: 'Wiedergabe', pause: 'Pause', stop: 'Stopp', playbackControls: 'Wiedergabesteuerung',
    seek: 'Wiedergabeposition', tracks: 'Spuren', audioTracks: 'Audio', videoTracks: 'Qualität', subtitleTracks: 'Untertitel', automatic: 'Automatisch', off: 'Aus', unsupportedFormat: 'Dieses Format oder dieser Codec wird auf diesem System nicht unterstützt',
    ffmpegCompatibility: 'FFmpeg-Kompatibilitätsmodus', ffmpegCompatibilityDescription: 'Verarbeitet nicht unterstützte Video-, Audio- und Untertitelformate automatisch.', ffmpegAvailable: 'Verfügbar: {version} — {path}', ffmpegUnavailable: 'Nicht verfügbar: {path}',
    ffmpegPath: 'FFmpeg-Speicherort', ffmpegPathDescription: 'Automatisch die integrierte Version verwenden oder eine externe ffmpeg-Datei auswählen.', automaticFfmpeg: 'Automatisch (integrierte Version)', chooseFfmpeg: 'FFmpeg auswählen…', externalNonfreeFfmpeg: 'Dieser externe Build verwendet nicht freie Komponenten. Streamshare verteilt ihn nicht.', invalidFfmpeg: 'FFmpeg und FFprobe konnten nicht überprüft werden.', openDiagnosticLogs: 'Protokollordner öffnen',
    dolbyVisionMode: 'Dolby Vision Profil 5', dolbyVisionModeDescription: 'Wählen Sie die Behandlung von Profil 5 im FFmpeg-Kompatibilitätsmodus.', dolbyVisionAutomatic: 'Automatisch (empfohlen)', dolbyVisionNative: 'Immer native Wiedergabe', dolbyVisionSdr: 'Immer in SDR konvertieren', dolbyVisionSdrAvailable: 'SDR-Konvertierung ist über libplacebo verfügbar.', dolbyVisionSdrUnavailable: 'SDR-Konvertierung ist mit dem ausgewählten FFmpeg-Build nicht verfügbar.', dolbyVisionToneMappingUnavailable: 'Native Dolby-Vision-Wiedergabe wird nicht unterstützt und dieses FFmpeg kann nicht in SDR konvertieren. Wählen Sie FFmpeg mit libplacebo oder erzwingen Sie die native Wiedergabe.',
    videoTranscodeResolution: 'Qualität der Videokonvertierung', videoTranscodeResolutionDescription: 'Quellauflösung beibehalten oder die Konvertierung begrenzen, um die GPU zu entlasten.', videoTranscodeSource: 'Originalauflösung (beste Qualität)', videoTranscode2160p: 'Bis 2160p', videoTranscode1080p: 'Bis 1080p', videoTranscode720p: 'Bis 720p',
    loadError: 'Wiedergabefehler', fileMenu: 'Datei', viewMenu: 'Ansicht', technicalInformation: 'Technische Informationen', openNetworkStream: 'Netzwerkstream öffnen…', networkStreamUrl: 'Netzwerkstream-URL', networkStreamUrlDescription: 'Geben Sie eine HTTP- oder HTTPS-Medienadresse ein.', invalidNetworkStreamUrl: 'Geben Sie eine gültige HTTP- oder HTTPS-Adresse ein.', dolbyVisionUnsupported: 'Dieses Dolby-Vision-Profil-5-Video benötigt eine GPU-Farbkonvertierung, die auf diesem System nicht verfügbar ist.', open: 'Öffnen', showApp: 'Streamshare TV anzeigen', quit: 'Beenden',
    about: 'Über Streamshare TV Client', aboutDescription: 'Open-Source-Empfänger für die Streamshare-Remote-Wiedergabe.'
  },
  es: {
    readyTitle: 'Listo para recibir una reproducción',
    readyDescription: 'Desde Streamshare en tu teléfono o tableta, elige «Streamshare TV Client» y selecciona este dispositivo.',
    settings: 'Configuración', pairingTitle: 'Código de emparejamiento', pairingRequested: 'Código solicitado por {name}',
    pairingHelp: 'Introduce este código en la aplicación Streamshare.', nowPlaying: 'Reproducción de Streamshare', preparingPlayback: 'Preparando la reproducción…',
    reduce: 'Reducir', fullscreen: 'Pantalla completa', reduceAria: 'Reducir la reproducción', fullscreenAria: 'Mostrar en pantalla completa',
    configuration: 'Configuración', cancel: 'Cancelar', remoteReception: 'Reproducción remota',
    remoteReceptionDescription: 'Anuncia este cliente en la red local.', deviceName: 'Nombre del dispositivo',
    language: 'Idioma', systemLanguage: 'Idioma del sistema', authorizedDevices: 'Dispositivos autorizados', save: 'Guardar', saving: 'Guardando…', saved: 'Guardado', settingsSaveError: 'No se pudo guardar la configuración.',
    noAuthorizedDevices: 'No hay dispositivos autorizados', revoke: 'Revocar', play: 'Reproducir', pause: 'Pausa', stop: 'Detener', playbackControls: 'Controles de reproducción',
    seek: 'Posición de reproducción', tracks: 'Pistas', audioTracks: 'Audio', videoTracks: 'Calidad', subtitleTracks: 'Subtítulos', automatic: 'Auto', off: 'Desactivados', unsupportedFormat: 'Este formato o códec no es compatible con el sistema',
    ffmpegCompatibility: 'Modo de compatibilidad FFmpeg', ffmpegCompatibilityDescription: 'Gestiona automáticamente formatos de vídeo, audio y subtítulos no compatibles.', ffmpegAvailable: 'Disponible: {version} — {path}', ffmpegUnavailable: 'No disponible: {path}',
    ffmpegPath: 'Ubicación de FFmpeg', ffmpegPathDescription: 'Usa automáticamente la versión integrada o selecciona un ejecutable ffmpeg externo.', automaticFfmpeg: 'Automático (versión integrada)', chooseFfmpeg: 'Elegir FFmpeg…', externalNonfreeFfmpeg: 'Esta compilación externa usa componentes no libres. Streamshare no la redistribuye.', invalidFfmpeg: 'No se pudieron validar FFmpeg y FFprobe.', openDiagnosticLogs: 'Abrir carpeta de registros',
    dolbyVisionMode: 'Dolby Vision perfil 5', dolbyVisionModeDescription: 'Elige cómo tratar el perfil 5 con el modo de compatibilidad FFmpeg.', dolbyVisionAutomatic: 'Automático (recomendado)', dolbyVisionNative: 'Usar siempre reproducción nativa', dolbyVisionSdr: 'Convertir siempre a SDR', dolbyVisionSdrAvailable: 'La conversión SDR está disponible mediante libplacebo.', dolbyVisionSdrUnavailable: 'La conversión SDR no está disponible con el FFmpeg seleccionado.', dolbyVisionToneMappingUnavailable: 'La reproducción Dolby Vision nativa no es compatible y este FFmpeg no puede convertir a SDR. Selecciona FFmpeg con libplacebo o fuerza la reproducción nativa.',
    videoTranscodeResolution: 'Calidad de conversión de vídeo', videoTranscodeResolutionDescription: 'Mantén la resolución original o limita la conversión para reducir el uso de la GPU.', videoTranscodeSource: 'Resolución original (mejor calidad)', videoTranscode2160p: 'Hasta 2160p', videoTranscode1080p: 'Hasta 1080p', videoTranscode720p: 'Hasta 720p',
    loadError: 'Error de reproducción', fileMenu: 'Archivo', viewMenu: 'Ver', technicalInformation: 'Información técnica', openNetworkStream: 'Abrir flujo de red…', networkStreamUrl: 'URL del flujo de red', networkStreamUrlDescription: 'Introduce una dirección multimedia HTTP o HTTPS.', invalidNetworkStreamUrl: 'Introduce una dirección HTTP o HTTPS válida.', dolbyVisionUnsupported: 'Este vídeo Dolby Vision perfil 5 requiere conversión de color por GPU, no disponible en este sistema.', open: 'Abrir', showApp: 'Mostrar Streamshare TV', quit: 'Salir',
    about: 'Acerca de Streamshare TV Client', aboutDescription: 'Receptor de reproducción remota Streamshare de código abierto.'
  },
  it: {
    readyTitle: 'Pronto a ricevere una riproduzione',
    readyDescription: 'Da Streamshare sul telefono o tablet, scegli «Streamshare TV Client» e seleziona questo dispositivo.',
    settings: 'Impostazioni', pairingTitle: 'Codice di associazione', pairingRequested: 'Codice richiesto da {name}',
    pairingHelp: 'Inserisci questo codice nell’app Streamshare.', nowPlaying: 'Riproduzione Streamshare', preparingPlayback: 'Preparazione della riproduzione…',
    reduce: 'Riduci', fullscreen: 'Schermo intero', reduceAria: 'Riduci la riproduzione', fullscreenAria: 'Mostra a schermo intero',
    configuration: 'Impostazioni', cancel: 'Annulla', remoteReception: 'Riproduzione remota',
    remoteReceptionDescription: 'Annuncia questo client sulla rete locale.', deviceName: 'Nome del dispositivo',
    language: 'Lingua', systemLanguage: 'Lingua di sistema', authorizedDevices: 'Dispositivi autorizzati', save: 'Salva', saving: 'Salvataggio…', saved: 'Salvato', settingsSaveError: 'Impossibile salvare le impostazioni.',
    noAuthorizedDevices: 'Nessun dispositivo autorizzato', revoke: 'Revoca', play: 'Riproduci', pause: 'Pausa', stop: 'Interrompi', playbackControls: 'Controlli di riproduzione',
    seek: 'Posizione di riproduzione', tracks: 'Tracce', audioTracks: 'Audio', videoTracks: 'Qualità', subtitleTracks: 'Sottotitoli', automatic: 'Auto', off: 'Disattivati', unsupportedFormat: 'Formato o codec non supportato da questo sistema',
    ffmpegCompatibility: 'Modalità compatibilità FFmpeg', ffmpegCompatibilityDescription: 'Gestisce automaticamente i formati video, audio e sottotitoli non supportati.', ffmpegAvailable: 'Disponibile: {version} — {path}', ffmpegUnavailable: 'Non disponibile: {path}',
    ffmpegPath: 'Posizione di FFmpeg', ffmpegPathDescription: 'Usa automaticamente la versione integrata o seleziona un eseguibile ffmpeg esterno.', automaticFfmpeg: 'Automatica (versione integrata)', chooseFfmpeg: 'Scegli FFmpeg…', externalNonfreeFfmpeg: 'Questa build esterna usa componenti non liberi. Streamshare non la ridistribuisce.', invalidFfmpeg: 'Non è stato possibile convalidare FFmpeg e FFprobe.', openDiagnosticLogs: 'Apri cartella dei log',
    dolbyVisionMode: 'Dolby Vision profilo 5', dolbyVisionModeDescription: 'Scegli come gestire il profilo 5 con la modalità compatibilità FFmpeg.', dolbyVisionAutomatic: 'Automatica (consigliata)', dolbyVisionNative: 'Usa sempre la riproduzione nativa', dolbyVisionSdr: 'Converti sempre in SDR', dolbyVisionSdrAvailable: 'La conversione SDR è disponibile tramite libplacebo.', dolbyVisionSdrUnavailable: 'La conversione SDR non è disponibile con FFmpeg selezionato.', dolbyVisionToneMappingUnavailable: 'La riproduzione Dolby Vision nativa non è supportata e questo FFmpeg non può convertire in SDR. Seleziona FFmpeg con libplacebo o forza la riproduzione nativa.',
    videoTranscodeResolution: 'Qualità di conversione video', videoTranscodeResolutionDescription: 'Mantieni la risoluzione originale o limita la conversione per ridurre l’uso della GPU.', videoTranscodeSource: 'Risoluzione originale (qualità migliore)', videoTranscode2160p: 'Fino a 2160p', videoTranscode1080p: 'Fino a 1080p', videoTranscode720p: 'Fino a 720p',
    loadError: 'Errore di riproduzione', fileMenu: 'File', viewMenu: 'Vista', technicalInformation: 'Informazioni tecniche', openNetworkStream: 'Apri flusso di rete…', networkStreamUrl: 'URL del flusso di rete', networkStreamUrlDescription: 'Inserisci un indirizzo multimediale HTTP o HTTPS.', invalidNetworkStreamUrl: 'Inserisci un indirizzo HTTP o HTTPS valido.', dolbyVisionUnsupported: 'Questo video Dolby Vision profilo 5 richiede la conversione colore tramite GPU, non disponibile su questo sistema.', open: 'Apri', showApp: 'Mostra Streamshare TV', quit: 'Esci',
    about: 'Informazioni su Streamshare TV Client', aboutDescription: 'Ricevitore open source per la riproduzione remota Streamshare.'
  },
  pt: {
    readyTitle: 'Pronto para receber uma reprodução',
    readyDescription: 'No Streamshare do telemóvel ou tablet, escolha «Streamshare TV Client» e selecione este dispositivo.',
    settings: 'Definições', pairingTitle: 'Código de emparelhamento', pairingRequested: 'Código pedido por {name}',
    pairingHelp: 'Introduza este código na aplicação Streamshare.', nowPlaying: 'Reprodução Streamshare', preparingPlayback: 'A preparar a reprodução…',
    reduce: 'Reduzir', fullscreen: 'Ecrã inteiro', reduceAria: 'Reduzir a reprodução', fullscreenAria: 'Mostrar em ecrã inteiro',
    configuration: 'Definições', cancel: 'Cancelar', remoteReception: 'Reprodução remota',
    remoteReceptionDescription: 'Anuncia este cliente na rede local.', deviceName: 'Nome do dispositivo',
    language: 'Idioma', systemLanguage: 'Idioma do sistema', authorizedDevices: 'Dispositivos autorizados', save: 'Guardar', saving: 'A guardar…', saved: 'Guardado', settingsSaveError: 'Não foi possível guardar as definições.',
    noAuthorizedDevices: 'Nenhum dispositivo autorizado', revoke: 'Revogar', play: 'Reproduzir', pause: 'Pausa', stop: 'Parar', playbackControls: 'Controlos de reprodução',
    seek: 'Posição de reprodução', tracks: 'Faixas', audioTracks: 'Áudio', videoTracks: 'Qualidade', subtitleTracks: 'Legendas', automatic: 'Auto', off: 'Desativadas', unsupportedFormat: 'Formato ou codec não suportado por este sistema',
    ffmpegCompatibility: 'Modo de compatibilidade FFmpeg', ffmpegCompatibilityDescription: 'Processa automaticamente formatos de vídeo, áudio e legendas não suportados.', ffmpegAvailable: 'Disponível: {version} — {path}', ffmpegUnavailable: 'Indisponível: {path}',
    ffmpegPath: 'Localização do FFmpeg', ffmpegPathDescription: 'Use automaticamente a versão integrada ou selecione um executável ffmpeg externo.', automaticFfmpeg: 'Automático (versão integrada)', chooseFfmpeg: 'Escolher FFmpeg…', externalNonfreeFfmpeg: 'Esta compilação externa usa componentes não livres. O Streamshare não a redistribui.', invalidFfmpeg: 'Não foi possível validar o FFmpeg e o FFprobe.', openDiagnosticLogs: 'Abrir pasta de registos',
    dolbyVisionMode: 'Dolby Vision perfil 5', dolbyVisionModeDescription: 'Escolha como tratar o perfil 5 no modo de compatibilidade FFmpeg.', dolbyVisionAutomatic: 'Automático (recomendado)', dolbyVisionNative: 'Usar sempre reprodução nativa', dolbyVisionSdr: 'Converter sempre para SDR', dolbyVisionSdrAvailable: 'A conversão SDR está disponível através do libplacebo.', dolbyVisionSdrUnavailable: 'A conversão SDR não está disponível com o FFmpeg selecionado.', dolbyVisionToneMappingUnavailable: 'A reprodução Dolby Vision nativa não é suportada e este FFmpeg não pode converter para SDR. Selecione FFmpeg com libplacebo ou force a reprodução nativa.',
    videoTranscodeResolution: 'Qualidade da conversão de vídeo', videoTranscodeResolutionDescription: 'Mantenha a resolução original ou limite a conversão para reduzir a utilização da GPU.', videoTranscodeSource: 'Resolução original (melhor qualidade)', videoTranscode2160p: 'Até 2160p', videoTranscode1080p: 'Até 1080p', videoTranscode720p: 'Até 720p',
    loadError: 'Erro de reprodução', fileMenu: 'Ficheiro', viewMenu: 'Ver', technicalInformation: 'Informações técnicas', openNetworkStream: 'Abrir fluxo de rede…', networkStreamUrl: 'URL do fluxo de rede', networkStreamUrlDescription: 'Introduza um endereço multimédia HTTP ou HTTPS.', invalidNetworkStreamUrl: 'Introduza um endereço HTTP ou HTTPS válido.', dolbyVisionUnsupported: 'Este vídeo Dolby Vision perfil 5 requer conversão de cor pela GPU, indisponível neste sistema.', open: 'Abrir', showApp: 'Mostrar Streamshare TV', quit: 'Sair',
    about: 'Acerca do Streamshare TV Client', aboutDescription: 'Recetor open source de reprodução remota Streamshare.'
  },
  ru: {
    readyTitle: 'Готово к удалённому воспроизведению',
    readyDescription: 'В приложении Streamshare на телефоне или планшете выберите «Streamshare TV Client», затем это устройство.',
    settings: 'Настройки', pairingTitle: 'Код сопряжения', pairingRequested: 'Код запрошен устройством {name}',
    pairingHelp: 'Введите этот код в приложении Streamshare.', nowPlaying: 'Воспроизведение Streamshare', preparingPlayback: 'Подготовка воспроизведения…',
    reduce: 'Свернуть', fullscreen: 'Во весь экран', reduceAria: 'Уменьшить окно воспроизведения', fullscreenAria: 'Показать во весь экран',
    configuration: 'Настройки', cancel: 'Отмена', remoteReception: 'Удалённое воспроизведение',
    remoteReceptionDescription: 'Объявлять этот клиент в локальной сети.', deviceName: 'Имя устройства',
    language: 'Язык', systemLanguage: 'Язык системы', authorizedDevices: 'Разрешённые устройства', save: 'Сохранить', saving: 'Сохранение…', saved: 'Сохранено', settingsSaveError: 'Не удалось сохранить настройки.',
    noAuthorizedDevices: 'Нет разрешённых устройств', revoke: 'Отозвать', play: 'Воспроизвести', pause: 'Пауза', stop: 'Остановить', playbackControls: 'Управление воспроизведением',
    seek: 'Позиция воспроизведения', tracks: 'Дорожки', audioTracks: 'Аудио', videoTracks: 'Качество', subtitleTracks: 'Субтитры', automatic: 'Авто', off: 'Выкл.', unsupportedFormat: 'Этот формат или кодек не поддерживается системой',
    ffmpegCompatibility: 'Режим совместимости FFmpeg', ffmpegCompatibilityDescription: 'Автоматически обрабатывает неподдерживаемые форматы видео, аудио и субтитров.', ffmpegAvailable: 'Доступно: {version} — {path}', ffmpegUnavailable: 'Недоступно: {path}',
    ffmpegPath: 'Расположение FFmpeg', ffmpegPathDescription: 'Используйте встроенную версию автоматически или выберите внешний файл ffmpeg.', automaticFfmpeg: 'Автоматически (встроенная версия)', chooseFfmpeg: 'Выбрать FFmpeg…', externalNonfreeFfmpeg: 'Эта внешняя сборка использует несвободные компоненты. Streamshare её не распространяет.', invalidFfmpeg: 'Не удалось проверить FFmpeg и FFprobe.', openDiagnosticLogs: 'Открыть папку журналов',
    dolbyVisionMode: 'Dolby Vision, профиль 5', dolbyVisionModeDescription: 'Выберите обработку профиля 5 в режиме совместимости FFmpeg.', dolbyVisionAutomatic: 'Автоматически (рекомендуется)', dolbyVisionNative: 'Всегда использовать нативное воспроизведение', dolbyVisionSdr: 'Всегда преобразовывать в SDR', dolbyVisionSdrAvailable: 'Преобразование SDR доступно через libplacebo.', dolbyVisionSdrUnavailable: 'Преобразование SDR недоступно в выбранной сборке FFmpeg.', dolbyVisionToneMappingUnavailable: 'Нативное воспроизведение Dolby Vision не поддерживается, а этот FFmpeg не может преобразовать видео в SDR. Выберите FFmpeg с libplacebo или принудительно включите нативное воспроизведение.',
    videoTranscodeResolution: 'Качество преобразования видео', videoTranscodeResolutionDescription: 'Сохраняйте исходное разрешение или ограничьте его, чтобы снизить нагрузку на GPU.', videoTranscodeSource: 'Исходное разрешение (лучшее качество)', videoTranscode2160p: 'До 2160p', videoTranscode1080p: 'До 1080p', videoTranscode720p: 'До 720p',
    loadError: 'Ошибка воспроизведения', fileMenu: 'Файл', viewMenu: 'Вид', technicalInformation: 'Техническая информация', openNetworkStream: 'Открыть сетевой поток…', networkStreamUrl: 'URL сетевого потока', networkStreamUrlDescription: 'Введите HTTP- или HTTPS-адрес медиафайла.', invalidNetworkStreamUrl: 'Введите корректный HTTP- или HTTPS-адрес.', dolbyVisionUnsupported: 'Это видео Dolby Vision профиля 5 требует преобразования цвета на GPU, недоступного в этой системе.', open: 'Открыть', showApp: 'Показать Streamshare TV', quit: 'Выйти',
    about: 'О Streamshare TV Client', aboutDescription: 'Открытый клиент удалённого воспроизведения Streamshare.'
  }
};

export function resolveLanguage(preference: LanguagePreference, preferredLocales: readonly string[]): SupportedLanguage {
  if (preference !== 'system') return preference;
  for (const locale of preferredLocales) {
    const language = locale.toLowerCase().split(/[-_]/)[0] as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(language)) return language;
  }
  return 'en';
}

export function translate(
  language: SupportedLanguage,
  key: keyof Messages,
  values: Record<string, string | number> = {}
): string {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    translations[language][key]
  );
}
