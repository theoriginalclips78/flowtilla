#!/usr/bin/env python3
"""
reframe.py — subject-position analyzer for "magic crop".

Scans a clip's time window, finds the dominant (largest) human face in each sampled
frame, and reports where the subject sits so the caller can crop a 9:16 frame that
keeps them framed — instead of a dumb center crop that chops off off-center speakers.

Usage:  python3 reframe.py <video_path> <start_sec> <duration_sec>
Output: one JSON line, e.g.
  {"faceRatio":0.42,"faceYRatio":0.33,"coverage":0.8,"faces":12,"samples":15,
   "srcW":1920,"srcH":1080,"spread":0.06}
- faceRatio / faceYRatio: median face CENTER as a fraction of source width / height.
- coverage: fraction of sampled frames that had a face (confidence the crop is safe).
- spread: how much the face moves horizontally across the clip (caller can widen the
  crop or fall back if the subject roams a lot).
On any failure prints valid JSON with coverage 0 so the caller falls back gracefully.
"""
import sys, json, statistics


def run():
    res = {"faceRatio": 0.5, "faceYRatio": 0.4, "coverage": 0.0,
           "faces": 0, "samples": 0, "srcW": 0, "srcH": 0, "spread": 0.0}
    try:
        import cv2
    except Exception as e:
        res["error"] = "opencv unavailable: %s" % e
        print(json.dumps(res)); return

    video = sys.argv[1]
    start = float(sys.argv[2])
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 15.0

    haar = cv2.data.haarcascades
    frontal = cv2.CascadeClassifier(haar + "haarcascade_frontalface_default.xml")
    profile = cv2.CascadeClassifier(haar + "haarcascade_profileface.xml")

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        res["error"] = "cannot open video"
        print(json.dumps(res)); return

    # Sample up to ~18 frames evenly across the window (fast + representative).
    n = 18
    xs, ys = [], []
    samples = 0
    srcW = srcH = 0
    for i in range(n):
        t = start + (dur * (i + 0.5) / n)
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        samples += 1
        h, w = frame.shape[:2]
        srcW, srcH = w, h
        scale = 640.0 / w if w > 640 else 1.0
        g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if scale != 1.0:
            g = cv2.resize(g, (int(w * scale), int(h * scale)))
        g = cv2.equalizeHist(g)
        p = dict(scaleFactor=1.1, minNeighbors=5, minSize=(46, 46))
        boxes = list(frontal.detectMultiScale(g, **p))
        boxes += list(profile.detectMultiScale(g, **p))
        flip = cv2.flip(g, 1)
        for (fx, fy, fw, fh) in profile.detectMultiScale(flip, **p):
            boxes.append((g.shape[1] - fx - fw, fy, fw, fh))  # un-mirror x
        if not boxes:
            continue
        # dominant = largest face (closest subject) — avoids chasing background people
        fx, fy, fw, fh = max(boxes, key=lambda b: b[2] * b[3])
        cx = (fx + fw / 2.0) / g.shape[1]
        cy = (fy + fh / 2.0) / g.shape[0]
        xs.append(cx); ys.append(cy)

    cap.release()
    res["samples"] = samples
    res["faces"] = len(xs)
    res["srcW"], res["srcH"] = srcW, srcH
    if samples > 0:
        res["coverage"] = round(len(xs) / samples, 3)
    if xs:
        res["faceRatio"] = round(statistics.median(xs), 4)
        res["faceYRatio"] = round(statistics.median(ys), 4)
        res["spread"] = round((max(xs) - min(xs)), 4)
    print(json.dumps(res))


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(json.dumps({"faceRatio": 0.5, "faceYRatio": 0.4, "coverage": 0.0, "error": str(e)}))
