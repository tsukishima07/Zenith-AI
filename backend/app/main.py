from fastapi import FastAPI
from pydantic import BaseModel

from app.chat import generate_response


app = FastAPI(title="Zenith AI")


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def root():
    return {"message": "Welcome to Zenith AI"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/chat")
def chat(request: ChatRequest):
    response = generate_response(request.message)

    return {
        "response": response
    }