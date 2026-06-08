"""
Whisper transcription script for Hebrew video subtitles.
Supports both built-in Whisper models AND HuggingFace CT2 models (e.g. ivrit-ai Hebrew-tuned).

Usage:
  python transcribe.py <video_path> [--model <id>] [--language he]

Model IDs accepted:
  - Built-in: tiny | base | small | medium | large-v2 | large-v3
  - HuggingFace: any CT2-compatible Whisper model (e.g. "ivrit-ai/whisper-large-v3-turbo-ct2")

Output JSON to stdout:
  {
    "language": "he",
    "duration": 12.34,
    "model": "ivrit-ai/whisper-large-v3-turbo-ct2",
    "subtitles": [
      { "id": "1", "start": 0.5, "end": 2.3, "text": "...", "words": [...] }
    ]
  }
"""

import argparse
import json
import sys
import os

# Force UTF-8 output on Windows (default is cp1255/cp1252 which mangles Hebrew)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def log(msg: str) -> None:
    """Progress logs to stderr (stdout reserved for final JSON)."""
    print(msg, file=sys.stderr, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path", help="Path to video/audio file")
    parser.add_argument(
        "--model",
        default="ivrit-ai/whisper-large-v3-turbo-ct2",
        help="Whisper model: built-in name OR HuggingFace ID",
    )
    parser.add_argument("--language", default="he", help="Language code (he for Hebrew)")
    parser.add_argument("--max-words-per-line", type=int, default=2)
    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(
            json.dumps({"error": f"File not found: {args.video_path}"}),
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps({"error": "faster-whisper not installed"}),
            file=sys.stderr,
        )
        sys.exit(2)

    # Load the model with int8 quantization to roughly HALVE memory usage
    # (large-v3-turbo float32 ≈ 2GB+ → int8 ≈ 1GB). On a memory-constrained
    # machine the float path crashes with a Windows Access Violation
    # (exit code 3221225794) the moment allocation fails. int8 keeps quality
    # nearly identical for speech while fitting in available RAM.
    #
    # Fallback chain: if the requested model can't load (OOM / crash), retry
    # with progressively smaller models so the user always gets *some* result.
    fallback_chain = [
        (args.model, "int8"),
        (args.model, "int8_float32"),
        ("medium", "int8"),
        ("small", "int8"),
    ]

    model = None
    last_err = None
    for model_id, ctype in fallback_chain:
        try:
            log(f"Loading model: {model_id} (compute_type={ctype})")
            model = WhisperModel(model_id, device="cpu", compute_type=ctype)
            log(f"Model loaded: {model_id}")
            break
        except Exception as e:  # noqa: BLE001 — we want any failure to fall through
            last_err = e
            log(f"Model {model_id}/{ctype} failed: {e}")
            model = None

    if model is None:
        print(
            json.dumps({"error": f"All models failed to load. Last: {last_err}"}),
            file=sys.stderr,
        )
        sys.exit(3)

    log(f"Transcribing {args.video_path}")
    segments, info = model.transcribe(
        args.video_path,
        language=args.language,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
        beam_size=5,
        # Better Hebrew quality:
        condition_on_previous_text=True,
        temperature=0.0,
    )

    # Collect all words across all segments
    all_words = []
    for seg in segments:
        if not seg.words:
            continue
        for w in seg.words:
            text = (w.word or "").strip()
            if not text:
                continue
            all_words.append(
                {"word": text, "start": round(w.start, 3), "end": round(w.end, 3)}
            )

    # Stutter + filler cleanup. Whisper transcribes speech verbatim including:
    #   - hesitations: "אמ", "אה", "אהה", "ממ", "מממ"
    #   - English fillers: "um", "uh"
    #   - consecutive duplicate words (real stutter or false repeats)
    # We strip these so the subtitles flow naturally.
    FILLERS = {
        "אמ", "אם", "אה", "אהה", "אהמ", "ממ", "מממ", "ההה",
        "um", "uh", "uhh", "umm", "hmm", "er", "ehm",
    }

    def clean(words):
        cleaned = []
        prev_clean = None  # lowercased + stripped of punctuation
        for w in words:
            text = w["word"].strip()
            # Strip surrounding punctuation when comparing for dup
            stripped = "".join(c for c in text if c.isalnum() or c.isalpha())
            low = stripped.lower()
            if not stripped:
                # Pure punctuation — attach to previous word if any
                if cleaned:
                    cleaned[-1] = {
                        **cleaned[-1],
                        "word": cleaned[-1]["word"] + text,
                        "end": w["end"],
                    }
                continue
            if low in FILLERS:
                continue
            # Consecutive duplicate of the same word? Drop.
            if prev_clean is not None and low == prev_clean:
                # Extend previous word's end to absorb this duplicate's duration
                cleaned[-1] = {**cleaned[-1], "end": w["end"]}
                continue
            cleaned.append(w)
            prev_clean = low
        return cleaned

    all_words = clean(all_words)

    # Re-chunk words into subtitle lines based on max-words-per-line
    subtitles = []
    chunk_size = args.max_words_per_line
    for i in range(0, len(all_words), chunk_size):
        chunk = all_words[i : i + chunk_size]
        if not chunk:
            continue
        subtitles.append(
            {
                "id": str(len(subtitles) + 1),
                "start": chunk[0]["start"],
                "end": chunk[-1]["end"],
                "text": " ".join(w["word"] for w in chunk),
                "words": chunk,
            }
        )

    result = {
        "language": info.language,
        "duration": round(info.duration, 3),
        "model": args.model,
        "subtitles": subtitles,
    }

    log(f"Done: {len(subtitles)} subtitles, {len(all_words)} words")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
