from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.chat import generate_response


app = FastAPI(title="Zenith AI")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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