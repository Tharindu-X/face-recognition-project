from deepface import DeepFace
import numpy as np

def get_face_embedding(img_path):
    embedding = DeepFace.represent(img_path=img_path, model_name="Facenet")[0]["embedding"]
    return np.array(embedding, dtype=np.float32).tolist()
