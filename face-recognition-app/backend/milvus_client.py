from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType

# Connect to Milvus
connections.connect("default", host="127.0.0.1", port="19530")

# Define schema
name_field = FieldSchema(name="name", dtype=DataType.VARCHAR, max_length=100, is_primary=True)
image_field = FieldSchema(name="image_url", dtype=DataType.VARCHAR, max_length=500)
embedding_field = FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=128)  # deepface default is 128

schema = CollectionSchema(fields=[name_field, image_field, embedding_field], description="Face recognition database")

# Create collection if not exists
collection_name = "faces"
if collection_name not in [c.name for c in Collection.list()]:
    faces_collection = Collection(name=collection_name, schema=schema)
else:
    faces_collection = Collection(name=collection_name)

# Insert face
def insert_face(name, image_url, embedding):
    data = [[name], [image_url], [embedding]]
    faces_collection.insert(data)
    faces_collection.flush()
    print(f"✅ Inserted {name} into Milvus")

# Search face
def search_face(embedding, top_k=1):
    results = faces_collection.search(
        data=[embedding],
        anns_field="embedding",
        param={"metric_type": "L2", "params": {"nprobe": 10}},
        limit=top_k,
        output_fields=["name", "image_url"],
    )
    if results and results[0]:
        match = results[0][0]
        return {"name": match.entity.get("name"), "image": match.entity.get("image_url")}
    return None
