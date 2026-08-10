import ollama

response = ollama.chat(
    model="qwen2.5:7b",
    messages=[
        {
            "role": "user",
            "content": "Hello! Introduce yourself in one sentence."
        }
    ]
)

print(response["message"]["content"])