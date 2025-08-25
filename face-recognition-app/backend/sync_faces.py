import os
import cloudinary
import cloudinary.api
from milvus_client import insert_face
from face_embeddings import get_face_embedding

# Configure Cloudinary using environment variables
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

def sync_cloudinary_faces():
    # Get all uploaded images
    resources = cloudinary.api.resources(type="upload", max_results=50)

    for res in resources.get("resources", []):
        image_url = res["secure_url"]
        public_id = res["public_id"]

        # Extract name from public_id like "john_profile" -> "john"
        name = public_id.split("_")[0]

        embedding = get_face_embedding(image_url)

        insert_face(name, image_url, embedding)

    print("✅ All faces synced from Cloudinary to Milvus")

if __name__ == "__main__":
    sync_cloudinary_faces()
