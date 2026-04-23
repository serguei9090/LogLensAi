from google.genai import Client, errors

try:
    print("Testing with invalid key...")
    Client(api_key="invalid").models.list()
except errors.APIError as e:
    print(f"Caught API Error: Status={e.code}, Msg={e.message}")
except Exception as e:
    print(f"Caught Unexpected Error: {type(e).__name__}: {e}")
