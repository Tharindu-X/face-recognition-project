"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function WebcamCapture({ active = false, onCapture }) {
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState(null);
	const [facesCount, setFacesCount] = useState(0);
	const faceLandmarkerRef = useRef(null);
	const rafRef = useRef(null);
	const lastAutoCaptureRef = useRef(0);
	const streamRef = useRef(null);
	const lastTimestampRef = useRef(0);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => { mountedRef.current = false; };
	}, []);

	useEffect(() => {
		let cancelled = false;

		const waitForMetadata = async (video) => {
			if (!video) return;
			if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) return;
			await new Promise((resolve) => {
				const handler = () => {
					video.removeEventListener("loadedmetadata", handler);
					resolve();
				};
				video.addEventListener("loadedmetadata", handler, { once: true });
			});
		};

		const init = async () => {
			try {
				const filesetResolver = await FilesetResolver.forVisionTasks(
					"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
				);
				if (cancelled) return;
				const landmarker = await FaceLandmarker.createFromOptions(
					filesetResolver,
					{
						baseOptions: {
							modelAssetPath:
								"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
						},
						numFaces: 1,
						runningMode: "VIDEO",
					}
				);
				if (cancelled) return;
				faceLandmarkerRef.current = landmarker;

				const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				streamRef.current = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					await videoRef.current.play();
					await waitForMetadata(videoRef.current);
				}
				setIsReady(true);
				lastTimestampRef.current = 0;
				startDetectionLoop();
			} catch (e) {
				if (mountedRef.current) setError(e?.message || "Failed to initialize webcam");
			}
		};

		const teardown = () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((t) => t.stop());
				streamRef.current = null;
			}
			if (videoRef.current) {
				videoRef.current.srcObject = null;
			}
			setIsReady(false);
			setFacesCount(0);
		};

		if (active) {
			init();
		} else {
			teardown();
		}

		return () => {
			cancelled = true;
			teardown();
		};
	}, [active]);

	const drawLandmarks = (landmarks) => {
		const canvas = canvasRef.current;
		const video = videoRef.current;
		if (!canvas || !video) return;

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.strokeStyle = "#22d3ee";
		ctx.fillStyle = "#22d3ee";
		ctx.lineWidth = 2;

		for (const face of landmarks) {
			for (const pt of face) {
				ctx.beginPath();
				ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 2.5, 0, Math.PI * 2);
				ctx.fill();
			}
			const connect = (a, b) => {
				ctx.beginPath();
				ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
				ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
				ctx.stroke();
			};
			const idxs = [
				[33, 168], [168, 197], [197, 5],
				[263, 417], [417, 401], [401, 5],
				[61, 146], [146, 91], [91, 181], [181, 84], [84, 17],
				[291, 375], [375, 321], [321, 405], [405, 315], [315, 17],
			];
			for (const [i, j] of idxs) {
				if (face[i] && face[j]) connect(face[i], face[j]);
			}
		}
	};

	const autoCaptureIfFaceStable = (hasFace) => {
        const now = performance.now();
        const cooldownMs = 2500;
        if (!hasFace) return;  // <-- Only captures if a face exists
        if (now - lastAutoCaptureRef.current < cooldownMs) return;
        lastAutoCaptureRef.current = now;
        doCapture();
    };
    

	const doCapture = () => {
		const video = videoRef.current;
		if (!video) return;
		const off = document.createElement("canvas");
		off.width = video.videoWidth;
		off.height = video.videoHeight;
		const ctx = off.getContext("2d");
		ctx.drawImage(video, 0, 0, off.width, off.height);
		const dataUrl = off.toDataURL("image/jpeg", 0.9);
		if (onCapture) onCapture(dataUrl);
	};

	const startDetectionLoop = () => {
		const detect = () => {
			const video = videoRef.current;
			const landmarker = faceLandmarkerRef.current;
			if (!video || !landmarker || !streamRef.current || !isReady) {
				rafRef.current = requestAnimationFrame(detect);
				return;
			}
			if (video.readyState < 4 || video.paused || video.videoWidth <= 0 || video.videoHeight <= 0) {
				rafRef.current = requestAnimationFrame(detect);
				return;
			}
			let ts = Math.floor((video.currentTime || 0) * 1000);
			if (!Number.isFinite(ts) || ts <= 0) {
				ts = Math.floor(performance.now());
			}
			if (ts <= lastTimestampRef.current) ts = lastTimestampRef.current + 1;
			lastTimestampRef.current = ts;
			let results;
			try {
				results = landmarker.detectForVideo(video, ts);
			} catch (e) {
				rafRef.current = requestAnimationFrame(detect);
				return;
			}
			const faces = results?.faceLandmarks || [];
			setFacesCount(faces.length);
			drawLandmarks(faces);
			autoCaptureIfFaceStable(faces.length > 0);
			if (streamRef.current) {
				rafRef.current = requestAnimationFrame(detect);
			}
		};
		detect();
	};

	return (
		<div style={{ position: "relative", width: "100%", maxWidth: 640 }}>
			{error && (
				<div style={{ color: "#f87171", marginBottom: 8 }}>{error}</div>
			)}
			<div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
				{active ? (
					<video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
				) : (
					<div className="text-center text-gray-500">
						<p>Camera is off. Click Start to begin.</p>
					</div>
				)}
				<canvas ref={canvasRef} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
				{active && (
					<div style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,0.5)", color: "white", padding: "4px 8px", borderRadius: 6, fontSize: 12 }}>
						{facesCount > 0 ? `${facesCount} face` : "No face"}
					</div>
				)}
			</div>
		</div>
	);
}
