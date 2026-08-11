import ollama


def generate_response(
    message: str,
    history: list[dict]
) -> str:

    messages = history + [
        {
            "role": "user",
            "content": message
        }
    ]

    response = ollama.chat(
        model="qwen2.5:7b",
        messages=messages
    )

    return response["message"]["content"]