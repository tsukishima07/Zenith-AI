def generate_title(message: str) -> str:
    """
    Generate a simple conversation title
    from the first user message.
    """

    title = " ".join(message.strip().split())

    if not title:
        return "New Conversation"

    if len(title) <= 40:
        return title

    return title[:40].rstrip() + "..."