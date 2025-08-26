from flask import Flask, render_template, Response, request, jsonify
from flask_cors import CORS
import cv2
from face_recognition import get_face_embedding
from milvus_client import search_face
from milvus_client import insert_face
from milvus_client import list_faces
from face_embeddings import get_face_embedding as get_file_embedding
import tempfile
import os
import numpy as np

app = Flask(__name__)
CORS(app)

cap = cv2.VideoCapture(0)

def gen_frames():
    font = cv2.FONT_HERSHEY_SIMPLEX
    while True:
        success, frame = cap.read()
        if not success:
            break
        else:
            # Get embedding & search in Milvus
            embedding = get_face_embedding(frame)
            match = search_face(embedding)
            
            # Display name on frame
            if match:
                text = f"Hi {match['name']} 👋"
                cv2.putText(frame, text, (50, 50), font, 1, (0, 255, 0), 2, cv2.LINE_AA)

            # Encode frame as JPEG
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/faces')
def faces():
    try:
        faces = list_faces()
        names = [f.get('name') for f in faces] if faces else []
        return jsonify({"count": len(names), "names": names})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/register', methods=['POST'])
def register():
    name = request.form.get('name')
    image_file = request.files.get('image')
    if not name or not image_file:
        return jsonify({"error": "name and image are required"}), 400

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    try:
        image_file.save(tmp.name)
        embedding = get_file_embedding(tmp.name)
        # No cloud storage wired here; store empty image_url
        insert_face(name=name, image_url="", embedding=embedding)
        return jsonify({"status": "ok", "name": name})
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
@app.route('/detect', methods=['POST'])
def detect():
    image_file = request.files.get('image')
    if not image_file:
        return jsonify({"error": "image is required"}), 400

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
    try:
        image_file.save(tmp.name)
        embedding = get_file_embedding(tmp.name)  # already normalized
        match = search_face(embedding)

        if match:
            score = match.get("distance")  # cosine similarity (higher = better)
            threshold = 0.35  # tweak for your use-case

            if score < threshold:
                return jsonify({"match": False, "score": score}), 200

            return jsonify({
                "match": True,
                "name": match.get("name"),
                "confidence": round(score * 100, 2),  # scale 0-100%
                "image": match.get("image"),
            }), 200

        return jsonify({"match": False}), 200
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

@app.route('/')
def index():
    return render_template('index.html')  # simple HTML page

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
