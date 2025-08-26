from deepface import DeepFace
import numpy as np

def get_face_embedding(img_path):
    # Use enforce_detection=False so we still get an embedding if detection is weak
    # Keep model consistent with detection path (Facenet)
    result = DeepFace.represent(
        img_path=img_path,
        model_name="Facenet",
        enforce_detection=False,
        detector_backend="opencv",
    )
    embedding = np.array(result[0]["embedding"], dtype=np.float32)
    # L2-normalize to match detection path and stabilize distances
    norm = np.linalg.norm(embedding) + 1e-12
    embedding = embedding / norm
    return embedding.tolist()
