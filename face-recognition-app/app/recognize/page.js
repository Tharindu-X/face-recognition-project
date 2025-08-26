"use client";

import { useState } from "react";
import WebcamCapture from "@/components/WebcamCapture";

export default function RecognizePage() {
	const [lastImage, setLastImage] = useState(null);

	return (
		<div style={{ padding: 16 }}>
			<h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Face Detection</h1>
			<p style={{ color: "#64748b", marginBottom: 12 }}>
				Camera will auto-capture when a face is detected. You can also press Capture.
			</p>
			<WebcamCapture onCapture={setLastImage} />
			{lastImage && (
				<div style={{ marginTop: 16 }}>
					<h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Last Capture</h2>
					<img src={lastImage} alt="capture" style={{ maxWidth: 320, borderRadius: 8, border: "1px solid #e2e8f0" }} />
				</div>
			)}
		</div>
	);
}
