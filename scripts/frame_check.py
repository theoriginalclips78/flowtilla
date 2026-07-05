#!/usr/bin/env python3
"""
frame_check.py — opening-frame validator for the ClipFlow pipeline.

Given a source video and a clip start time, scan forward a short window and find the
smallest offset where the frame is (a) not a black/white transition frame and (b) shows
a real human face. Requiring a face inherently skips animated / green-screen / graphic
intros, since those have no face — which is exactly the spec's intent.

Usage:  python3 frame_check.py <video_path> <start_sec> [max_push_sec]
Output: one line of JSON on stdout, e.g.
        {"offset": 0.4, "face": true, "checked": 3, "faceless_intro_skipped": true}
On any failure it still prints valid JSON with offset 0 so the caller can proceed.
"""
import sys, json

def run():
    result = {"offset": 0.0, "face": False, "checked": 0, "faceless_intro_skipped": False}
    try:
        import cv2  # noqa
    except Exception as e:
        result["error"] = "opencv unavailable: %s" % e
        print(json.dumps(result)); return

    video = sys.argv[1]
    start = float(sys.argv[2])
    max_push = float(sys.argv[3]) if len(sys.argv) > 3 else 1.2
    step = 0.2

    haar = cv2.data.haarcascades
    frontal = cv2.CascadeClassifier(haar + "haarcascade_frontalface_default.xml")
    profile = cv2.CascadeClassifier(haar + "haarcascade_profileface.xml")

    def has_face(gray):
        # downscale to ~640 wide for fast, resolution-independent detection
        h, w = gray.shape[:2]
        scale = 640.0 / w if w > 640 else 1.0
        g = cv2.resize(gray, (int(w * scale), int(h * scale))) if scale != 1.0 else gray
        g = cv2.equalizeHist(g)
        p = dict(scaleFactor=1.1, minNeighbors=5, minSize=(46, 46))
        if len(frontal.detectMultiScale(g, **p)):
            return True
        if len(profile.detectMultiScale(g, **p)):          # left profile
            return True
        if len(profile.detectMultiScale(cv2.flip(g, 1), **p)):  # right profile
            return True
        return False

    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        result["error"] = "cannot open video"
        print(json.dumps(result)); return

    first_clean = None
    off = 0.0
    while off <= max_push + 1e-6:
        cap.set(cv2.CAP_PROP_POS_MSEC, (start + off) * 1000.0)
        ok, frame = cap.read()
        if not ok or frame is None:
            off = round(off + step, 3); continue
        result["checked"] += 1
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        y = float(gray.mean())
        if not (20 <= y <= 226):          # black fade / white flash — skip
            off = round(off + step, 3); continue
        if first_clean is None:
            first_clean = round(off, 2)
        if has_face(gray):
            result["offset"] = round(off, 2)
            result["face"] = True
            result["faceless_intro_skipped"] = round(off, 2) > 0
            cap.release(); print(json.dumps(result)); return
        off = round(off + step, 3)

    # No face found in the window — fall back to the first non-black/white frame so we at
    # least skip transition frames (matches the pre-OpenCV behaviour).
    cap.release()
    result["offset"] = first_clean if first_clean is not None else 0.0
    print(json.dumps(result))

if __name__ == "__main__":
    try:
        run()
    except Exception as e:
        print(json.dumps({"offset": 0.0, "face": False, "error": str(e)}))
