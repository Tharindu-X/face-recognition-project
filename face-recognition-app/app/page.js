"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { api } from "../lib/api";
import WebcamCapture from "@/components/WebcamCapture";

export default function Home() {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [liveMatch, setLiveMatch] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const inFlightRef = useRef(false);
  const registerRef = useRef(null);

  const handleUpload = async () => {
    if (!name || !file) {
      alert("Please enter a name and select an image!");
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "face_recognition");

      const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/drq8ovu6m/image/upload`, {
        method: "POST",
        body: formData
      });

      const cloudinaryData = await cloudinaryResponse.json();
      
      if (cloudinaryResponse.ok) {
        try {
          await api.registerPerson(name, file);
        } catch (backendError) {
          console.log("Backend registration failed, but image uploaded successfully");
        }
        
        setUploadSuccess(true);
        setName("");
        setFile(null);
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        alert("Upload failed. Please try again.");
      }
    } catch (error) {
      alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const onClickRegister = () => {
    if (registerRef.current) {
      registerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const dataURLToBlob = (dataUrl) => {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  };

  const handleAutoCapture = useCallback(async (dataUrl) => {
    if (inFlightRef.current) return; // skip overlapping calls
    inFlightRef.current = true;
    setLiveLoading(true);
    setLiveMatch("");
    setLiveError("");
    try {
      const blob = dataURLToBlob(dataUrl);
      const result = await api.detectFace(blob, { timeoutMs: 6000 });
      if (result?.match) {
        const matchedName = result.name ?? "Unknown";
        const conf = result.confidence != null ? ` (${result.confidence}%)` : "";
        setLiveMatch(`${matchedName}${conf}`);
      } else {
        setLiveMatch("No match");
      }
    } catch (e) {
      setLiveError("Detection failed or timed out");
    } finally {
      setLiveLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Face Recognition
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {!isDetecting ? (
                <button onClick={() => { setIsDetecting(true); setLiveMatch(""); setLiveError(""); }} className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700">Start</button>
              ) : (
                <button onClick={() => { setIsDetecting(false); setLiveMatch(""); setLiveError(""); }} className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700">Close</button>
              )}
              <button onClick={onClickRegister} className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">Register</button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Hero Live Preview */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Live Preview</h2>
              <p className="text-gray-600">Click Start to open camera. It auto-captures and checks for a registered match.</p>
            </div>
            <WebcamCapture active={isDetecting} onCapture={handleAutoCapture} />
            <div className="mt-4 text-center">
              {isDetecting && (
                <span className="text-sm text-gray-600">
                  {liveLoading ? "Checking..." : (liveError ? liveError : (liveMatch ? `Match: ${liveMatch}` : "No match yet"))}
                </span>
              )}
            </div>
          </div>

          {/* Registration Section */}
          <div ref={registerRef} className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Register New Person</h2>
              <p className="text-gray-600">Upload a photo and enter the person's name to register them in our system</p>
            </div>

            <div className="space-y-6">
              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter person's full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Photo
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors duration-200">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="file-upload"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-blue-600 hover:text-blue-500">
                          Click to upload
                        </span>{" "}
                        or drag and drop
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    </div>
                  </label>
                </div>
                {file && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ Selected: {file.name}
                  </div>
                )}
              </div>

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={isUploading || !name || !file}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isUploading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </div>
                ) : (
                  "Register Person"
                )}
              </button>

              {/* Success Message */}
              {uploadSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Registration successful!
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        The person has been registered in our system.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>© 2024 Face Recognition System. Powered by AI Technology.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
