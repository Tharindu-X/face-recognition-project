import cv2
from deepface import DeepFace
import numpy as np
from milvus_client import search_face  # your previously created Milvus client

def get_face_embedding(frame):
    """
    Takes a BGR frame (from OpenCV) and returns the embedding using DeepFace.
    """
    # Convert frame to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # DeepFace requires a file or numpy array
    result = DeepFace.represent(
        img_path=rgb_frame,
        model_name="Facenet",
        enforce_detection=False,
        detector_backend="opencv",
    )

    embedding = np.array(result[0]["embedding"], dtype=np.float32)
    # L2-normalize for stable distances
    norm = np.linalg.norm(embedding) + 1e-12
    embedding = embedding / norm
    return embedding.tolist()

def recognize_from_webcam():
    cap = cv2.VideoCapture(0)  # open webcam 0
    font = cv2.FONT_HERSHEY_SIMPLEX

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Detect + embed
        embedding = get_face_embedding(frame)
        match = search_face(embedding)

        # Display result
        if match:
            text = f"Hi {match['name']} 👋"
            cv2.putText(frame, text, (50, 50), font, 1, (0, 255, 0), 2, cv2.LINE_AA)

        # Show video feed
        cv2.imshow("Face Recognition", frame)

        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    recognize_from_webcam()
