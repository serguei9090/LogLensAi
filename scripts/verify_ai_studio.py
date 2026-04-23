import os

from google.genai import Client


def load_env():
    env_path = ".env"
    if not os.path.exists(env_path):
        env_path = os.path.join("..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    key, value = line.strip().split("=", 1)
                    os.environ[key.strip()] = value.strip()


def test_prefixes():
    load_env()
    api_key = os.environ.get("GOOGLEAI_API")
    client = Client(api_key=api_key)

    test_models = ["gemini-2.5-flash", "gemma-4-31b-it"]

    for m in test_models:
        print(f"\n--- Testing Model: {m} ---")

        # Test 1: No prefix
        try:
            print(f"Trying WITHOUT prefix: '{m}'...")
            client.models.generate_content(model=m, contents="Ping")
            print("SUCCESS (No prefix)")
        except Exception as e:
            print(f"FAILED (No prefix): {e}")

        # Test 2: With prefix
        prefixed = f"models/{m}"
        try:
            print(f"Trying WITH prefix: '{prefixed}'...")
            client.models.generate_content(model=prefixed, contents="Ping")
            print("SUCCESS (With prefix)")
        except Exception as e:
            print(f"FAILED (With prefix): {e}")


if __name__ == "__main__":
    test_prefixes()
