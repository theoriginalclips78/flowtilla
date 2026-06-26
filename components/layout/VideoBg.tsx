"use client";

import { useEffect, useRef } from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260611_183632_c311af08-e4b7-458f-81e7-79847a49b3d3.mp4";

export default function VideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const rafRef = useRef<number>(0);
  const dirRef = useRef<1 | -1>(1);
  const idxRef = useRef(0);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const MAX_W = 960;
    let capturing = false;
    let lastFrameTime = 0;
    const FPS = 30;
    const INTERVAL = 1000 / FPS;

    function captureFrame() {
      if (!video || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.min(1, MAX_W / video.videoWidth);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const offscreen = document.createElement("canvas");
      offscreen.width = w;
      offscreen.height = h;
      offscreen.getContext("2d")!.drawImage(video, 0, 0, w, h);
      createImageBitmap(offscreen).then((bmp) => framesRef.current.push(bmp));
    }

    function onMetadata() {
      if (!video || !canvas) return;
      const scale = Math.min(1, MAX_W / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
    }

    function onTimeUpdate() {
      if (!capturing) return;
      const now = performance.now();
      if (now - lastFrameTime >= INTERVAL) {
        lastFrameTime = now;
        captureFrame();
      }
    }

    function startBoomerang() {
      if (!canvas) return;
      video!.style.display = "none";
      canvas.style.display = "block";
      const frames = framesRef.current;
      if (frames.length === 0) return;
      const ctx = canvas.getContext("2d")!;
      let last = 0;

      function tick(ts: number) {
        if (ts - last >= INTERVAL) {
          last = ts;
          const frame = frames[idxRef.current];
          if (frame) ctx.drawImage(frame, 0, 0, canvas!.width, canvas!.height);
          idxRef.current += dirRef.current;
          if (idxRef.current >= frames.length - 1) dirRef.current = -1;
          if (idxRef.current <= 0) dirRef.current = 1;
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onPlay() { capturing = true; }

    function onEnded() {
      capturing = false;
      startBoomerang();
    }

    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.crossOrigin = "anonymous";
    video.src = VIDEO_URL;
    video.load();

    return () => {
      cancelAnimationFrame(rafRef.current);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      framesRef.current.forEach((b) => b.close());
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 scale-[1.08] origin-center overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover hidden"
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}

export { VideoBg };
