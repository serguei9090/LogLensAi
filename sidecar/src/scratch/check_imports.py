import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)
print(f"Searching in: {parent_dir}")
try:
    import models
    print(f"SUCCESS: Imported models from {models.__file__}")
    from models import GetIngestionJobsRequest, IngestLocalFileRequest
    print("SUCCESS: Found GetIngestionJobsRequest and IngestLocalFileRequest")
except ImportError as e:
    print(f"IMPORT ERROR: {e}")
except NameError as e:
    print(f"NAME ERROR: {e}")
except Exception as e:
    print(f"ERROR: {e}")
