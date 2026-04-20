import asyncio
import json

import aiohttp


async def diagnostic():
    url = "http://localhost:11434/api/chat"
    payload = {
        "model": "gemma4:e2b",
        "messages": [
            {"role": "system", "content": "<|think|>You are a log analyzer."},
            {
                "role": "user",
                "content": "<|think|>\nhi\n(Please think deeply before responding in your reasoning channel)",
            },
        ],
        "stream": True,
    }

    print("--- OLLAMA RAW STREAM DIAGNOSTIC ---")
    async with aiohttp.ClientSession() as session, session.post(url, json=payload) as resp:
        async for line in resp.content:
            if line:
                chunk = json.loads(line.decode("utf-8"))
                if "message" in chunk:
                    msg = chunk["message"]
                    # Check for hidden fields Ollama might be using
                    thinking = msg.get("thinking") or msg.get("thought")
                    content = msg.get("content")
                    print(f"Reasoning Field: {repr(thinking)} | Content Field: {repr(content)}")


if __name__ == "__main__":
    asyncio.run(diagnostic())
