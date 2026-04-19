import os
import sys

# Ensure the sidecar/src directory is in the python path
sidecar_src = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, sidecar_src)

