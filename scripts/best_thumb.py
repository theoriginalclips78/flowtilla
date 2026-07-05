#!/usr/bin/env python3
"""
best_thumb.py — pick the best COVER frame for a clip.

Scans the clip and scores frames by: a clear human face (bigger + more central is
better), sharpness (no motion blur), and good brightness. Returns the timestamp of the
best frame so the pipeline can grab it as the thumbnail — much better than a fixed t=1s
grab, which often lands on a blur or a transition.

Usage:  python3 best_thumb.py <video_path>
Output: one line of JSON, e.g. {"time": 3.4, "face": true, "score": 0.82}
Always prints valid JSON (time 1.0 fallback) so the caller can proceed.
"""
import sys, json

def run():
    result = {"time": 1.0, "face": False, "score": 0.0}
    try:
        import cv2  # noqa
    except Exception as e:
        result["error"] = "opencv unavailable: %s" % e
        print(json.dumps(result)); return

    video = sys.argv[1]
    haar = cv2.data.haarcascades
    frontal = cv2.CascadeClassifier(haar + "haarcascade_frontalface_default.xml")
    profile = cv2.CascadeClassifier(haar + "haarcascade_profileface.xml")

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        result["error"] = "cannot open video"
        print(json.dumps(result)); return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    dur = frames / fps if fps else 0.0
    if dur <= 0:
        cap.release(); print(json.dumps(result)); return

    # sample ~14 evenly spaced timestamps, skipping the very first/last 0.4s
    n = 14
    times = [max(0.4, dur * (i + 0.5) / n) for i in range(n)]

    def faces(gray):
        h, w = gray.shape[:2]
        scale = 640.0 / w if w > 640 else 1.0
        g = cv2.resize(gray, (int(w * scale), int(h * scale))) if scale != 1.0 else gray
        g = cv2.equalizeHist(g)
        p = dict(scaleFactor=1.1, minNeighbors=5, minSize=(46, 46))
        found = list(frontal.detectMultiScale(g, **p))
        if not found:
            found = list(profile.detectMultiScale(g, **p)) or list(profile.detectMultiScale(cv2.flip(g, 1), **p))
        return found, g.shape[1], g.shape[0]

    best = {"time": times[len(times) // 2], "face": False, "score": -1.0}
    for t in times:
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        y = float(gray.mean())
        if not (22 <= y <= 232):
            continue
        sharp = cv2.Laplacian(gray, cv2.CV_64F).var()
        sharp_score = min(1.0, sharp / 400.0)          # 0..1, saturates on crisp frames
        fs, gw, gh = faces(gray)
        if fs:
            fx, fy, fw, fh = max(fs, key=lambda r: r[2] * r[3])
            area = (fw * fh) / float(gw * gh)           # face size as a fraction of frame
            cx = (fx + fw / 2) / gw
            centered = 1.0 - min(1.0, abs(cx - 0.5) * 2) # 1 = dead centre horizontally
            score = 0.55 * min(1.0, area * 6) + 0.25 * centered + 0.20 * sharp_score
            face = True
        else:
            score = 0.15 * sharp_score                  # no face: weak, only used if nothing better
            face = False
        if score > best["score"]:
            best = {"time": round(t, 2), "face": face, "score": round(score, 3)}

    cap.release()
    print(json.dumps(best))

if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(json.dumps({"time": 1.0, "face": False, "error": str(e)}))
