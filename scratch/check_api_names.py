import sys

sys.path.append("sidecar/src")

try:
    import api

    print("API module imported successfully")

    # Check if GetIngestionJobsRequest is in api namespace
    if hasattr(api, "GetIngestionJobsRequest"):
        print(f"GetIngestionJobsRequest is in api namespace: {api.GetIngestionJobsRequest}")
    else:
        print("GetIngestionJobsRequest is NOT in api namespace")

    # Check all names in the models dict
    # We need to peek into the dispatch method or just the module
    # Actually, we can check all names imported from models
    import models

    for name in dir(models):
        if name.endswith("Request"):
            if hasattr(api, name):
                # print(f"Match: {name}")
                pass
            else:
                print(f"MISSING in api.py: {name}")

except Exception as e:
    print(f"Error: {e}")
    import traceback

    traceback.print_exc()
