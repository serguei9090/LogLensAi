import os
import sys

# Ensure the 'src' directory is in the path for internal imports
src_path = os.path.join(os.path.dirname(__file__), "src")
if src_path not in sys.path:
    sys.path.append(src_path)

from src.api import main  # noqa: E402

if __name__ == "__main__":
    main()
