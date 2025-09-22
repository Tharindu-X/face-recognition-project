from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility
import numpy as np

connections.connect("default", host="127.0.0.1", port="19530")

# Define schema
name_field = FieldSchema(
    name="name",
    dtype=DataType.VARCHAR,
    max_length=100,
    is_primary=True,
)
image_field = FieldSchema(
    name="image_url",
    dtype=DataType.VARCHAR,
    max_length=500,
)
embedding_field = FieldSchema(
    name="embedding",
    dtype=DataType.FLOAT_VECTOR,
    dim=128,  # Facenet embeddings are 128-dim
)

schema = CollectionSchema(
    fields=[name_field, image_field, embedding_field],
    description="Face recognition database",
)

collection_name = "faces"
if not utility.has_collection(collection_name):
    faces_collection = Collection(name=collection_name, schema=schema)
    faces_collection.create_index(
        field_name="embedding",
        index_params={
            "index_type": "IVF_FLAT",
            "metric_type": "IP",  # ✅ cosine similarity
            "params": {"nlist": 1024},
        },
    )
else:
    faces_collection = Collection(name=collection_name)

faces_collection.load()


# -------------------
# Helpers
# -------------------

def normalize(vec):
    vec = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec) + 1e-12
    return (vec / norm).tolist()


def insert_face(name, image_url, embedding):
    embedding = normalize(embedding)  # ✅ ensure normalized before insert
    data = [[name], [image_url], [embedding]]
    faces_collection.insert(data)
    faces_collection.flush()
    print(f"✅ Inserted {name} into Milvus")


def search_face(embedding, top_k=1):
    faces_collection.load()
    embedding = normalize(embedding)  # ✅ normalize query too
    results = faces_collection.search(
        data=[embedding],
        anns_field="embedding",
        param={"metric_type": "IP", "params": {"nprobe": 32}},
        limit=top_k,
        output_fields=["name", "image_url"],
    )
    if results and results[0]:
        match = results[0][0]
        distance = getattr(match, "distance", None)  # this is cosine similarity score
        return {
            "name": match.entity.get("name"),
            "image": match.entity.get("image_url"),
            "distance": float(distance) if distance is not None else None,
        }
    return None


def list_faces(limit: int = 100):
    faces_collection.load()
    results = faces_collection.query(expr="", output_fields=["name", "image_url"], limit=limit)
    return results
