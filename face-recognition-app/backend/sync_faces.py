import cloudinary
import cloudinary.api
from milvus_client import insert_face
from face_recognition import get_face_embedding

# Configure Cloudinary
cloudinary.config( 
  cloud_name = "YOUR_CLOUD_NAME", 
  api_key = "YOUR_API_KEY", 
  api_secret = "YOUR_API_SECRET" 
)

def sync_cloudinary_faces():
    # Get all uploaded images
    resources = cloudinary.api.resources(type="upload", max_results=50)

    for res in resources["resources"]:
        image_url = res["secure_url"]
        public_id = res["public_id"]  

        # Assume you stored names like "john_profile" → name = "john"
        name = public_id.split("_")[0]

        embedding = get_face_embedding(image_url)

        insert_face(name, image_url, embedding)

    print("✅ All faces synced from Cloudinary to Milvus")

if __name__ == "__main__":
    sync_cloudinary_faces()
