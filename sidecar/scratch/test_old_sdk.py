import os

import google.generativeai as genai


def test_old_sdk():
    api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        print("Set GOOGLE_API_KEY")
        return

    genai.configure(api_key=api_key)
    try:
        print("Listing models with old SDK...")
        for m in genai.list_models():
            print(f" - {m.name}")
    except Exception as e:
        print(f"Old SDK Error: {e}")


if __name__ == "__main__":
    test_old_sdk()
