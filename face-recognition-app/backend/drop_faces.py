from pymilvus import connections, utility

# connect to Milvus
connections.connect("default", host="127.0.0.1", port="19530")

# check if collection exists
if utility.has_collection("faces"):
    utility.drop_collection("faces")
    print("✅ Dropped collection: faces")
else:
    print("⚠️ Collection 'faces' does not exist")
