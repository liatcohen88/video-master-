"""
Person segmentation — generate an alpha-channel matte video from the speaker.

Uses MediaPipe Selfie Segmentation to produce a per-frame mask. The output
is a grayscale MP4 where bright pixels = person, dark pixels = background.
FFmpeg later uses alphamerge on this matte to composite person on top of
elements that sit between the person and a blurred background copy.

Usage:
    python segment_person.py <input_video> <output_mask_mp4>
"""

import argparse
import os
import sys
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def segment(input_path: str, output_path: str) -> None:
    import cv2
    import mediapipe as mp
    import numpy as np

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    log(f"Segmenting {total} frames at {w}x{h}@{fps:.1f}fps...")

    # We write the mask as a stream of raw grayscale frames piped to ffmpeg.
    # Mask values: 0 = background, 255 = person, with soft edges.
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-pix_fmt", "gray",
        "-s", f"{w}x{h}",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "veryfast",
        "-crf", "18",
        output_path,
    ]
    proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    segmenter = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
    written = 0
    try:
        with segmenter as seg:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = seg.process(rgb)
                # condition is float 0..1 in single channel
                mask = result.segmentation_mask  # shape (h, w)
                # Smooth edges and amplify foreground
                mask = np.clip(mask, 0, 1)
                # Threshold + soft transition: 0..0.3 = bg, 0.7..1 = fg, smooth between
                mask = np.where(mask < 0.3, 0.0,
                        np.where(mask > 0.7, 1.0, (mask - 0.3) / 0.4))
                # Gaussian blur for soft edges
                mask_blurred = cv2.GaussianBlur(mask, (9, 9), 0)
                mask_uint8 = (mask_blurred * 255).astype(np.uint8)
                proc.stdin.write(mask_uint8.tobytes())
                written += 1
                if written % 30 == 0:
                    log(f"  ...{written}/{total}")
    finally:
        cap.release()
        if proc.stdin:
            proc.stdin.close()
        proc.wait(timeout=60)

    log(f"Wrote {written} mask frames to {output_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_video")
    parser.add_argument("output_mask_mp4")
    args = parser.parse_args()

    if not os.path.exists(args.input_video):
        print(f"File not found: {args.input_video}", file=sys.stderr)
        sys.exit(1)

    try:
        segment(args.input_video, args.output_mask_mp4)
    except Exception as e:
        print(f"Segmentation failed: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
