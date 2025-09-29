"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { api } from "../lib/api";
import MultiAngleRegistration from "@/components/MultiAngleRegistration";
import RealTimeDetection from "@/components/RealTimeDetection";
import { Orbitron } from "next/font/google";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "700"], // medium + bold
});

export default function Home() {
  const [name, setName] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [liveMatch, setLiveMatch] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState("");
  const inFlightRef = useRef(false);
  // Real-time detection only
  const registerRef = useRef(null);
  const [showMultiAngleRegistration, setShowMultiAngleRegistration] = useState(false);

  // Manual single-image registration is removed; only Face ID-style registration is supported.

  const onClickRegister = () => {
    if (registerRef.current) {
      registerRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleMultiAngleRegistration = () => {
    if (!name) {
      alert("Please enter a name first");
      return;
    }
    setShowMultiAngleRegistration(true);
  };

  const handleMultiAngleComplete = (result) => {
    setShowMultiAngleRegistration(false);
    setUploadSuccess(true);
    // Start real-time detection and show the registered name once camera is on
    const justRegisteredName = result?.name || name;
    // Delay a bit so background DB insert becomes searchable
    setTimeout(() => setIsDetecting(true), 1500);
    if (justRegisteredName) {
      setLiveMatch(`${justRegisteredName} (registered)`);
    }
    setName("");
    setTimeout(() => setUploadSuccess(false), 5000);
  };

  const handleMultiAngleCancel = () => {
    setShowMultiAngleRegistration(false);
  };

  // Manual capture removed

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2 7V5a3 3 0 013-3h2M22 7V5a3 3 0 00-3-3h-2M2 17v2a3 3 0 003 3h2M22 17v2a3 3 0 01-3 3h-2"
                  />
                  <circle
                    cx="12"
                    cy="10"
                    r="3"
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 19a5 5 0 0110 0"
                  />
                </svg>
              </div>
              <h1
                className={`text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ${orbitron.className}`}
              >
                FaceTrackr
              </h1>

            </div>
            <div className="flex items-center gap-3">
              {!isDetecting ? (
                <button
                  onClick={() => {
                    setIsDetecting(true);
                    setLiveMatch("");
                    setLiveError("");
                  }}
                  className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsDetecting(false);
                    setLiveMatch("");
                    setLiveError("");
                  }}
                  className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                >
                  Close
                </button>
              )}
              <button
                onClick={onClickRegister}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-blue-100 mt-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Hero Live Preview */}
          <div className=" rounded-2xl shadow-xl p-8 border border-gray-400">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Live Preview
              </h2>
              <p className="text-gray-600">
                Click Start to open camera. Choose between auto-detection or manual capture with detailed recognition.
              </p>
            </div>
            {/* Camera Component - Real-time only */}
            <RealTimeDetection 
              isActive={isDetecting} 
              onPersonDetected={(personData) => {
                setLiveMatch(`${personData.name} (${personData.confidence}%)`);
                setLiveError("");
              }}
            />
            <div className="mt-4 text-center">
              {isDetecting && (
                <span className="text-lg text-gray-800">
                  {liveLoading
                    ? "Checking..."
                    : liveError
                      ? liveError
                      : liveMatch
                        ? `Match: ${liveMatch}`
                        : "No match yet"}
                </span>
              )}
            </div>
          </div>

          {/* Registration Section (Face ID-style only) */}
          <div
            ref={registerRef}
            className="bg-white rounded-2xl shadow-xl p-8 border border-gray-400"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Register New Person (Face ID)
              </h2>
              <p className="text-gray-600">
                Enter the person's name and complete the Face ID-style setup.
                No manual image upload is needed.
              </p>
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
                  className="text-gray-800 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {/* Start Face ID Setup */}
              <button
                onClick={handleMultiAngleRegistration}
                disabled={!name}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white py-3 px-6 rounded-lg font-medium hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                📱 Start Face ID Setup
              </button>

              {/* Success Message */}
              {uploadSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <svg
                      className="h-5 w-5 text-green-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
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

      {/* Multi-Angle Registration Modal */}
      {showMultiAngleRegistration && (
        <MultiAngleRegistration
          personName={name}
          onComplete={handleMultiAngleComplete}
          onCancel={handleMultiAngleCancel}
        />
      )}
    </div>
  );
}
