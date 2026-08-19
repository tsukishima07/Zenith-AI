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
def generate_response_stream(
    message: str,
    history: list[dict]
):
    messages = history + [
        {
            "role": "user",
            "content": message
        }
    ]

    stream = ollama.chat(
        model="qwen2.5:7b",
        messages=messages,
        stream=True
    )

    for chunk in stream:
        content = chunk["message"]["content"]

        if content:
            yield content