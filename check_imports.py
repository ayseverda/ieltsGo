print("Checking imports...")
try:
    import uvicorn
    print("uvicorn imported successfully")
except ImportError as e:
    print(f"Failed to import uvicorn: {e}")

try:
    import fastapi
    print("fastapi imported successfully")
except ImportError as e:
    print(f"Failed to import fastapi: {e}")
