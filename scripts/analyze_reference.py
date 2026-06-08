"""
Reference video analysis — extract editing style signals so we can match
the user's video to a known preset (or build a custom one).

Returns:
  {
    "aspect_ratio": "9:16" | "16:9" | "1:1" | "4:5" | "original",
    "avg_brightness": 0.0..1.0,
    "avg_saturation": 0.0..1.0,
    "color_warmth": -1.0..1.0,        # -1 = cool/blue, +1 = warm/orange
    "scene_cuts_per_minute": float,
    "audio_dynamics_db": float,        # range between loud and quiet
    "has_face": bool,
    "estimated_template": str,         # closest matching template ID
    "estimated_style_id": str,         # closest REFERENCE_STYLES preset ID
    "video_aspect": "vertical"|"horizontal"|"square",
  }
"""

import argparse
import json
import os
import sys
import subprocess
import re

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def analyze(video_path: str) -> dict:
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open: {video_path}"}

    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total / fps if fps > 0 else 0

    # Aspect classification
    if src_h > 0 and src_w / src_h <= 0.7:
        aspect_ratio = "9:16"
    elif src_h > 0 and 0.7 < src_w / src_h <= 0.95:
        aspect_ratio = "4:5"
    elif src_h > 0 and 0.95 < src_w / src_h <= 1.05:
        aspect_ratio = "1:1"
    else:
        aspect_ratio = "16:9"

    # Sample frames for color analysis
    log(f"Sampling {min(20, total)} frames for color...")
    samples = min(20, total)
    step = max(1, total // samples)
    brightnesses = []
    saturations = []
    warmths = []
    prev_frame = None
    cut_count = 0

    for i in range(0, total, step):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ret, frame = cap.read()
        if not ret:
            continue
        small = cv2.resize(frame, (160, 90))
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        brightnesses.append(float(hsv[..., 2].mean()) / 255.0)
        saturations.append(float(hsv[..., 1].mean()) / 255.0)
        # warmth: red+yellow channels vs blue
        b, g, r = cv2.split(small)
        warmths.append(float(r.mean() - b.mean()) / 255.0)
        # scene cut: large diff vs previous sampled frame
        if prev_frame is not None:
            diff = np.abs(small.astype(int) - prev_frame.astype(int)).mean()
            if diff > 35:
                cut_count += 1
        prev_frame = small

    cap.release()

    avg_brightness = float(np.mean(brightnesses)) if brightnesses else 0.5
    avg_saturation = float(np.mean(saturations)) if saturations else 0.5
    color_warmth = float(np.mean(warmths)) if warmths else 0.0
    scene_cuts_per_minute = (cut_count / max(duration, 1)) * 60

    # Audio dynamics — quick RMS range via ffmpeg astats
    log("Analyzing audio dynamics...")
    audio_dynamics_db = analyze_audio_dynamics(video_path)

    # Face presence — sample 5 frames with MediaPipe
    log("Detecting face presence...")
    has_face = False
    try:
        import mediapipe as mp
        cap2 = cv2.VideoCapture(video_path)
        detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1, min_detection_confidence=0.5,
        )
        face_hits = 0
        face_samples = 5
        for i in range(face_samples):
            cap2.set(cv2.CAP_PROP_POS_FRAMES, int(i * total / face_samples))
            ret, f = cap2.read()
            if not ret:
                continue
            rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
            r = detector.process(rgb)
            if r.detections:
                face_hits += 1
        cap2.release()
        has_face = (face_hits / face_samples) >= 0.4
    except Exception as e:
        log(f"Face detect skipped: {e}")

    # Match to closest preset style — heuristic scoring
    estimated_style_id = match_preset(
        aspect_ratio=aspect_ratio,
        avg_saturation=avg_saturation,
        scene_cuts_per_minute=scene_cuts_per_minute,
        audio_dynamics_db=audio_dynamics_db,
        has_face=has_face,
    )

    return {
        "aspect_ratio": aspect_ratio,
        "video_aspect": (
            "vertical" if src_h > src_w * 1.1
            else "horizontal" if src_w > src_h * 1.1
            else "square"
        ),
        "video_width": src_w,
        "video_height": src_h,
        "duration_sec": round(duration, 2),
        "avg_brightness": round(avg_brightness, 3),
        "avg_saturation": round(avg_saturation, 3),
        "color_warmth": round(color_warmth, 3),
        "scene_cuts_per_minute": round(scene_cuts_per_minute, 2),
        "audio_dynamics_db": round(audio_dynamics_db, 2),
        "has_face": has_face,
        "estimated_style_id": estimated_style_id,
    }


def analyze_audio_dynamics(video_path: str) -> float:
    """
    Return range (max - min) of RMS in dB across audio.
    High = dynamic content (e.g. emotional speech). Low = uniform.
    """
    try:
        cmd = [
            "ffmpeg", "-i", video_path,
            "-af", "astats=metadata=1:reset=1:length=0.5",
            "-f", "null", "-",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        rms_values = []
        for line in result.stderr.split("\n"):
            m = re.search(r"Overall\.RMS_level=([-\d.]+)", line)
            if m:
                try:
                    v = float(m.group(1))
                    if v > -100:
                        rms_values.append(v)
                except ValueError:
                    pass
        if len(rms_values) < 4:
            return 0.0
        return float(max(rms_values) - min(rms_values))
    except Exception:
        return 0.0


def match_preset(
    aspect_ratio: str,
    avg_saturation: float,
    scene_cuts_per_minute: float,
    audio_dynamics_db: float,
    has_face: bool,
) -> str:
    """
    Heuristic mapping of measured signals to one of the REFERENCE_STYLES.
    See referenceStyles.ts for the destination IDs.
    """
    # Many fast cuts + high saturation = high-energy (Hormozi/TikTok)
    if scene_cuts_per_minute > 8 and avg_saturation > 0.4:
        return "hormozi" if audio_dynamics_db > 15 else "tiktok-energy"

    # Vertical + talking head + moderate dynamics = podcast
    if aspect_ratio in ("9:16", "4:5") and has_face and audio_dynamics_db > 8:
        return "rollin"

    # 4:5 + saturated = Instagram modern
    if aspect_ratio == "4:5" and avg_saturation > 0.35:
        return "instagram-modern"

    # Few cuts + low dynamics = calm podcast / lecture
    if scene_cuts_per_minute < 3 and audio_dynamics_db < 12:
        return "podcast-calm"

    # Default to Captions Default
    return "captions"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video_path")
    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(json.dumps({"error": f"File not found: {args.video_path}"}), file=sys.stderr)
        sys.exit(1)

    try:
        result = analyze(args.video_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
