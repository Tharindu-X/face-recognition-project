"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function RealTimeDetection({ onPersonDetected, isActive }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const [detectedPerson, setDetectedPerson] = useState(null);
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const inflightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        if (cancelled) return;
        
        faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            },
            numFaces: 1,
            runningMode: "VIDEO",
          }
        );

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, 
          audio: false 
        });
        
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        startDetectionLoop();
      } catch (e) {
        console.error("Failed to initialize webcam:", e);
      }
    };

    if (isActive) {
      init();
    } else {
      cleanup();
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isActive]);

  const cleanup = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setDetectedPerson(null);
  };

  const detectPersonFromFrame = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      if (inflightRef.current) return;
      inflightRef.current = true;
      setIsLoading(true);
      const blob = await new Promise(resolve => 
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );

      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');

      const response = await fetch('http://localhost:5000/detect', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
      if (result.found && confidence >= 25) {
        const personData = {
          name: result.name,
          confidence: Math.round(confidence),
          timestamp: Date.now()
        };
        
        setDetectedPerson(personData);
        
        // Add to detection history
        setDetectionHistory(prev => {
          const newHistory = [personData, ...prev.slice(0, 4)]; // Keep last 5 detections
          return newHistory;
        });

        // Notify parent component
        if (onPersonDetected) {
          onPersonDetected(personData);
        }

        console.log(`Detected: ${result.name} (${result.confidence.toFixed(1)}%)`);
      } else {
        setDetectedPerson(null);
      }
    } catch (error) {
      console.error('Detection failed:', error);
      setDetectedPerson(null);
    } finally {
      inflightRef.current = false;
      setIsLoading(false);
    }
  };

  const drawFaceOverlay = (landmarks) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0) {
      setDetectedPerson(null);
      return;
    }

    const face = landmarks[0];
    
    // Draw face bounding box with detection status color
    const detectionColor = detectedPerson ? "#10b981" : "#f59e0b";
    
    // Calculate face bounds
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    landmarks[0].forEach(landmark => {
      minX = Math.min(minX, landmark.x);
      maxX = Math.max(maxX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxY = Math.max(maxY, landmark.y);
    });

    const x = minX * canvas.width;
    const y = minY * canvas.height;
    const width = (maxX - minX) * canvas.width;
    const height = (maxY - minY) * canvas.height;

    // Draw face bounding box
    ctx.strokeStyle = detectionColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);

    // Draw key facial points
    ctx.fillStyle = detectionColor;
    const keyPoints = [1, 33, 263, 13, 376, 61]; // nose tip, eyes, mouth center
    keyPoints.forEach(pointIndex => {
      const point = face[pointIndex];
      if (point) {
        ctx.beginPath();
        ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw detection overlay at the bottom
    if (detectedPerson) {
      drawDetectionOverlay(ctx, detectedPerson, canvas.width, canvas.height);
    }
  };

  const drawDetectionOverlay = (ctx, personData, canvasWidth, canvasHeight) => {
    const overlayHeight = 80;
    const overlayY = canvasHeight - overlayHeight;
    
    // Semi-transparent background
    ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
    ctx.fillRect(0, overlayY, canvasWidth, overlayHeight);
    
    // Person name with large font
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.min(canvasWidth * 0.08, 48)}px Arial`;
    ctx.textAlign = "center";
    ctx.fillText(personData.name, canvasWidth / 2, overlayY + 35);
    
    // Confidence score
    ctx.font = `${Math.min(canvasWidth * 0.04, 24)}px Arial`;
    ctx.fillText(
      `${personData.confidence}% confident`, 
      canvasWidth / 2, 
      overlayY + 60
    );
    
    // Decorative elements
    ctx.strokeStyle = "white";
    ctx.levelWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvasWidth * 0.2, overlayY + 5);
    ctx.lineTo(canvasWidth * 0.8, overlayY + 5);
    ctx.moveTo(canvasWidth * 0.2, overlayY + overlayHeight - 5);
    ctx.lineTo(canvasWidth * 0.8, overlayY + overlayHeight - 5);
    ctx.stroke();
  };

  const startDetectionLoop = () => {
    const detect = () => {
      const video = videoRef.current;
      if (!video || !faceLandmarkerRef.current || !isActive) {
        if (isActive) {
          rafRef.current = requestAnimationFrame(detect);
        }
        return;
      }

      const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());
      const faces = results?.faceLandmarks || [];
      
      drawFaceOverlay(faces);

      // Detect person more frequently if a face is detected
      if (faces.length > 0) {
        const now = performance.now();
        if (now - lastDetectionRef.current > 1000) { // 1 second cooldown
          lastDetectionRef.current = now;
          detectPersonFromFrame();
        }
      } else {
        setDetectedPerson(null);
      }
      
      if (streamRef.current && isActive) {
        rafRef.current = requestAnimationFrame(detect);
      }
    };
    detect();
  };

  if (!isActive) {
    return (
      <div className="bg-gray-100 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">Real-time Detection</p>
          <p className="text-sm">Camera is off. Click Start to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Camera Feed */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover"
          muted 
          playsInline 
          autoPlay
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Detecting...</p>
            </div>
          </div>
        )}
      </div>

      {/* Current Detection Status */}
      {detectedPerson && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-green-800">
                {detectedPerson.name}
              </h3>
              <p className="text-green-600">
                {detectedPerson.confidence}% confident • Detected just now
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detection History */}
      {detectionHistory.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Recent Detections</h4>
          <div className="space-y-2">
            {detectionHistory.slice(0, 3).map((detection, index) => (
              <div key={`${detection.timestamp}-${index}`} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2">
                <span className="font-medium">{detection.name}</span>
                <span className="text-gray-500">{detection.confidence}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
