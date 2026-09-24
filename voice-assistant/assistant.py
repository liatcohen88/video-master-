#!/usr/bin/env python3
"""
העוזר הקולי: the half of a Hebrew desktop voice assistant that runs on the
user's own computer (Windows first; macOS/Linux work too, minus the
Windows-only extras).

  * serves the assistant's window (web/) on http://127.0.0.1:<port>
  * keeps the OpenAI API key on this machine and hands the page only a
    short-lived Realtime session key, so the real key never reaches a browser
  * carries out the assistant's actions locally: open apps / sites / folders,
    media keys, notes, web search
  * registers a global hotkey (Windows) that wakes the assistant from anywhere

The voice conversation itself runs between the page and OpenAI's Realtime API
over WebRTC (see web/app.js).

Standard library only: nothing to pip install.
"""
from __future__ import annotations

import argparse
import ctypes
import datetime as dt
import difflib
import json
import os
import queue
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VERSION = "1.0"
APP_ID = "voice-assistant"
WINDOW_TITLE = "העוזר הקולי"  # must match <title> in web/index.html
IS_WIN = sys.platform == "win32"
HERE = Path(__file__).resolve().parent
WEB_DIR = HERE / "web"
DEFAULT_PORT = 8765
OPENAI_BASE = os.environ.get("VA_OPENAI_BASE", "https://api.openai.com").rstrip("/")
DRY_RUN = os.environ.get("VA_DRY_RUN") == "1"  # tests: log actions instead of doing them


def _data_dir() -> Path:
    if os.environ.get("VA_DATA_DIR"):
        base = Path(os.environ["VA_DATA_DIR"])
    elif IS_WIN and os.environ.get("APPDATA"):
        base = Path(os.environ["APPDATA"]) / "VoiceAssistant"
    else:
        base = Path.home() / ".voice-assistant"
    base.mkdir(parents=True, exist_ok=True)
    return base


DATA_DIR = _data_dir()
CONFIG_PATH = DATA_DIR / "config.json"
NOTES_PATH = DATA_DIR / "notes.txt"
LOG_PATH = DATA_DIR / "assistant.log"

# Runtime state, filled in by main().
CONFIG: dict = {}
PORT = 0
TOKEN = secrets.token_urlsafe(32)
ALLOWED_HOSTS: set = set()
ALLOWED_ORIGINS: set = set()
HOTKEY_ACTIVE = False
NO_WINDOW = False
SHUTTING_DOWN = threading.Event()
HOTKEY_ACK = threading.Event()

# ─── logging ────────────────────────────────────────────────────────────────

_log_lock = threading.Lock()


def log(msg: str) -> None:
    line = f"[{dt.datetime.now():%H:%M:%S}] {msg}"
    try:
        print(line, flush=True)
    except Exception:
        pass
    with _log_lock:
        try:
            with open(LOG_PATH, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass


def trim_log() -> None:
    try:
        if LOG_PATH.stat().st_size > 512 * 1024:
            LOG_PATH.write_text("", encoding="utf-8")
    except OSError:
        pass


# ─── settings ───────────────────────────────────────────────────────────────

# OpenAI voice id -> the grammatical gender the assistant uses for itself.
VOICES = {
    "marin": "f", "cedar": "m", "coral": "f", "shimmer": "f", "sage": "f",
    "alloy": "f", "ash": "m", "ballad": "m", "echo": "m", "verse": "m",
}
ADDRESS_FORMS = ("neutral", "female", "male")

DEFAULTS = {
    "openai_api_key": "",
    "model": "gpt-realtime",
    "voice": "cedar",
    "assistant_name": "ג'רוויס",
    "address": "neutral",           # how the assistant addresses the user
    "about_me": "",
    "speed": 1.0,
    "idle_minutes": 3,              # hang up after this much silence (saves money)
    "hotkey": "ctrl+alt+space",
    "browser": "auto",              # auto | chrome | edge | default
    "noise_reduction": "far_field",  # far_field (laptop mic) | near_field (headset) | off
    "transcribe_model": "gpt-4o-mini-transcribe",
    "search_model": "gpt-4.1-mini",
    "apps": {},                     # extra apps: {"spoken name": "path, URL or command"}
}


def load_config() -> dict:
    cfg = dict(DEFAULTS)
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            saved = json.load(f)
        if isinstance(saved, dict):
            cfg.update({k: v for k, v in saved.items() if k in DEFAULTS})
    except FileNotFoundError:
        pass
    except (OSError, ValueError) as e:
        log(f"config.json could not be read ({e}), using defaults")
    return cfg


def save_config(cfg: dict) -> None:
    tmp = CONFIG_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    os.replace(tmp, CONFIG_PATH)


def api_key(cfg: dict) -> str:
    return str(cfg.get("openai_api_key") or os.environ.get("OPENAI_API_KEY") or "").strip()


def _v_choice(options):
    return lambda v, old: v if v in options else old


def _v_text(maxlen: int):
    return lambda v, old: v.strip()[:maxlen] if isinstance(v, str) else old


def _v_model(v, old):
    return v.strip() if isinstance(v, str) and re.fullmatch(r"[A-Za-z0-9._:-]{3,80}", v.strip()) else old


def _v_num(lo, hi, cast=float):
    def check(v, old):
        try:
            n = cast(v)
        except (TypeError, ValueError):
            return old
        return max(lo, min(hi, n))
    return check


SETTINGS_FIELDS = {
    "assistant_name": _v_text(40),
    "voice": _v_choice(VOICES),
    "address": _v_choice(ADDRESS_FORMS),
    "about_me": _v_text(1500),
    "model": _v_model,
    "speed": _v_num(0.25, 1.5),
    "idle_minutes": _v_num(1, 60, int),
    "browser": _v_choice(("auto", "chrome", "edge", "default")),
}


def state_payload() -> dict:
    key = api_key(CONFIG)
    return {
        "configured": bool(key),
        "key_hint": f"{key[:3]}…{key[-4:]}" if len(key) > 10 else "",
        "settings": {k: CONFIG.get(k, DEFAULTS[k]) for k in SETTINGS_FIELDS},
        "voices": VOICES,
        "hotkey": CONFIG.get("hotkey", "") if HOTKEY_ACTIVE else "",
        "platform": sys.platform,
        "version": VERSION,
    }


# ─── OpenAI ─────────────────────────────────────────────────────────────────


class OpenAIError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def openai_request(method: str, path: str, key: str, body: dict | None = None, timeout: float = 20) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(OPENAI_BASE + path, data=data, method=method)
    req.add_header("Authorization", f"Bearer {key}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        code, message = "", raw[:300]
        try:
            err = json.loads(raw).get("error") or {}
            code = str(err.get("code") or err.get("type") or "")
            message = err.get("message") or message
        except (ValueError, AttributeError):
            pass
        raise OpenAIError(e.code, code, message) from None
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise OpenAIError(0, "network", str(e)) from None


def hebrew_error(e: OpenAIError, model: str = "") -> str:
    if e.status == 0:
        return "אין חיבור ל-OpenAI. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב."
    if e.status == 401:
        return "מפתח ה-OpenAI לא תקין או שבוטל. אפשר להדביק מפתח חדש בהגדרות."
    if e.status == 429 and "quota" in f"{e.code} {e.message}".lower():
        return "נגמרה היתרה בחשבון ה-OpenAI. צריך להוסיף קרדיט בעמוד החיוב (Billing) של OpenAI ולנסות שוב."
    if e.status == 429:
        return "יותר מדי בקשות בבת אחת. כדאי לחכות כמה שניות ולנסות שוב."
    if e.status in (403, 404) and model:
        return f"לחשבון ה-OpenAI אין גישה למודל {model}. אפשר לבחור מודל אחר בהגדרות."
    return f"OpenAI החזירו שגיאה ({e.status}): {e.message}"


def build_instructions(cfg: dict) -> str:
    name = str(cfg.get("assistant_name") or "").strip() or "העוזר"
    if VOICES.get(cfg.get("voice"), "m") == "f":
        self_forms = 'Refer to yourself in FEMININE Hebrew forms ("אני בודקת", "פתחתי את זה", "אני לא בטוחה").'
        filler = "רגע, בודקת"
    else:
        self_forms = 'Refer to yourself in MASCULINE Hebrew forms ("אני בודק", "פתחתי את זה", "אני לא בטוח").'
        filler = "רגע, בודק"
    address = cfg.get("address")
    if address == "female":
        user_forms = "Address the user in FEMININE forms (את, תרצי, תגידי)."
    elif address == "male":
        user_forms = "Address the user in MASCULINE forms (אתה, תרצה, תגיד)."
    else:
        user_forms = ("The user's gender is unknown, so never guess it: address them in gender-neutral Hebrew, "
                      'using plural forms ("תגידו", "רוצים"), infinitives ("אפשר לנסות") or impersonal phrasing.')
    about = str(cfg.get("about_me") or "").strip()
    now = dt.datetime.now()
    lines = [
        "# Role",
        f"You are {name}, a personal voice assistant that lives on the user's computer. "
        "You talk with the user out loud, and you can act on the computer with your tools.",
        "",
        "# Language and voice",
        "- Speak natural, fluent, everyday Israeli Hebrew, the way people actually talk, not formal written Hebrew.",
        "- Switch to another language only if the user explicitly asks for it.",
        f"- {self_forms}",
        f"- {user_forms}",
        "- Say numbers, times and dates the way Israelis say them out loud.",
        "",
        "# Style",
        "- This is a spoken conversation: keep replies short, usually one or two sentences. Go longer only when asked.",
        "- No lists, no markdown, no emojis, and never read out URLs or symbols.",
        "- Warm, quick and to the point, with a light touch of humor when it fits.",
        "- If you did not catch what the user said, ask briefly instead of guessing.",
        "",
        "# Tools",
        "- When the user asks you to open, play, search, set, save or check something, call the matching tool right away. "
        "Harmless actions (opening an app, a website, a folder or a search) need no confirmation.",
        f'- Before web_search, which takes a few seconds, first say a very short filler such as "{filler}".',
        "- After an action, confirm in a few words. If a tool failed, say so honestly and offer an alternative.",
        "- Never claim you did something unless a tool actually did it. You cannot see the screen, read the user's files "
        "or send emails or messages; if asked, say so simply.",
        "- For news, weather, prices, sports, opening hours or anything that may have changed recently, "
        "use web_search and answer from its result.",
        "- For the current time or date use get_current_time. For timers and reminders use set_timer.",
        '- When the user says goodbye or that they are done ("תודה, זהו", "ביי"), '
        "say a very short goodbye and then call end_conversation.",
        "",
        "# System messages",
        "- SESSION_START: greet the user with one very short phrase (up to five words) and wait.",
        "- TIMER_DONE: tell the user right away, in one short sentence, which timer has just ended.",
    ]
    if about:
        lines += ["", "# About the user (written by the user)", about[:1500]]
    lines += ["", "# Context", f"This conversation started on {now:%A, %d %B %Y} at {now:%H:%M} (local time)."]
    return "\n".join(lines)


def build_tools(cfg: dict) -> list:
    custom = ", ".join(str(k) for k in (cfg.get("apps") or {}))
    app_desc = ("Launch an application installed on this computer, e.g. Word, Excel, Chrome, Spotify, WhatsApp, "
                "Calculator, Notepad, Adobe Premiere Pro, CapCut, Zoom, Settings, File Explorer, or take a screenshot.")
    if custom:
        app_desc += f" The user also added these names of their own: {custom}."

    def fn(name, description, properties=None, required=None):
        params = {"type": "object", "properties": properties or {}}
        if required:
            params["required"] = required
        return {"type": "function", "name": name, "description": description, "parameters": params}

    return [
        fn("open_website", "Open a website in the user's browser.",
           {"url": {"type": "string", "description": "Full URL or bare domain, e.g. 'https://www.ynet.co.il' or 'gmail.com'."}},
           ["url"]),
        fn("open_search", "Open search results in the browser for the user to look at: Google, YouTube "
                          "(videos, songs, music) or Google Maps (places, directions).",
           {"engine": {"type": "string", "enum": ["google", "youtube", "maps"]},
            "query": {"type": "string", "description": "What to search for."}},
           ["engine", "query"]),
        fn("open_app", app_desc,
           {"name": {"type": "string", "description": "The app's name as it appears in the Windows Start menu, in English "
                                                      "when it has an English name ('Word', 'Adobe Premiere Pro', "
                                                      "'WhatsApp'). Use 'screenshot' to start a screen capture."}},
           ["name"]),
        fn("open_folder", "Open one of the user's main folders in File Explorer.",
           {"folder": {"type": "string", "enum": ["desktop", "documents", "downloads", "pictures", "videos", "music"]}},
           ["folder"]),
        fn("media_control", "Control the computer's sound and media playback.",
           {"action": {"type": "string", "enum": ["volume_up", "volume_down", "set_volume", "mute_toggle",
                                                  "play_pause", "next_track", "previous_track"]},
            "amount": {"type": "integer", "description": "volume_up / volume_down: how many percent to change "
                                                         "(default 10). set_volume: the target level, 0 to 100."}},
           ["action"]),
        fn("notes", "The user's personal notes on this computer: add a note, reminder or idea; read recent notes "
                    "back; or open the notes file.",
           {"action": {"type": "string", "enum": ["add", "read", "open"]},
            "text": {"type": "string", "description": "The note to save (action=add)."}},
           ["action"]),
        fn("web_search", "Search the internet and get a short, up-to-date answer to speak: news, weather, prices, "
                         "sports results, opening hours, or anything that may have changed recently.",
           {"query": {"type": "string", "description": "The question to research, as a full sentence (Hebrew is fine)."}},
           ["query"]),
        fn("get_current_time", "Get the current local date and time."),
        fn("set_timer", "Start a countdown timer or reminder that alerts the user when it ends "
                        "(works while the assistant's window is open).",
           {"minutes": {"type": "number", "description": "Duration in minutes; may be fractional (0.5 = 30 seconds)."},
            "label": {"type": "string", "description": "What the timer is for, in Hebrew, e.g. 'הפסטה'."}},
           ["minutes"]),
        fn("end_conversation", "End the voice conversation after the user says goodbye. "
                               "Say your short goodbye before calling this."),
    ]


def session_request(cfg: dict, minimal: bool = False) -> dict:
    session = {
        "type": "realtime",
        "model": cfg["model"],
        "instructions": build_instructions(cfg),
        "audio": {"output": {"voice": cfg["voice"]}},
        "tools": build_tools(cfg),
    }
    if not minimal:
        audio_in = {
            "transcription": {"model": cfg.get("transcribe_model") or DEFAULTS["transcribe_model"], "language": "he"},
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "prefix_padding_ms": 300,
                "silence_duration_ms": 650,
                "create_response": True,
                "interrupt_response": True,
            },
        }
        if cfg.get("noise_reduction") in ("near_field", "far_field"):
            audio_in["noise_reduction"] = {"type": cfg["noise_reduction"]}
        session["audio"]["input"] = audio_in
        speed = float(cfg.get("speed") or 1.0)
        if abs(speed - 1.0) > 0.01:
            session["audio"]["output"]["speed"] = max(0.25, min(1.5, speed))
    return {"session": session}


def create_session(cfg: dict) -> dict:
    key = api_key(cfg)
    if not key:
        return {"error": "צריך להגדיר מפתח OpenAI לפני שמתחילים.", "error_code": "no_key"}
    last = None
    for minimal in (False, True):
        try:
            data = openai_request("POST", "/v1/realtime/client_secrets", key, session_request(cfg, minimal))
        except OpenAIError as e:
            last = e
            if e.status == 400 and not minimal:
                # Protects against an option this API version doesn't know:
                # retry with only the essentials instead of failing outright.
                log(f"session options rejected ({e.message}), retrying with the basic setup")
                continue
            break
        value = data.get("value") or (data.get("client_secret") or {}).get("value")
        if not value:
            return {"error": "OpenAI לא החזירו מפתח שיחה. כדאי לנסות שוב."}
        return {"value": value, "model": cfg["model"], "sdp_url": OPENAI_BASE + "/v1/realtime/calls"}
    log(f"session error {last.status}: {last.message}")
    return {"error": hebrew_error(last, cfg["model"]), "error_code": last.code or str(last.status)}


def save_settings(body: dict) -> tuple:
    global CONFIG
    cfg = dict(CONFIG)
    warning = None
    key = str(body.get("openai_api_key") or "").strip()
    if key:
        if not key.startswith("sk-") or len(key) < 20 or any(c.isspace() for c in key):
            return 400, {"error": "זה לא נראה כמו מפתח OpenAI. מפתח תקין מתחיל ב-sk- (בלי רווחים)."}
        try:
            listing = openai_request("GET", "/v1/models", key, timeout=15)
            ids = {m.get("id") for m in listing.get("data") or [] if isinstance(m, dict)}
            model = _v_model(body.get("model"), cfg["model"])
            if ids and model not in ids:
                warning = f"המפתח נשמר, אבל המודל {model} לא מופיע בחשבון. אם השיחה לא נפתחת, כדאי לבחור מודל אחר."
        except OpenAIError as e:
            if e.status == 401:
                return 400, {"error": "OpenAI דחו את המפתח הזה. כדאי להעתיק אותו שוב, בשלמותו."}
            warning = ("לא הצלחנו לבדוק את המפתח מול OpenAI (אין חיבור), אבל הוא נשמר."
                       if e.status == 0 else hebrew_error(e))
        cfg["openai_api_key"] = key
    for field, check in SETTINGS_FIELDS.items():
        if field in body:
            cfg[field] = check(body[field], cfg.get(field, DEFAULTS[field]))
    save_config(cfg)
    CONFIG = cfg
    return 200, {"ok": True, "warning": warning, "state": state_payload()}


# ─── actions ────────────────────────────────────────────────────────────────


class ToolError(Exception):
    pass


def _open_target(target: str) -> None:
    """Open a URL, file, folder or registered URI with the system's default handler."""
    if DRY_RUN:
        log(f"[dry-run] open {target}")
        return
    if IS_WIN:
        os.startfile(target)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", target])
    else:
        subprocess.Popen(["xdg-open", target], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _clean_url(raw: str) -> str:
    url = str(raw or "").strip().strip("\"'<>")
    if not url:
        raise ToolError("missing url")
    if not re.match(r"^[A-Za-z][A-Za-z0-9+.-]*://", url):
        url = "https://" + url
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in ("http", "https") or any(c.isspace() for c in url):
        raise ToolError("only http(s) web addresses can be opened")
    try:
        host, _ = parts.hostname, parts.port  # .port raises on junk like "javascript:alert(1)"
    except ValueError:
        host = None
    if not host or ("." not in host and host != "localhost"):
        raise ToolError("that is not a valid web address")
    return url


def tool_open_website(args: dict) -> dict:
    url = _clean_url(args.get("url"))
    _open_target(url)
    return {"ok": True, "opened": url}


SEARCH_URLS = {
    "google": "https://www.google.com/search?q={}",
    "youtube": "https://www.youtube.com/results?search_query={}",
    "maps": "https://www.google.com/maps/search/?api=1&query={}",
}


def tool_open_search(args: dict) -> dict:
    engine = args.get("engine") or "google"
    query = str(args.get("query") or "").strip()
    if engine not in SEARCH_URLS:
        raise ToolError(f"unknown engine {engine}")
    if not query:
        raise ToolError("missing query")
    _open_target(SEARCH_URLS[engine].format(urllib.parse.quote_plus(query)))
    return {"ok": True, "opened": f"{engine} search: {query}"}


def _norm(s: str) -> str:
    s = str(s or "").lower()
    s = re.sub(r"[\"'׳״`.,!?()\[\]_-]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# Always present on Windows, so they're launched directly (their Start-menu
# names are translated on Hebrew Windows).
SYSTEM_APPS = [
    (("calculator", "calc", "מחשבון"), "calc.exe"),
    (("notepad", "פנקס רשימות", "פנקס", "נוטפד"), "notepad.exe"),
    (("paint", "mspaint", "צייר", "פיינט"), "mspaint.exe"),
    (("file explorer", "explorer", "files", "סייר הקבצים", "סייר", "הקבצים"), "explorer.exe"),
    (("settings", "windows settings", "הגדרות", "הגדרות המחשב"), "ms-settings:"),
    (("task manager", "מנהל המשימות"), "taskmgr.exe"),
    (("screenshot", "screen capture", "screen snip", "צילום מסך"), "ms-screenclip:"),
    (("camera", "מצלמה"), "microsoft.windows.camera:"),
]
SYSTEM_APPS = [(tuple(_norm(a) for a in names), target) for names, target in SYSTEM_APPS]

# Hebrew names -> the English name the Start menu uses.
HEBREW_APP_NAMES = {
    "וורד": "word", "אקסל": "excel", "פאוורפוינט": "powerpoint", "פאואר פוינט": "powerpoint",
    "אאוטלוק": "outlook", "וואן נוט": "onenote", "טימס": "teams", "כרום": "chrome", "גוגל כרום": "google chrome",
    "אדג'": "edge", "אדג": "edge", "פיירפוקס": "firefox", "ספוטיפיי": "spotify", "וואטסאפ": "whatsapp",
    "ווטסאפ": "whatsapp", "טלגרם": "telegram", "זום": "zoom", "סקייפ": "skype", "דיסקורד": "discord",
    "פרמייר": "premiere", "פרימייר": "premiere", "פוטושופ": "photoshop", "אילוסטרייטור": "illustrator",
    "אפטר אפקטס": "after effects", "אודישן": "audition", "לייטרום": "lightroom", "קאפקאט": "capcut",
    "קאפ קאט": "capcut", "קפקאט": "capcut", "דה וינצ'י": "davinci resolve", "דווינצ'י": "davinci resolve",
    "קנבה": "canva", "פיגמה": "figma", "קלוד": "claude", "צ'אט ג'יפיטי": "chatgpt", "צ'טג'יפיטי": "chatgpt",
    "וי אל סי": "vlc", "נטפליקס": "netflix", "אנידסק": "anydesk", "דרופבוקס": "dropbox", "אובס": "obs",
    "גוגל דרייב": "google drive", "וואן דרייב": "onedrive", "וי אס קוד": "visual studio code",
}
HEBREW_APP_NAMES = {_norm(k): v for k, v in HEBREW_APP_NAMES.items()}

# Last resort when an app isn't found in the Start menu.
FALLBACK_TARGETS = {
    "chrome": "chrome.exe", "google chrome": "chrome.exe", "edge": "msedge.exe", "microsoft edge": "msedge.exe",
    "word": "winword.exe", "excel": "excel.exe", "powerpoint": "powerpnt.exe", "outlook": "outlook.exe",
    "spotify": "spotify:", "whatsapp": "whatsapp:",
}

_start_apps: list | None = None
_start_apps_at = 0.0
_start_apps_lock = threading.Lock()


def _load_start_apps(refresh: bool = False) -> list:
    """Every app in the Windows Start menu (desktop and Store apps) as (name, AppID)."""
    global _start_apps, _start_apps_at
    with _start_apps_lock:
        if _start_apps is not None and not refresh:
            return _start_apps
        apps = []
        if IS_WIN:
            ps = ("[Console]::OutputEncoding=[Text.Encoding]::UTF8; "
                  "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress")
            try:
                out = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
                                     capture_output=True, timeout=30,
                                     creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
                data = json.loads(out.stdout.decode("utf-8-sig", "replace") or "[]")
                if isinstance(data, dict):
                    data = [data]
                apps = [(d["Name"], d["AppID"]) for d in data
                        if isinstance(d, dict) and d.get("Name") and d.get("AppID")]
            except Exception as e:
                log(f"could not list Start menu apps: {e}")
        _start_apps, _start_apps_at = apps, time.time()
        return apps


def _app_score(query: str, name: str) -> float:
    q, n = _norm(query), _norm(name)
    if not q or not n:
        return 0.0
    if q == n:
        return 100.0
    qt, nt = q.split(), n.split()
    if all(t in nt for t in qt):
        return 60 + 30 * len(set(qt) & set(nt)) / len(set(nt))  # prefer names with fewer extra words
    if len(q) >= 3 and q in n:
        return 40 + 20 * len(q) / len(n)
    # Misheard or misspelled names ("capcat", "photoshp"): compare against the whole
    # name and each word of it. Same first letter only, so "teams" never opens Steam.
    ratio = max((difflib.SequenceMatcher(None, q, part).ratio() for part in [n] + nt if part[0] == q[0]), default=0.0)
    return 30 + 10 * ratio if ratio >= 0.8 else 0.0


def _best_start_app(query: str, apps: list):
    best, best_score = None, 0.0
    for name, appid in apps:
        score = _app_score(query, name)
        if score > best_score:
            best, best_score = (name, appid), score
    return best if best_score >= 35 else None


def tool_open_app(args: dict) -> dict:
    raw = str(args.get("name") or "").strip()
    if not raw:
        raise ToolError("missing app name")
    query = HEBREW_APP_NAMES.get(_norm(raw), raw)
    nq, nraw = _norm(query), _norm(raw)

    for label, target in (CONFIG.get("apps") or {}).items():  # the user's own list comes first
        if max(_app_score(query, label), _app_score(raw, label)) >= 60:
            _open_target(os.path.expandvars(str(target)))
            return {"ok": True, "opened": label}

    for names, target in SYSTEM_APPS:
        if nq in names or nraw in names:
            if not IS_WIN and not DRY_RUN:
                raise ToolError("this app can only be opened on Windows")
            _open_target(target)
            return {"ok": True, "opened": names[0]}

    apps = _load_start_apps()
    found = _best_start_app(query, apps) or (_best_start_app(raw, apps) if nraw != nq else None)
    if not found and time.time() - _start_apps_at > 60:  # maybe it was installed since we last looked
        apps = _load_start_apps(refresh=True)
        found = _best_start_app(query, apps)
    if found:
        name, appid = found
        if DRY_RUN:
            log(f"[dry-run] launch {name} ({appid})")
        else:
            subprocess.Popen(["explorer.exe", "shell:AppsFolder\\" + appid])
        return {"ok": True, "opened": name}

    if nq in FALLBACK_TARGETS and (IS_WIN or DRY_RUN):
        try:
            _open_target(FALLBACK_TARGETS[nq])
            return {"ok": True, "opened": query}
        except OSError:
            pass
    similar = difflib.get_close_matches(nq, [_norm(n) for n, _ in apps], n=3, cutoff=0.5)
    return {"ok": False, "error": f"'{raw}' was not found on this computer", "similar": similar}


FOLDERS = {  # tool value -> (Windows shell folder, folder name under home elsewhere)
    "desktop": ("shell:Desktop", "Desktop"),
    "documents": ("shell:Personal", "Documents"),
    "downloads": ("shell:Downloads", "Downloads"),
    "pictures": ("shell:My Pictures", "Pictures"),
    "videos": ("shell:My Video", "Videos"),
    "music": ("shell:My Music", "Music"),
}


def tool_open_folder(args: dict) -> dict:
    folder = args.get("folder")
    if folder not in FOLDERS:
        raise ToolError(f"unknown folder {folder}")
    shell_name, home_name = FOLDERS[folder]
    if DRY_RUN:
        log(f"[dry-run] open folder {shell_name}")
    elif IS_WIN:
        subprocess.Popen(["explorer.exe", shell_name])
    else:
        _open_target(str(Path.home() / home_name))
    return {"ok": True, "opened": folder}


MEDIA_KEYS = {
    "volume_up": 0xAF, "volume_down": 0xAE, "mute_toggle": 0xAD,
    "play_pause": 0xB3, "next_track": 0xB0, "previous_track": 0xB1,
}


def _press_key(vk: int, times: int = 1) -> None:
    if DRY_RUN:
        log(f"[dry-run] key 0x{vk:X} x{times}")
        return
    if not IS_WIN:
        raise ToolError("media keys work on Windows only")
    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    for _ in range(times):
        user32.keybd_event(vk, 0, 0x1, 0)        # KEYEVENTF_EXTENDEDKEY
        user32.keybd_event(vk, 0, 0x1 | 0x2, 0)  # ... | KEYEVENTF_KEYUP
        time.sleep(0.005)


def tool_media_control(args: dict) -> dict:
    action = args.get("action")
    try:
        amount = int(float(args.get("amount")))
    except (TypeError, ValueError):
        amount = None
    # Each press of a volume key moves Windows' volume by 2%.
    if action in ("volume_up", "volume_down"):
        pct = amount if amount and amount > 0 else 10
        _press_key(MEDIA_KEYS[action], max(1, min(50, round(pct / 2))))
        return {"ok": True, "done": f"{action} ~{pct}%"}
    if action == "set_volume":
        if amount is None:
            raise ToolError("set_volume needs amount 0-100")
        level = max(0, min(100, amount))
        _press_key(MEDIA_KEYS["volume_down"], 50)  # down to 0, then up to the target
        _press_key(MEDIA_KEYS["volume_up"], round(level / 2))
        return {"ok": True, "volume": level}
    if action in MEDIA_KEYS:
        _press_key(MEDIA_KEYS[action])
        return {"ok": True, "done": action}
    raise ToolError(f"unknown action {action}")


_notes_lock = threading.Lock()


def tool_notes(args: dict) -> dict:
    action = args.get("action")
    if action == "add":
        text = " ".join(str(args.get("text") or "").split())[:1000]
        if not text:
            raise ToolError("empty note")
        with _notes_lock:
            new = not NOTES_PATH.exists()
            # A BOM on a new file makes every Notepad version read the Hebrew right.
            with open(NOTES_PATH, "a", encoding="utf-8-sig" if new else "utf-8") as f:
                f.write(f"[{dt.datetime.now():%d/%m/%Y %H:%M}] {text}\n")
        return {"ok": True, "saved": text}
    if action == "read":
        try:
            lines = [ln for ln in NOTES_PATH.read_text(encoding="utf-8-sig").splitlines() if ln.strip()]
        except FileNotFoundError:
            lines = []
        return {"ok": True, "notes": lines[-15:], "total": len(lines)}
    if action == "open":
        with _notes_lock:
            if not NOTES_PATH.exists():
                NOTES_PATH.write_text("", encoding="utf-8-sig")
        _open_target(str(NOTES_PATH))
        return {"ok": True}
    raise ToolError(f"unknown action {action}")


def _response_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"].strip()
    parts = []
    for item in data.get("output") or []:
        if isinstance(item, dict) and item.get("type") == "message":
            for c in item.get("content") or []:
                if isinstance(c, dict) and c.get("type") in ("output_text", "text") and c.get("text"):
                    parts.append(c["text"])
    return "\n".join(parts).strip()


def _speakable(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)  # [label](url) -> label
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[*_#`>]+", "", text)
    text = re.sub(r"\(\s*\)", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


SEARCH_TOOL_VARIANTS = (
    {"type": "web_search", "user_location": {"type": "approximate", "country": "IL"}},
    {"type": "web_search"},
    {"type": "web_search_preview"},
)


def tool_web_search(args: dict) -> dict:
    query = str(args.get("query") or "").strip()
    if not query:
        raise ToolError("missing query")
    key = api_key(CONFIG)
    if not key:
        raise ToolError("no OpenAI key configured")
    now = dt.datetime.now()
    body = {
        "model": CONFIG.get("search_model") or DEFAULTS["search_model"],
        "instructions": (
            "You are the research helper of a Hebrew voice assistant. Search the web and answer the question in "
            "Hebrew, in two to four short sentences that sound natural when read aloud. No lists, no markdown, "
            "no URLs. Mention the source's name briefly when it matters. "
            f"Today is {now:%A, %d %B %Y}; assume the user is in Israel unless the question says otherwise."
        ),
        "input": query,
        "max_output_tokens": 500,
    }
    data = None
    for variant in SEARCH_TOOL_VARIANTS:  # newest tool format first, then older ones
        try:
            data = openai_request("POST", "/v1/responses", key, dict(body, tools=[variant]), timeout=60)
            break
        except OpenAIError as e:
            if e.status != 400:
                raise ToolError(hebrew_error(e, body["model"])) from None
            log(f"web search with {variant['type']} rejected: {e.message}")
    if data is None:
        raise ToolError(f"web search is not available with the model {body['model']}")
    answer = _speakable(_response_text(data))
    if not answer:
        raise ToolError("the search came back empty")
    return {"ok": True, "answer": answer[:1500]}


TOOLS = {
    "open_website": tool_open_website,
    "open_search": tool_open_search,
    "open_app": tool_open_app,
    "open_folder": tool_open_folder,
    "media_control": tool_media_control,
    "notes": tool_notes,
    "web_search": tool_web_search,
}


def run_tool(name: str, args) -> dict:
    fn = TOOLS.get(name)
    if not fn:
        return {"ok": False, "error": f"unknown tool {name}"}
    try:
        result = fn(args if isinstance(args, dict) else {})
    except ToolError as e:
        result = {"ok": False, "error": str(e)}
    except Exception as e:
        log(f"tool {name} crashed: {e!r}\n{traceback.format_exc()}")
        result = {"ok": False, "error": f"unexpected error: {e}"}
    log(f"tool {name} {json.dumps(args, ensure_ascii=False)[:200]} -> {'ok' if result.get('ok') else result.get('error')}")
    return result


# ─── window, hotkey, events ─────────────────────────────────────────────────


class EventHub:
    """Pushes events (the global hotkey, shutdown) to open windows over Server-Sent Events."""

    def __init__(self):
        self._clients: set = set()
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue()
        with self._lock:
            self._clients.add(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            self._clients.discard(q)

    def publish(self, event: dict) -> int:
        with self._lock:
            clients = list(self._clients)
        for q in clients:
            q.put(event)
        return len(clients)


EVENTS = EventHub()


def _find_browser(pref: str):
    if IS_WIN:
        roots = [os.environ.get(v) for v in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")]
        chrome = [Path(r) / "Google/Chrome/Application/chrome.exe" for r in roots if r]
        edge = [Path(r) / "Microsoft/Edge/Application/msedge.exe" for r in roots if r]
    elif sys.platform == "darwin":
        chrome = [Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")]
        edge = [Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")]
    else:
        chrome = [Path(p) for p in map(shutil.which, ("google-chrome", "chromium", "chromium-browser")) if p]
        edge = [Path(p) for p in map(shutil.which, ("microsoft-edge",)) if p]
    order = {"chrome": chrome, "edge": edge}.get(pref, chrome + edge)
    return next((str(p) for p in order if p.is_file()), None)


def open_window(autostart: bool = False, port: int | None = None) -> None:
    url = f"http://127.0.0.1:{port or PORT}/" + ("?autostart=1" if autostart else "")
    if NO_WINDOW or DRY_RUN:
        log(f"window: {url}")
        return
    pref = CONFIG.get("browser", "auto")
    exe = None if pref == "default" else _find_browser(pref)
    if exe:
        try:
            # App mode: a clean window of its own, without tabs or an address bar.
            subprocess.Popen([exe, f"--app={url}", "--window-size=460,800"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except OSError as e:
            log(f"could not start {exe}: {e}")
    webbrowser.open(url)


def bring_window_to_front() -> None:
    if not IS_WIN or DRY_RUN:
        return
    from ctypes import wintypes
    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    found = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)  # type: ignore[attr-defined]
    def each(hwnd, _):
        length = user32.GetWindowTextLengthW(hwnd)
        if length and user32.IsWindowVisible(hwnd):
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            if WINDOW_TITLE in buf.value:
                found.append(hwnd)
                return False
        return True

    user32.EnumWindows(each, 0)
    if found:
        if user32.IsIconic(found[0]):
            user32.ShowWindow(found[0], 9)  # SW_RESTORE
        user32.SetForegroundWindow(found[0])


def on_hotkey() -> None:
    HOTKEY_ACK.clear()
    if EVENTS.publish({"type": "hotkey"}) and HOTKEY_ACK.wait(1.5):
        bring_window_to_front()
    else:  # no window is open: open one that starts listening right away
        open_window(autostart=True)


def parse_hotkey(spec: str) -> tuple:
    mods, vk = 0, None
    for part in [p.strip().lower() for p in str(spec).split("+") if p.strip()]:
        if part in ("ctrl", "control"):
            mods |= 0x2
        elif part == "alt":
            mods |= 0x1
        elif part == "shift":
            mods |= 0x4
        elif part in ("win", "windows"):
            mods |= 0x8
        elif part == "space":
            vk = 0x20
        elif re.fullmatch(r"f([1-9]|1[0-9]|2[0-4])", part):
            vk = 0x6F + int(part[1:])
        elif len(part) == 1 and part.isascii() and part.isalnum():
            vk = ord(part.upper())
        else:
            raise ValueError(f"unknown key '{part}'")
    if vk is None or not mods:
        raise ValueError("a hotkey needs at least one modifier and one key, e.g. ctrl+alt+space")
    return mods, vk


def start_hotkey(spec: str, callback) -> bool:
    if not IS_WIN or not spec:
        return False
    try:
        mods, vk = parse_hotkey(spec)
    except ValueError as e:
        log(f"hotkey '{spec}' ignored: {e}")
        return False
    ready, result = threading.Event(), {"ok": False}

    def loop():
        from ctypes import wintypes
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        if not user32.RegisterHotKey(None, 1, mods | 0x4000, vk):  # MOD_NOREPEAT
            log(f"hotkey {spec} is already taken by another program (clicking still works)")
            ready.set()
            return
        result["ok"] = True
        ready.set()
        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            if msg.message == 0x0312:  # WM_HOTKEY
                try:
                    callback()
                except Exception as e:
                    log(f"hotkey handler failed: {e!r}")

    threading.Thread(target=loop, name="hotkey", daemon=True).start()
    ready.wait(3)
    return result["ok"]


# ─── HTTP server ────────────────────────────────────────────────────────────

STATIC = {
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/icon.svg": ("icon.svg", "image/svg+xml"),
}


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows SO_REUSEADDR would let two copies share the port.
    allow_reuse_address = not IS_WIN


class Handler(BaseHTTPRequestHandler):
    server_version = f"VoiceAssistant/{VERSION}"

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    def _send(self, status: int, body: bytes, ctype: str, extra: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj: dict) -> None:
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _allowed(self, need_token: bool) -> bool:
        # The Host check stops DNS-rebinding sites; the token (only readable by our own
        # page) stops other sites in the browser from driving the assistant.
        if (self.headers.get("Host") or "").lower() not in ALLOWED_HOSTS:
            self._json(403, {"error": "forbidden host"})
            return False
        origin = self.headers.get("Origin")
        if origin and origin.lower() not in ALLOWED_ORIGINS:
            self._json(403, {"error": "forbidden origin"})
            return False
        if need_token:
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            token = self.headers.get("X-Token") or query.get("t", [""])[0]
            if not secrets.compare_digest(token.encode("utf-8"), TOKEN.encode("utf-8")):
                self._json(403, {"error": "forbidden"})
                return False
        return True

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/ping":  # lets a second launch find this one; reveals nothing
            return self._json(200, {"app": APP_ID, "version": VERSION})
        if not self._allowed(need_token=path.startswith("/api/")):
            return
        if path == "/":
            return self._page()
        if path in STATIC:
            name, ctype = STATIC[path]
            try:
                return self._send(200, (WEB_DIR / name).read_bytes(), ctype)
            except OSError:
                return self._json(404, {"error": "missing file"})
        if path == "/api/state":
            return self._json(200, state_payload())
        if path == "/api/events":
            return self._events()
        self._json(404, {"error": "not found"})

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if not self._allowed(need_token=True):
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > 65536:
                return self._json(413, {"error": "too large"})
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}") if length else {}
            if not isinstance(body, dict):
                raise ValueError("expected an object")
        except ValueError:
            return self._json(400, {"error": "bad json"})
        if path == "/api/settings":
            return self._json(*save_settings(body))
        if path == "/api/session":
            return self._json(200, create_session(CONFIG))
        if path == "/api/tool":
            return self._json(200, run_tool(str(body.get("name") or ""), body.get("args") or {}))
        if path == "/api/hotkey-ack":
            HOTKEY_ACK.set()
            return self._json(200, {"ok": True})
        if path == "/api/shutdown":
            self._json(200, {"ok": True})
            log("shutting down (from the window)")
            EVENTS.publish({"type": "shutdown"})
            SHUTTING_DOWN.set()
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        self._json(404, {"error": "not found"})

    def _page(self) -> None:
        html = (WEB_DIR / "index.html").read_text(encoding="utf-8").replace("__VA_TOKEN__", TOKEN)
        csp = ("default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; "
               "font-src https://fonts.gstatic.com; img-src 'self' data:; "
               f"connect-src 'self' {OPENAI_BASE}; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self._send(200, html.encode("utf-8"), "text/html; charset=utf-8",
                   {"Content-Security-Policy": csp, "Referrer-Policy": "no-referrer"})

    def _events(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        q = EVENTS.subscribe()
        try:
            self.wfile.write(b"retry: 3000\n\n")
            self.wfile.flush()
            while True:
                try:
                    event = q.get(timeout=10)
                except queue.Empty:
                    if SHUTTING_DOWN.is_set():
                        break
                    self.wfile.write(b": ping\n\n")  # also how we notice a closed window
                    self.wfile.flush()
                    continue
                self.wfile.write(f"data: {json.dumps(event)}\n\n".encode("utf-8"))
                self.wfile.flush()
                if event.get("type") == "shutdown":
                    break
        except OSError:  # the window was closed
            pass
        finally:
            EVENTS.unsubscribe(q)


def already_running(port: int) -> bool:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(f"http://127.0.0.1:{port}/api/ping", timeout=1.5) as r:
            return json.loads(r.read().decode("utf-8")).get("app") == APP_ID
    except Exception:
        return False


def _console(title: str | None = None, minimize: bool = False) -> None:
    if not IS_WIN:
        return
    try:
        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        if title:
            kernel32.SetConsoleTitleW(title)
        # A click inside a console in QuickEdit mode pauses the program until a key is
        # pressed, which would freeze the assistant. Turn QuickEdit off.
        stdin, mode = kernel32.GetStdHandle(-10), ctypes.c_uint32()
        if kernel32.GetConsoleMode(stdin, ctypes.byref(mode)):
            kernel32.SetConsoleMode(stdin, (mode.value & ~0x0040) | 0x0080)  # -QUICK_EDIT, +EXTENDED_FLAGS
        hwnd = kernel32.GetConsoleWindow()
        if minimize and hwnd:
            ctypes.windll.user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE  # type: ignore[attr-defined]
    except Exception:
        pass


def main() -> None:
    global CONFIG, PORT, ALLOWED_HOSTS, ALLOWED_ORIGINS, HOTKEY_ACTIVE, NO_WINDOW
    ap = argparse.ArgumentParser(description="Hebrew desktop voice assistant (local server)")
    ap.add_argument("--port", type=int, default=int(os.environ.get("VA_PORT") or DEFAULT_PORT))
    ap.add_argument("--no-window", action="store_true", help="don't open the assistant window")
    args = ap.parse_args()
    NO_WINDOW = args.no_window
    CONFIG = load_config()
    trim_log()

    if already_running(args.port):
        log("the assistant is already running, opening its window")
        open_window(port=args.port)
        return

    httpd = None
    for port in range(args.port, args.port + 10):
        try:
            httpd = Server(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    if httpd is None:
        raise SystemExit(f"No free port between {args.port} and {args.port + 9}.")
    PORT = httpd.server_address[1]
    ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
    ALLOWED_ORIGINS = {f"http://{h}" for h in ALLOWED_HOSTS}
    HOTKEY_ACTIVE = start_hotkey(CONFIG.get("hotkey", ""), on_hotkey)
    threading.Thread(target=_load_start_apps, name="start-apps", daemon=True).start()

    log(f"Voice assistant {VERSION} is running on http://127.0.0.1:{PORT}")
    log(f"Settings and notes: {DATA_DIR}")
    if HOTKEY_ACTIVE:
        log(f"Hotkey: {CONFIG.get('hotkey')}")
    log("Keep this window open (it can stay minimized). Closing it turns the assistant off.")
    open_window()
    _console("Voice Assistant - keep open (minimized is fine)", minimize=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        SHUTTING_DOWN.set()
        httpd.server_close()


if __name__ == "__main__":
    if sys.version_info < (3, 8):
        sys.exit("Python 3.8 or newer is needed.")
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        log("the assistant crashed:\n" + traceback.format_exc())
        if IS_WIN:
            input("\nPress Enter to close...")
        sys.exit(1)
