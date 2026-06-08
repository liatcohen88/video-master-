"""
Video analysis for auto-editing decisions.

Detects:
  - Speaker face position (where to center the frame when cropping)
  - Face presence over time (talking head vs B-roll)
  - Audio loudness / speech rate (energy level → template choice)

Output JSON to stdout:
  {
    "face_detected": true,
    "face_center_x": 0.52,        // 0=left, 1=right
    "face_center_y": 0.38,        // 0=top, 1=bottom
    "face_size_ratio": 0.28,       // face width / video width
    "face_detection_rate": 0.95,   // % of sampled frames with face
    "is_talking_head": true,
    "duration_sec": 12.34,
    "video_aspect": "horizontal",  // horizontal | vertical | square
    "recommended_aspect": "9:16",
    "recommended_mode": "podcast",
    "recommended_template": "ali"
  }
"""

import argparse
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def detect_emphasis_moments(video_path: str, duration_sec: float) -> list:
    """
    Find timestamps where audio energy peaks — moments where the speaker
    emphasizes a point. These become smart zoom-punch keyframes.

    Uses FFmpeg loudnorm/astats to sample RMS over windows. Picks the
    top-N windows by RMS as "emphasis moments".
    """
    import subprocess
    import re

    # Extract audio RMS per 0.5-second window using astats
    # Sample at 0.5s windows for fine-grained loudness data
    cmd = [
        "ffmpeg", "-i", video_path,
        "-af", "astats=metadata=1:reset=1:length=0.5",
        "-f", "null", "-",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception:
        return []

    # Parse "lavfi.astats.Overall.RMS_level" values from stderr
    samples = []
    cur_time = 0.0
    rms_values = []
    for line in result.stderr.split("\n"):
        m_pts = re.search(r"pts_time:([\d.]+)", line)
        if m_pts:
            cur_time = float(m_pts.group(1))
        m_rms = re.search(r"Overall\.RMS_level=([-\d.]+)", line)
        if m_rms:
            try:
                rms_db = float(m_rms.group(1))
                if rms_db > -100:  # filter "-inf" markers
                    samples.append({"t": cur_time, "rms": rms_db})
                    rms_values.append(rms_db)
            except ValueError:
                pass

    if len(samples) < 4:
        return []

    # Find peaks: windows whose RMS is in the top 30% AND noticeably higher
    # than their neighbors.
    rms_sorted = sorted(rms_values, reverse=True)
    threshold = rms_sorted[int(len(rms_sorted) * 0.3)]  # top 30% threshold

    emphasis = []
    prev_picked = -10.0
    min_gap = 1.5  # don't pick two emphases closer than 1.5s
    for i, s in enumerate(samples):
        if s["rms"] < threshold:
            continue
        # local max check
        left = samples[i - 1]["rms"] if i > 0 else -100
        right = samples[i + 1]["rms"] if i < len(samples) - 1 else -100
        if s["rms"] >= left and s["rms"] >= right and s["t"] - prev_picked >= min_gap:
            emphasis.append(round(s["t"], 3))
            prev_picked = s["t"]
        if len(emphasis) >= 12:  # cap total punches
            break

    return emphasis


def analyze(video_path: str) -> dict:
    import cv2
    import mediapipe as mp

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = total_frames / fps if fps > 0 else 0.0
    src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    log(f"Video: {src_w}x{src_h}, {fps:.1f} fps, {duration_sec:.1f}s")

    # Sample 12 frames across the video for face detection
    sample_count = max(6, min(20, int(duration_sec * 0.8)))
    step = max(1, total_frames // sample_count) if total_frames > 0 else 1

    face_detector = mp.solutions.face_detection.FaceDetection(
        model_selection=1,  # full-range model — better for further faces
        min_detection_confidence=0.5,
    )

    samples = []
    sampled = 0
    with face_detector as det:
        idx = 0
        while idx < total_frames and sampled < sample_count:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                break
            sampled += 1
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = det.process(rgb)
            if results.detections:
                # Take the largest detected face (assume = speaker)
                best = max(
                    results.detections,
                    key=lambda d: d.location_data.relative_bounding_box.width
                                  * d.location_data.relative_bounding_box.height,
                )
                bb = best.location_data.relative_bounding_box
                samples.append({
                    "cx": max(0.0, min(1.0, bb.xmin + bb.width / 2)),
                    "cy": max(0.0, min(1.0, bb.ymin + bb.height / 2)),
                    "w": bb.width,
                    "h": bb.height,
                })
            idx += step

    cap.release()

    face_detected = len(samples) > 0
    detection_rate = len(samples) / max(sampled, 1)

    if face_detected:
        avg_cx = sum(s["cx"] for s in samples) / len(samples)
        avg_cy = sum(s["cy"] for s in samples) / len(samples)
        avg_size = sum(s["w"] for s in samples) / len(samples)
    else:
        avg_cx = 0.5
        avg_cy = 0.5
        avg_size = 0.0

    # Heuristics
    is_talking_head = face_detected and detection_rate >= 0.7 and avg_size >= 0.10
    video_aspect = (
        "vertical" if src_h > src_w * 1.1
        else "horizontal" if src_w > src_h * 1.1
        else "square"
    )

    # Recommendation logic. We NEVER auto-crop now — cropping kept cutting the
    # speaker out of frame. Always keep the original aspect (full frame); the
    # user can manually pick 9:16/1:1 in the panel if they really want a crop.
    # We only pick the editing MODE (which controls effects/animation/style).
    recommended_aspect = "original"
    if is_talking_head:
        recommended_mode = "podcast"
    elif duration_sec < 90:
        recommended_mode = "basic_effects"
    else:
        recommended_mode = "subtitles_only"

    template_for_mode = {
        "subtitles_only": "plain",
        "basic_effects": "minimal",
        "podcast": "ali",
        "advanced_effects": "hormozi",
    }
    recommended_template = template_for_mode[recommended_mode]

    # Detect emphasis moments for smart zoom punches
    log("Detecting emphasis moments from audio...")
    emphasis_moments = detect_emphasis_moments(video_path, duration_sec)
    log(f"Found {len(emphasis_moments)} emphasis points")

    return {
        "face_detected": face_detected,
        "face_center_x": round(avg_cx, 4),
        "face_center_y": round(avg_cy, 4),
        "face_size_ratio": round(avg_size, 4),
        "face_detection_rate": round(detection_rate, 4),
        "is_talking_head": is_talking_head,
        "duration_sec": round(duration_sec, 3),
        "video_width": src_w,
        "video_height": src_h,
        "video_aspect": video_aspect,
        "recommended_aspect": recommended_aspect,
        "recommended_mode": recommended_mode,
        "recommended_template": recommended_template,
        "emphasis_moments": emphasis_moments,
        "frames_sampled": sampled,
        "frames_with_face": len(samples),
    }


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
