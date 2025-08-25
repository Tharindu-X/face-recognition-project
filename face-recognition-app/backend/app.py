from flask import Flask, render_template, Response
import cv2
from face_recognition import get_face_embedding
from milvus_client import search_face
import numpy as np

app = Flask(__name__)
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

@app.route('/')
def index():
    return render_template('index.html')  # simple HTML page

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
