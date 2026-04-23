import asyncio
import contextlib
import os

from google.genai import Client, errors


async def test_list_models():
    api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable not set.")
        return

    print(f"Testing list_models with API Key: {api_key[:5]}...{api_key[-5:]}")
    client = Client(api_key=api_key)

    try:
        print("Calling client.models.list()...")
        # google-genai Client.models.list is synchronous (blocking)
        models = client.models.list()
        print("Successfully fetched models:")
        for m in models:
            print(f" - {m.name}")
    except errors.APIError as e:
        print("\nAPI Error Caught!")
        print(f"Status Code: {e.code}")
        print(f"Message: {e.message}")
        with contextlib.suppress(Exception):
            print(f"Details: {e.details}")
    except Exception as e:
        print(f"\nUnexpected Error: {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(test_list_models())
