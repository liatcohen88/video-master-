/*
 * העוזר הקולי: the assistant window.
 *
 * Voice: the page talks to OpenAI's Realtime API directly over WebRTC (mic in,
 * voice out, events on the "oai-events" data channel), using a short-lived key
 * from the local server. Actions the model calls are carried out by the local
 * server (/api/tool) or, for timers and the clock, right here.
 */
"use strict";

(() => {
  const TOKEN = document.documentElement.dataset.token || "";
  const $ = (id) => document.getElementById(id);
  const ui = {
    body: document.body,
    name: $("assistantName"),
    orb: $("orb"),
    status: $("status"),
    hint: $("hint"),
    controls: $("controls"),
    mute: $("muteBtn"),
    end: $("endBtn"),
    timers: $("timers"),
    log: $("log"),
    examples: $("examples"),
    composer: $("composer"),
    text: $("textInput"),
    audio: $("remoteAudio"),
    toast: $("toast"),
    gate: $("audioGate"),
    gateBtn: $("audioGateBtn"),
    offline: $("offline"),
    offlineText: $("offlineText"),
    settingsBtn: $("settingsBtn"),
    overlay: $("settingsOverlay"),
    form: $("settingsForm"),
    intro: $("settingsIntro"),
    fKey: $("fKey"),
    keyNote: $("keyNote"),
    fName: $("fName"),
    fVoice: $("fVoice"),
    fAddress: $("fAddress"),
    fAbout: $("fAbout"),
    fModel: $("fModel"),
    fSpeed: $("fSpeed"),
    fIdle: $("fIdle"),
    formMsg: $("formMsg"),
    saveBtn: $("saveBtn"),
    cancelBtn: $("cancelBtn"),
    shutdownBtn: $("shutdownBtn"),
  };

  const VOICE_LABELS = {
    marin: "נשי: Marin (הכי טבעי)",
    cedar: "גברי: Cedar (הכי טבעי)",
    coral: "נשי: Coral",
    shimmer: "נשי: Shimmer",
    sage: "נשי: Sage",
    alloy: "נשי-ניטרלי: Alloy",
    ash: "גברי: Ash",
    ballad: "גברי: Ballad",
    echo: "גברי: Echo",
    verse: "גברי: Verse",
  };

  let app = null; // /api/state
  let conn = null; // the live Realtime connection
  let state = "idle";
  let muted = false;
  let lastActivity = 0;
  let pendingText = null;
  let audioCtx = null;
  const meters = { mic: null, out: null };
  const bubbles = new Map();
  const timers = new Map();
  let timerSeq = 0;

  // ─── small helpers ──────────────────────────────────────────────────────

  const feminine = () => !!(app && app.voices[app.settings.voice] === "f");
  const g = (masc, fem) => (feminine() ? fem : masc);
  const assistantName = () => (app && app.settings.assistant_name) || "העוזר";
  const touch = () => { lastActivity = Date.now(); };

  async function api(path, body) {
    const opts = { method: body === undefined ? "GET" : "POST", headers: { "X-Token": TOKEN } };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch { /* not json */ }
    if (!res.ok && !data.error) data.error = `שגיאה ${res.status}`;
    data.httpStatus = res.status;
    return data;
  }

  let toastTimer = 0;
  function toast(msg, ms = 6000) {
    ui.toast.textContent = msg;
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.hidden = true; }, ms);
  }

  // ─── state & status line ────────────────────────────────────────────────

  const STATUS = {
    idle: () => "לחיצה על הכדור פותחת שיחה",
    connecting: () => "מתחברים…",
    listening: () => `${assistantName()} ${g("מקשיב", "מקשיבה")}…`,
    user: () => `${assistantName()} ${g("שומע", "שומעת")}…`,
    thinking: () => `${assistantName()} ${g("חושב", "חושבת")}…`,
    acting: () => `${assistantName()} ${g("מבצע", "מבצעת")}…`,
    speaking: () => `${assistantName()} ${g("מדבר", "מדברת")}…`,
    muted: () => "המיקרופון מושתק",
  };

  const settled = () => (muted ? "muted" : "listening");

  function setState(next, text) {
    state = next;
    ui.body.dataset.state = next;
    ui.status.textContent = text || STATUS[next]();
    ui.controls.hidden = !conn;
    ui.orb.setAttribute("aria-label", !conn ? "התחלת שיחה" : next === "speaking" ? "עצירת הדיבור" : "סיום השיחה");
    renderHint();
  }

  function renderHint() {
    ui.hint.replaceChildren();
    if (conn) {
      ui.hint.textContent = state === "speaking"
        ? "לחיצה על הכדור עוצרת את הדיבור"
        : "לחיצה על הכדור מסיימת את השיחה";
      return;
    }
    if (!app || !app.hotkey) return;
    const keys = document.createElement("span");
    keys.dir = "ltr";
    app.hotkey.split("+").forEach((k, i) => {
      if (i) keys.append("+");
      const kbd = document.createElement("kbd");
      kbd.textContent = k.length > 1 ? k[0].toUpperCase() + k.slice(1) : k.toUpperCase();
      keys.append(kbd);
    });
    ui.hint.append("או ", keys, " מכל מקום במחשב");
  }

  // ─── conversation log ───────────────────────────────────────────────────

  function scrollLog() { ui.log.scrollTop = ui.log.scrollHeight; }

  function trimLog() {
    while (ui.log.children.length > 80) {
      const first = ui.log.firstElementChild;
      for (const [key, el] of bubbles) if (el === first) bubbles.delete(key);
      first.remove();
    }
  }

  function bubble(role, id) {
    const key = `${role}:${id}`;
    let el = bubbles.get(key);
    if (!el) {
      ui.examples.hidden = true;
      el = document.createElement("div");
      el.className = `msg msg-${role}`;
      el.dir = "auto";
      ui.log.append(el);
      bubbles.set(key, el);
      trimLog();
    }
    return el;
  }

  function placeholderBubble(role, id) {
    const el = bubble(role, id);
    if (!el.textContent) {
      el.textContent = "…";
      el.classList.add("pending");
    }
    scrollLog();
  }

  function appendBubble(role, id, delta) {
    if (!delta) return;
    const el = bubble(role, id);
    if (el.classList.contains("pending")) {
      el.textContent = "";
      el.classList.remove("pending");
    }
    el.textContent += delta;
    scrollLog();
  }

  function setBubble(role, id, text) {
    const el = bubble(role, id);
    el.classList.remove("pending");
    el.textContent = text;
    scrollLog();
  }

  function addChip(text, kind) {
    ui.examples.hidden = true;
    const el = document.createElement("div");
    el.className = `chip ${kind || ""}`;
    el.textContent = text;
    ui.log.append(el);
    trimLog();
    scrollLog();
  }

  const ENGINE_NAMES = { google: "גוגל", youtube: "יוטיוב", maps: "מפות" };
  const FOLDER_NAMES = {
    desktop: "שולחן העבודה", documents: "מסמכים", downloads: "הורדות",
    pictures: "תמונות", videos: "סרטונים", music: "מוזיקה",
  };
  const MEDIA_NAMES = {
    volume_up: "הגברת עוצמה", volume_down: "הנמכת עוצמה", set_volume: "עוצמת שמע",
    mute_toggle: "השתקה", play_pause: "ניגון/השהיה", next_track: "השיר הבא", previous_track: "השיר הקודם",
  };

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url || ""; }
  }

  function describeAction(name, a, r) {
    switch (name) {
      case "open_website": return `פתיחת אתר: ${hostOf(r.opened || a.url)}`;
      case "open_search": return `חיפוש ב${ENGINE_NAMES[a.engine] || a.engine}: ${a.query || ""}`;
      case "open_app": return `פתיחת ${r.opened || a.name || "אפליקציה"}`;
      case "open_folder": return `פתיחת תיקייה: ${FOLDER_NAMES[a.folder] || a.folder}`;
      case "media_control":
        return `${MEDIA_NAMES[a.action] || a.action}${a.action === "set_volume" && r.volume != null ? ` ${r.volume}%` : ""}`;
      case "notes": return { add: "פתק נשמר", read: "קריאת הפתקים", open: "פתיחת קובץ הפתקים" }[a.action] || "פתקים";
      case "web_search": return `חיפוש ברשת: ${a.query || ""}`;
      case "set_timer": return `טיימר ל-${formatMinutes(a.minutes)}${a.label ? ` (${a.label})` : ""}`;
      default: return null;
    }
  }

  function logAction(name, args, result) {
    const text = describeAction(name, args, result || {});
    if (!text) return;
    if (result && result.ok === false) addChip(`${text}: ${result.error || "נכשל"}`, "bad");
    else addChip(text, "ok");
  }

  // ─── audio: meters, chime, autoplay gate ────────────────────────────────

  function ensureAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new AudioContext(); } catch { return null; }
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function meterFor(stream) {
    const ctx = ensureAudioCtx();
    if (!ctx) return null;
    try {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      return { analyser, buf: new Uint8Array(analyser.fftSize) };
    } catch {
      return null;
    }
  }

  function levelOf(m) {
    if (!m) return 0;
    m.analyser.getByteTimeDomainData(m.buf);
    let sum = 0;
    for (const v of m.buf) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / m.buf.length) * 4);
  }

  const smooth = { u: 0, a: 0 };
  function animate() {
    const u = muted ? 0 : levelOf(meters.mic);
    const a = levelOf(meters.out);
    smooth.u += (u - smooth.u) * 0.35;
    smooth.a += (a - smooth.a) * 0.35;
    ui.orb.style.setProperty("--u", smooth.u.toFixed(3));
    ui.orb.style.setProperty("--a", smooth.a.toFixed(3));
    requestAnimationFrame(animate);
  }

  function chime() {
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    [0, 0.3, 0.6].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.26);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.28);
    });
  }

  function playRemoteAudio() {
    const p = ui.audio.play();
    if (p && p.catch) p.catch(() => { ui.gate.hidden = false; });
  }

  ui.gateBtn.addEventListener("click", () => {
    ui.gate.hidden = true;
    ensureAudioCtx();
    ui.audio.play().catch(() => {});
  });

  // ─── the Realtime connection ────────────────────────────────────────────

  function micError(err) {
    const n = err && err.name;
    if (n === "NotAllowedError" || n === "SecurityError") {
      return "אין גישה למיקרופון. צריך לאשר אותה (בחלונית שקופצת, או בהגדרות הדפדפן ← פרטיות ← מיקרופון) ולנסות שוב.";
    }
    if (n === "NotFoundError" || n === "OverconstrainedError") {
      return "לא נמצא מיקרופון. כדאי לחבר מיקרופון או אוזניות ולנסות שוב.";
    }
    if (n === "NotReadableError") {
      return "המיקרופון תפוס בתוכנה אחרת (למשל זום). כדאי לסגור אותה ולנסות שוב.";
    }
    return `בעיה במיקרופון: ${(err && err.message) || n || "לא ידוע"}`;
  }

  function connectError(err) {
    if (err && err.status === 401) return "OpenAI לא אישרו את השיחה. כדאי לנסות שוב.";
    if (err instanceof TypeError) return "אין חיבור ל-OpenAI. כדאי לבדוק את האינטרנט ולנסות שוב.";
    return `החיבור ל-OpenAI נכשל: ${String((err && err.message) || err).slice(0, 180)}`;
  }

  function fail(message) {
    setState("idle", message);
    toast(message, 9000);
  }

  function send(c, event) {
    if (c && c.dc && c.dc.readyState === "open") c.dc.send(JSON.stringify(event));
  }

  function systemNote(c, text) {
    send(c, {
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text }] },
    });
  }

  function requestResponse(c) {
    if (c.responseActive) {
      c.needResponse = true; // ask again once the current response is done
      return;
    }
    send(c, { type: "response.create" });
  }

  async function exchangeSdp(session, sdp) {
    const res = await fetch(session.sdp_url, {
      method: "POST",
      body: sdp,
      headers: { Authorization: `Bearer ${session.value}`, "Content-Type": "application/sdp" },
    });
    const text = await res.text();
    if (!res.ok) {
      let message = text;
      try { message = JSON.parse(text).error.message || text; } catch { /* plain text */ }
      const err = new Error(message || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return text;
  }

  async function start() {
    if (conn || state === "connecting") return;
    if (!app || !app.configured) {
      openSettings();
      return;
    }
    muted = false;
    ui.mute.setAttribute("aria-pressed", "false");
    ui.mute.textContent = "השתקת מיקרופון";
    setState("connecting");

    let mic;
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      fail(micError(err));
      return;
    }

    let session;
    try {
      session = await api("/api/session", {});
    } catch {
      session = { error: "העוזר המקומי לא עונה. ייתכן שהחלון השחור נסגר." };
    }
    if (!session.value) {
      mic.getTracks().forEach((t) => t.stop());
      fail(session.error || "לא הצלחנו לפתוח שיחה.");
      if (session.error_code === "no_key") openSettings();
      return;
    }

    const pc = new RTCPeerConnection();
    const c = {
      pc, mic, dc: null, closing: false, speaking: false,
      responseActive: false, needResponse: false, endAfterSpeech: false,
    };
    conn = c;

    pc.ontrack = (e) => {
      ui.audio.srcObject = e.streams[0];
      playRemoteAudio();
      meters.out = meterFor(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      if (conn !== c) return;
      if (pc.connectionState === "failed" || pc.connectionState === "closed") stop("dropped");
      if (pc.connectionState === "disconnected") {
        setTimeout(() => { if (conn === c && pc.connectionState === "disconnected") stop("dropped"); }, 6000);
      }
    };
    mic.getAudioTracks().forEach((track) => pc.addTrack(track, mic));

    const dc = pc.createDataChannel("oai-events");
    c.dc = dc;
    dc.addEventListener("open", () => { if (conn === c) onOpen(c); });
    dc.addEventListener("close", () => { if (conn === c && !c.closing) stop("dropped"); });
    dc.addEventListener("message", (e) => {
      let event;
      try { event = JSON.parse(e.data); } catch { return; }
      if (conn === c) handleEvent(c, event);
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const answer = await exchangeSdp(session, offer.sdp);
      if (conn !== c) return; // ended while connecting
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (err) {
      console.error(err);
      if (conn === c) {
        stop("error");
        fail(connectError(err));
      }
      return;
    }
    meters.mic = meterFor(mic);
  }

  function onOpen(c) {
    touch();
    setState(settled());
    if (pendingText) {
      const text = pendingText;
      pendingText = null;
      sendText(text);
    } else {
      systemNote(c, "SESSION_START");
      requestResponse(c);
    }
  }

  function stop(reason) {
    const c = conn;
    if (!c) return;
    c.closing = true;
    conn = null;
    try { c.dc && c.dc.close(); } catch { /* already closed */ }
    try { c.pc.close(); } catch { /* already closed */ }
    c.mic.getTracks().forEach((t) => t.stop());
    ui.audio.srcObject = null;
    meters.mic = null;
    meters.out = null;
    const messages = {
      idle: "השיחה נסגרה אחרי שקט ארוך, כדי לא לבזבז כסף. לחיצה על הכדור פותחת שיחה חדשה.",
      dropped: "החיבור נותק. לחיצה על הכדור מתחברת מחדש.",
    };
    setState("idle", messages[reason]);
  }

  function interrupt(c) {
    send(c, { type: "response.cancel" });
    send(c, { type: "output_audio_buffer.clear" });
    c.speaking = false;
    setState(settled());
  }

  function sendText(text) {
    const c = conn;
    if (!c || !c.dc || c.dc.readyState !== "open") {
      pendingText = text;
      start();
      return;
    }
    touch();
    if (c.speaking) interrupt(c);
    send(c, {
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
    });
    requestResponse(c);
  }

  function handleEvent(c, ev) {
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        touch();
        setState("user");
        break;
      case "input_audio_buffer.speech_stopped":
        setState("thinking");
        break;
      case "input_audio_buffer.committed":
        placeholderBubble("user", ev.item_id);
        break;
      case "conversation.item.input_audio_transcription.delta":
        appendBubble("user", ev.item_id, ev.delta);
        break;
      case "conversation.item.input_audio_transcription.completed":
        setBubble("user", ev.item_id, (ev.transcript || "").trim() || "🎤");
        break;
      case "conversation.item.input_audio_transcription.failed":
        setBubble("user", ev.item_id, "🎤");
        break;
      case "response.created":
        c.responseActive = true;
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
      case "response.output_text.delta":
        appendBubble("assistant", ev.item_id, ev.delta);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        if (ev.transcript) setBubble("assistant", ev.item_id, ev.transcript);
        break;
      case "output_audio_buffer.started":
        c.speaking = true;
        touch();
        setState("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        c.speaking = false;
        touch();
        if (c.endAfterSpeech) stop("bye");
        else if (state === "speaking") setState(settled());
        break;
      case "response.done":
        c.responseActive = false;
        onResponseDone(c, ev.response || {});
        break;
      case "error":
        onServerError(ev.error || {});
        break;
      default:
        break;
    }
  }

  function onServerError(err) {
    const code = err.code || err.type || "";
    if (code === "conversation_already_has_active_response" || code === "response_cancel_not_active") return;
    console.warn(`Realtime error: ${code} ${err.message || ""}`);
    toast(`OpenAI: ${err.message || code || "שגיאה"}`);
  }

  function parseArgs(raw) {
    if (raw && typeof raw === "object") return raw;
    try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
  }

  async function onResponseDone(c, response) {
    if (response.status === "failed") {
      const err = (response.status_details && response.status_details.error) || {};
      toast(`התשובה נכשלה: ${err.message || err.code || "סיבה לא ידועה"}`);
    }
    const calls = (response.output || []).filter((o) => o && o.type === "function_call" && o.status !== "incomplete");
    if (!calls.length) {
      if (c.needResponse) {
        c.needResponse = false;
        requestResponse(c);
      } else if (!c.speaking && (state === "thinking" || state === "acting")) {
        setState(settled());
      }
      return;
    }

    if (!c.speaking) setState("acting"); // mid-sentence, keep showing that it's talking
    let goodbye = false;
    for (const call of calls) {
      const args = parseArgs(call.arguments);
      const result = await runTool(call.name, args);
      if (conn !== c) return;
      logAction(call.name, args, result);
      if (call.name === "end_conversation") {
        goodbye = true;
        continue;
      }
      send(c, {
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) },
      });
    }
    if (goodbye) {
      c.endAfterSpeech = true; // hang up once the goodbye has been heard
      if (!c.speaking) setTimeout(() => { if (conn === c) stop("bye"); }, 800);
      return;
    }
    if (!c.speaking) setState("thinking");
    c.needResponse = false;
    requestResponse(c);
  }

  async function runTool(name, args) {
    try {
      if (name === "get_current_time") return currentTime();
      if (name === "set_timer") return setTimer(args);
      if (name === "end_conversation") return { ok: true };
      return await api("/api/tool", { name, args });
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  }

  function currentTime() {
    const now = new Date();
    return {
      ok: true,
      local: now.toLocaleString("he-IL", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      }),
      iso: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  // ─── timers (live in this window) ───────────────────────────────────────

  function formatMinutes(minutes) {
    const secs = Math.round(Number(minutes) * 60);
    if (!Number.isFinite(secs)) return "";
    if (secs < 60) return `${secs} שניות`;
    const m = Math.round(secs / 60);
    if (m === 1) return "דקה";
    if (m < 60) return `${m} דקות`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return `${h === 1 ? "שעה" : `${h} שעות`}${rest ? ` ו-${rest} דקות` : ""}`;
  }

  function formatClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const pad = (n) => String(n).padStart(2, "0");
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }

  function setTimer(args) {
    const ms = Math.round(Number(args.minutes) * 60000);
    if (!Number.isFinite(ms) || ms < 1000 || ms > 24 * 3600 * 1000) {
      return { ok: false, error: "the timer must be between 1 second and 24 hours" };
    }
    const id = ++timerSeq;
    const label = String(args.label || "").trim().slice(0, 60);
    const endsAt = Date.now() + ms;
    timers.set(id, { id, label, endsAt, handle: setTimeout(() => fireTimer(id), ms) });
    renderTimers();
    return { ok: true, ends_at: new Date(endsAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) };
  }

  function fireTimer(id) {
    const t = timers.get(id);
    if (!t) return;
    timers.delete(id);
    renderTimers();
    chime();
    const text = `הטיימר${t.label ? ` של ${t.label}` : ""} הסתיים`;
    addChip(text, "info");
    toast(`⏰ ${text}`, 12000);
    const c = conn;
    if (c && c.dc && c.dc.readyState === "open") {
      touch();
      systemNote(c, `TIMER_DONE${t.label ? `: ${t.label}` : ""}`);
      requestResponse(c);
    } else {
      speakLocally(text);
    }
  }

  // When no conversation is open, use a Hebrew system voice if the browser has one (Edge does).
  function speakLocally(text) {
    try {
      const voice = speechSynthesis.getVoices().find((v) => /^(he|iw)/i.test(v.lang));
      if (!voice) return;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      speechSynthesis.speak(u);
    } catch { /* no speech synthesis */ }
  }

  function renderTimers() {
    const items = [...timers.values()].sort((a, b) => a.endsAt - b.endsAt).map((t) => {
      const li = document.createElement("li");
      li.className = "timer";
      const label = document.createElement("span");
      label.textContent = t.label ? `${t.label} ·` : "טיימר ·";
      const time = document.createElement("span");
      time.className = "timer-time";
      time.dir = "ltr";
      time.textContent = formatClock(t.endsAt - Date.now());
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "timer-x";
      cancel.setAttribute("aria-label", "ביטול הטיימר");
      cancel.textContent = "✕";
      cancel.addEventListener("click", () => {
        clearTimeout(t.handle);
        timers.delete(t.id);
        renderTimers();
      });
      li.append(label, time, cancel);
      return li;
    });
    ui.timers.replaceChildren(...items);
  }

  setInterval(() => { if (timers.size) renderTimers(); }, 1000);

  // Hang up after a stretch of silence so an open line doesn't cost money.
  setInterval(() => {
    const c = conn;
    if (!c || c.speaking || !app || !c.dc || c.dc.readyState !== "open") return;
    const limit = Math.max(1, Number(app.settings.idle_minutes) || 3) * 60000;
    if (Date.now() - lastActivity > limit) stop("idle");
  }, 5000);

  // ─── buttons & keyboard ─────────────────────────────────────────────────

  // The orb and the global hotkey do the same thing: start, cut the assistant
  // off mid-sentence, or hang up.
  function primaryAction() {
    ensureAudioCtx();
    if (!conn) {
      start();
    } else if (conn.speaking) {
      interrupt(conn);
    } else {
      stop("user");
    }
  }

  ui.orb.addEventListener("click", primaryAction);
  ui.end.addEventListener("click", () => stop("user"));

  ui.mute.addEventListener("click", () => {
    const c = conn;
    if (!c) return;
    muted = !muted;
    c.mic.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    ui.mute.setAttribute("aria-pressed", String(muted));
    ui.mute.textContent = muted ? "ביטול ההשתקה" : "השתקת מיקרופון";
    if (!c.speaking) setState(settled());
  });

  ui.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = ui.text.value.trim();
    if (!text) return;
    ui.text.value = "";
    ensureAudioCtx();
    setBubble("user", `typed-${Date.now()}`, text);
    sendText(text);
  });

  // ─── settings ───────────────────────────────────────────────────────────

  function fillVoices(selected) {
    ui.fVoice.replaceChildren(...Object.keys(app.voices).map((id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = VOICE_LABELS[id] || id;
      opt.selected = id === selected;
      return opt;
    }));
  }

  function selectValue(select, value) {
    const v = String(value);
    if (![...select.options].some((o) => o.value === v)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.append(opt);
    }
    select.value = v;
  }

  function formMessage(text, isError) {
    ui.formMsg.textContent = text || "";
    ui.formMsg.classList.toggle("error", !!isError);
  }

  function openSettings() {
    if (!app) return;
    const s = app.settings;
    ui.intro.hidden = app.configured;
    ui.cancelBtn.hidden = !app.configured;
    ui.fKey.value = "";
    ui.fKey.placeholder = app.key_hint ? `${app.key_hint} (שמור, אפשר להשאיר ריק)` : "sk-...";
    ui.keyNote.textContent = "המפתח נשמר רק במחשב הזה.";
    ui.fName.value = s.assistant_name || "";
    fillVoices(s.voice);
    ui.fAddress.value = s.address;
    ui.fAbout.value = s.about_me || "";
    selectValue(ui.fModel, s.model);
    selectValue(ui.fSpeed, Number(s.speed) === 1 ? "1" : s.speed);
    ui.fIdle.value = s.idle_minutes;
    formMessage("");
    ui.toast.hidden = true;
    ui.overlay.hidden = false;
    (app.configured ? ui.fName : ui.fKey).focus();
  }

  function closeSettings() {
    ui.overlay.hidden = true;
  }

  ui.settingsBtn.addEventListener("click", openSettings);
  ui.cancelBtn.addEventListener("click", closeSettings);
  ui.overlay.addEventListener("click", (e) => { if (e.target === ui.overlay && app && app.configured) closeSettings(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !ui.overlay.hidden && app && app.configured) closeSettings();
  });

  ui.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = ui.fKey.value.trim();
    if (!app.configured && !key) {
      formMessage("צריך להדביק מפתח OpenAI כדי להתחיל.", true);
      ui.fKey.focus();
      return;
    }
    const body = {
      assistant_name: ui.fName.value,
      voice: ui.fVoice.value,
      address: ui.fAddress.value,
      about_me: ui.fAbout.value,
      model: ui.fModel.value,
      speed: Number(ui.fSpeed.value),
      idle_minutes: Number(ui.fIdle.value) || 3,
    };
    if (key) body.openai_api_key = key;
    ui.saveBtn.disabled = true;
    formMessage(key ? "בודקים את המפתח מול OpenAI…" : "שומרים…");
    let res;
    try {
      res = await api("/api/settings", body);
    } catch {
      res = { error: "העוזר המקומי לא עונה. ייתכן שהחלון השחור נסגר." };
    }
    ui.saveBtn.disabled = false;
    if (res.error) {
      formMessage(res.error, true);
      return;
    }
    app = res.state;
    applyState();
    closeSettings();
    if (res.warning) toast(res.warning, 10000);
    else toast(conn ? "נשמר. השינויים ייכנסו לתוקף בשיחה הבאה." : "נשמר ✓", 3500);
  });

  ui.shutdownBtn.addEventListener("click", async () => {
    if (!confirm("לכבות את העוזר? אפשר להפעיל אותו שוב בלחיצה כפולה על start.bat")) return;
    stop("user");
    closeSettings();
    try { await api("/api/shutdown", {}); } catch { /* already gone */ }
    showOffline("העוזר כובה. להפעלה מחדש: לחיצה כפולה על start.bat");
  });

  function applyState() {
    ui.name.textContent = assistantName();
    if (!conn) setState(state === "connecting" ? "connecting" : "idle");
    else setState(state);
  }

  // ─── link to the local server (hotkey, shutdown, restarts) ──────────────

  function showOffline(text) {
    stop("user");
    ui.offlineText.textContent = text;
    ui.offline.hidden = false;
  }

  function listenToServer() {
    const es = new EventSource(`/api/events?t=${encodeURIComponent(TOKEN)}`);
    es.onopen = () => { ui.offline.hidden = true; };
    es.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type === "hotkey") {
        api("/api/hotkey-ack", {}).catch(() => {});
        if (ui.overlay.hidden && app && app.configured) primaryAction();
      } else if (ev.type === "shutdown") {
        es.close();
        showOffline("העוזר כובה. להפעלה מחדש: לחיצה כפולה על start.bat");
      }
    };
    es.onerror = () => {
      setTimeout(async () => {
        if (es.readyState === EventSource.OPEN) return;
        try {
          const res = await fetch("/api/state", { headers: { "X-Token": TOKEN }, cache: "no-store" });
          if (res.status === 403) location.reload(); // the assistant restarted: pick up its new key
        } catch {
          es.close();
          showOffline("העוזר כבוי (החלון השחור נסגר). להפעלה מחדש: לחיצה כפולה על start.bat");
          waitForServer();
        }
      }, 2500);
    };
  }

  function waitForServer() {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/ping", { cache: "no-store" });
        if (res.ok) {
          clearInterval(timer);
          location.reload();
        }
      } catch { /* still off */ }
    }, 4000);
  }

  // ─── boot ───────────────────────────────────────────────────────────────

  async function init() {
    requestAnimationFrame(animate);
    try {
      app = await api("/api/state");
    } catch {
      showOffline("העוזר כבוי. להפעלה: לחיצה כפולה על start.bat");
      waitForServer();
      return;
    }
    if (app.httpStatus === 403) {
      showOffline("החלון הזה ישן. צריך לסגור אותו ולהפעיל את העוזר מחדש (start.bat).");
      return;
    }
    applyState();
    listenToServer();
    const params = new URLSearchParams(location.search);
    if (params.has("autostart")) history.replaceState(null, "", "/");
    if (!app.configured) openSettings();
    else if (params.has("autostart")) start();
    // App-mode windows can be resized by the page; ordinary tabs ignore this.
    if (window.outerWidth > 720) {
      try { window.resizeTo(460, 800); } catch { /* not allowed */ }
    }
  }

  init();
})();
