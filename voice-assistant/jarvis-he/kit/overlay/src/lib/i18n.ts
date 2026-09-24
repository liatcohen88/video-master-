/**
 * Three languages, one table.
 *
 * No i18n library. There are three locales and about sixty strings, all of them
 * ours, and nothing here needs plurals, gendered agreement or date formats —
 * the one place that formats a number reads it through the speech synthesiser,
 * not through Intl. A library would add a dependency, a loader and a key
 * namespace to solve problems this screen does not have.
 *
 * The table is typed off the English side, so a missing Portuguese key is a
 * build error rather than an English word appearing mid-sentence in a demo.
 *
 * What this does NOT cover, on purpose:
 *   - The boot log (Boot.tsx). It is set dressing pretending to be a mainframe,
 *     not language, and `CHECKSUM ..... OK` reads the same in both.
 *   - JARVIS's own answers. Nothing tells the model what to speak; it follows
 *     whoever is talking to it, which is the behaviour you want and is already
 *     steered by the transcription language.
 */

export type Lang = 'en' | 'pt' | 'he'

const en = {
  // Phase readout, centre of the HUD.
  statusOffline: 'OFFLINE',
  statusBoot: 'INITIALISING',
  statusDormant: 'STANDBY — SAY “HEY JAMES” OR CLAP TWICE',
  statusWaking: 'ONLINE',
  statusListening: 'LISTENING',
  statusThinking: 'PROCESSING',
  statusTooling: 'ACCESSING SYSTEMS',
  statusSpeaking: 'RESPONDING',

  // Rails and controls.
  signal: 'SIGNAL',
  muted: 'MUTED',
  noInput: 'NO INPUT',
  micOn: 'MIC ON',
  micOff: 'MIC OFF',
  noiseStrict: 'NOISE STRICT',
  noiseStandard: 'NOISE STD',
  speakerYou: 'YOU',
  speakerJarvis: 'JAMES',
  screenShare: 'Screen share',
  camera: 'Camera',
  handControl: 'HAND CONTROL',
  initialise: 'INITIALISE',
  ignitionHint: 'click, or clap, to power up',
  skipBoot: 'Skip boot up',

  // Settings panel.
  settingsModel: 'Model',
  settingsEffort: 'Effort',
  settingsLanguage: 'Language',
  settingsNoise: 'Noise guard',
  settingsConversation: 'Conversation',
  settingsCurrent: 'Current',
  settingsDefault: 'Default',
  settingsDefaultFromSettings: 'Default (from settings)',
  noiseStandardOption: 'Standard',
  noiseStrictOption: 'Strict (nothing heard while he speaks)',
  newConversation: 'NEW CONVERSATION',
  newConversationHint: 'Forget this conversation and start over',
  resumeHint: 'Go back to an earlier conversation',
  resumedNote: 'resumed from last time',
  freshNote: 'fresh session',

  // Gesture guide.
  gesturePoint: 'move the cursor',
  gesturePinch: 'grab a blade · move it · press',
  gestureOpen: 'let go',
  gesturePeace: 'two fingers up-down to scroll',
  gestureFrame: 'two L-corners to resize',

  // Notices and errors.
  errGeneric: 'Something went wrong.',
  errNoAudio: 'No audio from the microphone — check it is not in use elsewhere, or reload.',
  errPowerUp: 'Power-up failed. Click to try again.',
  errMicDenied: 'Microphone access denied — voice input is unavailable.',
  errMicRefused: 'Microphone access was refused — voice input is unavailable.',
  errNoMic: 'No microphone available.',
  errNoRecorder: 'This browser cannot record audio — voice input is unavailable.',
  errNoRecognition:
    'This browser has no speech recognition — use Chrome or Edge, or run the bridge for transcription.',
  errCameraDenied: 'Camera access denied — gesture control is unavailable.',
  errCameraNotPermitted: 'The camera is not permitted, so I cannot see anything.',
  errNoFootage:
    'There is no recent footage — the camera has to be open on screen ' +
    'for me to remember what just happened. Ask me to open the camera, ' +
    'and I can watch from then on.',
  errShortFootage: 'There is not enough recent footage to review.',
  errScreenCancelled: 'Screen sharing was cancelled.',
  errCameraNotAllowed: 'Camera access is not permitted.',
  noticeBridgeLost: 'Bridge connection lost — reconnecting.',
  noticeBridgeBack: 'Bridge reconnected. The previous conversation was not kept.',
  audioTest: 'Audio test. If you can hear this, speech output is working, sir.',
  settingsSpeed: 'Speaking rate',
  settingsGap: 'Pause between sentences',
  speedNormal: 'normal',
  voiceOn: 'VOICE ON',
  voiceOff: 'VOICE OFF',
  voiceMuteHint: 'Silence his voice — answers still appear on screen (V)',
  creditsLabel: 'VOICE BUDGET',
  creditsSpent: 'BUDGET SPENT',
  noticeQuotaSpent:
    'The speech budget is spent, so his voice is off. Answers still appear on screen.',
  imageUnavailable: 'image unavailable',
  videoUnavailable: 'video unavailable',
  noticeNoHebrewVoice:
    'No Hebrew voice is installed, so he cannot speak Hebrew. Add one in Windows Settings → ' +
    'Time & language → Speech → Add voices → Hebrew, then reload the page.',
} as const

export type StringKey = keyof typeof en

const pt: Record<StringKey, string> = {
  statusOffline: 'DESLIGADO',
  statusBoot: 'INICIALIZANDO',
  statusDormant: 'EM ESPERA — DIGA “EI JAMES” OU BATA PALMAS DUAS VEZES',
  statusWaking: 'ONLINE',
  statusListening: 'OUVINDO',
  statusThinking: 'PROCESSANDO',
  statusTooling: 'ACESSANDO SISTEMAS',
  statusSpeaking: 'RESPONDENDO',

  signal: 'SINAL',
  muted: 'MUDO',
  noInput: 'SEM ÁUDIO',
  micOn: 'MIC LIGADO',
  micOff: 'MIC DESLIGADO',
  noiseStrict: 'RUÍDO ESTRITO',
  noiseStandard: 'RUÍDO PADRÃO',
  speakerYou: 'VOCÊ',
  speakerJarvis: 'JAMES',
  screenShare: 'Compartilhar tela',
  camera: 'Câmera',
  handControl: 'CONTROLE POR GESTOS',
  initialise: 'INICIALIZAR',
  ignitionHint: 'clique, ou bata palmas, para ligar',
  skipBoot: 'Pular a abertura',

  settingsModel: 'Modelo',
  settingsEffort: 'Esforço',
  settingsLanguage: 'Idioma',
  settingsNoise: 'Filtro de ruído',
  settingsConversation: 'Conversa',
  settingsCurrent: 'Atual',
  settingsDefault: 'Padrão',
  settingsDefaultFromSettings: 'Padrão (das configurações)',
  noiseStandardOption: 'Padrão',
  noiseStrictOption: 'Estrito (não ouve nada enquanto ele fala)',
  newConversation: 'NOVA CONVERSA',
  newConversationHint: 'Esquecer esta conversa e começar do zero',
  resumeHint: 'Voltar a uma conversa anterior',
  resumedNote: 'retomada da última vez',
  freshNote: 'sessão nova',

  gesturePoint: 'mover o cursor',
  gesturePinch: 'pegar uma lâmina · mover · apertar',
  gestureOpen: 'soltar',
  gesturePeace: 'dois dedos para cima e para baixo para rolar',
  gestureFrame: 'dois L com as mãos para redimensionar',

  errGeneric: 'Algo deu errado.',
  errNoAudio: 'Nenhum áudio do microfone — verifique se ele não está em uso em outro lugar, ou recarregue.',
  errPowerUp: 'Falha ao ligar. Clique para tentar de novo.',
  errMicDenied: 'Acesso ao microfone negado — entrada de voz indisponível.',
  errMicRefused: 'Acesso ao microfone recusado — entrada de voz indisponível.',
  errNoMic: 'Nenhum microfone disponível.',
  errNoRecorder: 'Este navegador não consegue gravar áudio — entrada de voz indisponível.',
  errNoRecognition:
    'Este navegador não tem reconhecimento de fala — use Chrome ou Edge, ou rode o bridge para transcrever.',
  errCameraDenied: 'Acesso à câmera negado — controle por gestos indisponível.',
  errCameraNotPermitted: 'A câmera não está permitida, então não consigo ver nada.',
  errNoFootage:
    'Não há imagem recente — a câmera precisa estar aberta na tela ' +
    'para eu lembrar do que acabou de acontecer. Peça para eu abrir a câmera, ' +
    'e eu passo a observar a partir dali.',
  errShortFootage: 'Não há imagem recente suficiente para revisar.',
  errScreenCancelled: 'O compartilhamento de tela foi cancelado.',
  errCameraNotAllowed: 'O acesso à câmera não está permitido.',
  noticeBridgeLost: 'Conexão com o bridge perdida — reconectando.',
  noticeBridgeBack: 'Bridge reconectado. A conversa anterior não foi mantida.',
  audioTest: 'Teste de áudio. Se você está ouvindo isto, a saída de voz está funcionando, senhor.',
  settingsSpeed: 'Velocidade da fala',
  settingsGap: 'Pausa entre frases',
  speedNormal: 'normal',
  voiceOn: 'VOZ LIGADA',
  voiceOff: 'VOZ DESLIGADA',
  voiceMuteHint: 'Silenciar a voz dele — as respostas continuam na tela (V)',
  creditsLabel: 'CRÉDITOS DE VOZ',
  creditsSpent: 'CRÉDITOS ESGOTADOS',
  noticeQuotaSpent:
    'Os créditos de voz acabaram, então a voz dele está desligada. As respostas continuam na tela.',
  imageUnavailable: 'imagem indisponível',
  videoUnavailable: 'vídeo indisponível',
  noticeNoHebrewVoice:
    'Nenhuma voz em hebraico instalada, então ele não consegue falar hebraico. Adicione uma em ' +
    'Configurações do Windows → Hora e idioma → Fala → Adicionar vozes → Hebraico, e recarregue a página.',
}

/**
 * Hebrew. Rewritten rather than translated, like the Portuguese, with two
 * rules of its own. Hebrew has no "sir", and the user's gender is unknown, so
 * nothing here addresses them as masculine or feminine: instructions use the
 * plural or the infinitive ("אמרו", "לחזור"), which reads as neutral. JARVIS
 * himself is masculine ("מקשיב", "ממתין"), since that is the character. In
 * this edition the character is called James (ג׳יימס).
 */
const he: Record<StringKey, string> = {
  statusOffline: 'כבוי',
  statusBoot: 'מאתחל',
  statusDormant: 'בהמתנה — “היי ג׳יימס” או שתי מחיאות כפיים',
  statusWaking: 'מקוון',
  statusListening: 'מקשיב',
  statusThinking: 'מעבד',
  statusTooling: 'ניגש למערכות',
  statusSpeaking: 'עונה',

  signal: 'אות',
  muted: 'מושתק',
  noInput: 'אין קלט',
  micOn: 'מיקרופון פועל',
  micOff: 'מיקרופון כבוי',
  noiseStrict: 'רעש: קפדני',
  noiseStandard: 'רעש: רגיל',
  speakerYou: 'אתם',
  speakerJarvis: 'ג׳יימס',
  screenShare: 'שיתוף מסך',
  camera: 'מצלמה',
  handControl: 'שליטה בידיים',
  initialise: 'הפעלה',
  ignitionHint: 'לחיצה או מחיאת כף מפעילות אותו',
  skipBoot: 'דילוג על הפתיחה',

  settingsModel: 'מודל',
  settingsEffort: 'מאמץ',
  settingsLanguage: 'שפה',
  settingsNoise: 'סינון רעשים',
  settingsConversation: 'שיחה',
  settingsCurrent: 'נוכחית',
  settingsDefault: 'ברירת מחדל',
  settingsDefaultFromSettings: 'ברירת מחדל (מההגדרות)',
  noiseStandardOption: 'רגיל',
  noiseStrictOption: 'קפדני (לא שומע כלום בזמן שהוא מדבר)',
  newConversation: 'שיחה חדשה',
  newConversationHint: 'לשכוח את השיחה הזאת ולהתחיל מחדש',
  resumeHint: 'לחזור לשיחה קודמת',
  resumedNote: 'ממשיך מהפעם הקודמת',
  freshNote: 'התחלה נקייה',

  gesturePoint: 'להזיז את הסמן',
  gesturePinch: 'לתפוס חלון · להזיז · ללחוץ',
  gestureOpen: 'לשחרר',
  gesturePeace: 'שתי אצבעות למעלה ולמטה כדי לגלול',
  gestureFrame: 'שתי פינות בצורת L כדי לשנות גודל',

  errGeneric: 'משהו השתבש.',
  errNoAudio: 'לא מגיע קול מהמיקרופון. כדאי לבדוק שהוא לא תפוס בתוכנה אחרת, או לרענן את הדף.',
  errPowerUp: 'ההפעלה נכשלה. לחיצה תנסה שוב.',
  errMicDenied: 'הגישה למיקרופון נחסמה, ולכן אי אפשר לדבר בקול.',
  errMicRefused: 'הגישה למיקרופון נדחתה, ולכן אי אפשר לדבר בקול.',
  errNoMic: 'לא נמצא מיקרופון.',
  errNoRecorder: 'הדפדפן הזה לא יודע להקליט, ולכן אי אפשר לדבר בקול.',
  errNoRecognition:
    'לדפדפן הזה אין זיהוי דיבור. צריך Chrome, או להפעיל את ה-bridge לתמלול.',
  errCameraDenied: 'הגישה למצלמה נחסמה, ולכן שליטה בידיים לא זמינה.',
  errCameraNotPermitted: 'אין הרשאה למצלמה, אז אני לא רואה כלום.',
  errNoFootage:
    'אין צילום עדכני. המצלמה צריכה להיות פתוחה על המסך ' +
    'כדי שאזכור מה קרה הרגע. אפשר לבקש ממני לפתוח את המצלמה, ' +
    'ומאותו רגע אני עוקב.',
  errShortFootage: 'אין מספיק צילום עדכני כדי לבדוק.',
  errScreenCancelled: 'שיתוף המסך בוטל.',
  errCameraNotAllowed: 'אין הרשאה להשתמש במצלמה.',
  noticeBridgeLost: 'החיבור ל-bridge נותק, מתחבר מחדש.',
  noticeBridgeBack: 'ה-bridge חזר. השיחה הקודמת לא נשמרה.',
  audioTest: 'בדיקת שמע. אם שומעים את זה, הקול עובד.',
  settingsSpeed: 'קצב דיבור',
  settingsGap: 'הפסקה בין משפטים',
  speedNormal: 'רגיל',
  voiceOn: 'קול פועל',
  voiceOff: 'קול כבוי',
  voiceMuteHint: 'להשתיק את הקול שלו. התשובות ממשיכות להופיע על המסך (V)',
  creditsLabel: 'תקציב קול',
  creditsSpent: 'תקציב הקול נגמר',
  noticeQuotaSpent:
    'תקציב הקול נגמר, ולכן הקול שלו כבוי. התשובות ממשיכות להופיע על המסך.',
  imageUnavailable: 'התמונה לא זמינה',
  videoUnavailable: 'הסרטון לא זמין',
  noticeNoHebrewVoice:
    'לא מותקן במחשב קול בעברית, ולכן הוא לא יכול לדבר עברית. אפשר להוסיף אותו בהגדרות Windows ← ' +
    'זמן ושפה ← דיבור ← הוספת קולות ← עברית, ואז לרענן את הדף.',
}

const TABLE: Record<Lang, Record<StringKey, string>> = { en, pt, he }

/**
 * Read one string.
 *
 * Takes the language rather than reaching into the store, so it can be called
 * from the audio and voice modules, which have no React and no business
 * subscribing to anything.
 */
export function t(lang: Lang, key: StringKey): string {
  return TABLE[lang][key]
}

/** ISO 639-1, for the transcriber and the speech synthesiser. The codes
 *  already are ISO 639-1, so this is the identity; it stays a function so
 *  callers do not depend on that. */
export const iso = (lang: Lang): string => lang
