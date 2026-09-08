from fastapi import FastAPI

app = FastAPI(
    title="API",
    version="1.0.0",
)

@app.get("/")
def root():
    return {"message": "API is running"}

@app.get("/health")
def health():
    return {"status": "healthy"}