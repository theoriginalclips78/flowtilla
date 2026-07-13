#!/usr/bin/env python3
"""
reframe_track.py — SHOT-AWARE subject tracker for dynamic magic crop.

Unlike reframe.py (one average crop for the whole clip), this splits the window into
SHOTS at camera cuts and reports where the subject sits in EACH shot. The caller then
builds a crop that snaps to the right spot on every cut — so when a multi-cam podcast
cuts between speakers, the vertical frame follows whoever is on screen (like Crayo),
instead of picking one compromise crop where people drift off-frame.

Usage:  python3 reframe_track.py <video> <start_sec> <duration_sec> [fps=4]
Output: one JSON line:
  {"srcW":1280,"srcH":720,"coverage":0.87,"segments":[
     {"start":0.0,"end":4.2,"faceRatio":0.34,"faceYRatio":0.40,"coverage":0.9}, ...]}
Times are RELATIVE to the clip start. Fails open: on any error prints coverage 0 and no
segments so the caller falls back to the static crop / blur.
"""
import sys, json, statistics


def run():
    out = {"srcW": 0, "srcH": 0, "coverage": 0.0, "segments": []}
    try:
        import cv2, numpy as np
    except Exception as e:
        out["error"] = "opencv unavailable: %s" % e
        print(json.dumps(out)); return

    video = sys.argv[1]
    start = float(sys.argv[2])
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 15.0
    target_fps = float(sys.argv[4]) if len(sys.argv) > 4 else 4.0

    haar = cv2.data.haarcascades
    frontal = cv2.CascadeClassifier(haar + "haarcascade_frontalface_default.xml")
    profile = cv2.CascadeClassifier(haar + "haarcascade_profileface.xml")

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        out["error"] = "cannot open video"; print(json.dumps(out)); return

    native_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(round(native_fps / target_fps)))  # process every Nth frame
    cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000.0)

    def detect_face(frame):
        h, w = frame.shape[:2]
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
            boxes.append((g.shape[1] - fx - fw, fy, fw, fh))
        if not boxes:
            return None
        fx, fy, fw, fh = max(boxes, key=lambda b: b[2] * b[3])
        return ((fx + fw / 2.0) / g.shape[1], (fy + fh / 2.0) / g.shape[0])

    segments = []           # each: {"start","end","xs","ys","n","faces"}
    cur = None
    prev_sig = None
    srcW = srcH = 0
    frames_seen = 0
    idx = 0
    total_faces = 0
    total_samples = 0

    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0 - start
        if t > dur:
            break
        if idx % step != 0:
            idx += 1; continue
        idx += 1
        srcH, srcW = frame.shape[:2]
        # scene signature: tiny grayscale for a cheap frame-difference cut detector
        small = cv2.resize(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (64, 36)).astype("float32")
        is_cut = False
        if prev_sig is not None:
            mad = float(np.mean(np.abs(small - prev_sig))) / 255.0
            is_cut = mad > 0.16   # hard-cut threshold (podcasts/gameplay use hard cuts)
        prev_sig = small

        if cur is None or is_cut:
            if cur is not None:
                cur["end"] = t
                segments.append(cur)
            cur = {"start": t, "end": t, "xs": [], "ys": [], "n": 0}

        cur["n"] += 1
        total_samples += 1
        face = detect_face(frame)
        if face is not None:
            cur["xs"].append(face[0]); cur["ys"].append(face[1])
            total_faces += 1
        frames_seen += 1

    if cur is not None:
        cur["end"] = min(dur, cur["end"] + (step / native_fps))
        segments.append(cur)
    cap.release()

    out["srcW"], out["srcH"] = srcW, srcH
    if total_samples:
        out["coverage"] = round(total_faces / total_samples, 3)

    # Reduce each shot to a crop target. Shots with no detected face inherit the previous
    # shot's x (keeps continuity) or 0.5 (center) as a last resort.
    result = []
    last_x, last_y = 0.5, 0.4
    for s in segments:
        if s["end"] - s["start"] < 0.25:   # ignore ultra-short fragments
            continue
        if s["xs"]:
            fx = round(statistics.median(s["xs"]), 4)
            fy = round(statistics.median(s["ys"]), 4)
            cov = round(len(s["xs"]) / max(1, s["n"]), 3)
            last_x, last_y = fx, fy
        else:
            fx, fy, cov = last_x, last_y, 0.0
        result.append({"start": round(s["start"], 3), "end": round(s["end"], 3),
                       "faceRatio": fx, "faceYRatio": fy, "coverage": cov})
    out["segments"] = result
    print(json.dumps(out))


if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(json.dumps({"srcW": 0, "srcH": 0, "coverage": 0.0, "segments": [], "error": str(e)}))
