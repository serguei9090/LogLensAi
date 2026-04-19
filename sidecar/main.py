import os
import sys

# Ensure the 'src' directory is in the python path
src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "src")
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from api import main  # noqa: E402

if __name__ == "__main__":
    main()
