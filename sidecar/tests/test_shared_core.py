import os
import time
import unittest

from services.log_file_store import DiskLogStore
from services.shared_core import SharedSourceManager


class TestSharedCore(unittest.TestCase):
    def setUp(self):
        self.storage_dir = "data/test_storage_shared"
        os.makedirs(self.storage_dir, exist_ok=True)
        self.log_store = DiskLogStore(self.storage_dir)
        self.manager = SharedSourceManager(self.log_store)

    def test_singleton(self):
        manager2 = SharedSourceManager()
        self.assertIs(self.manager, manager2)

    def test_shared_tailing(self):
        source_id = "test_shared_source"
        filepath = os.path.join(self.storage_dir, "shared.log")

        # Create initial file
        with open(filepath, "w") as f:
            f.write("Line 1\n")
            f.flush()

        source = self.manager.get_source(source_id, filepath)

        results_ws1 = []
        results_ws2 = []

        def callback1(line, lid):
            results_ws1.append(line)

        def callback2(line, lid):
            results_ws2.append(line)

        source.subscribe(callback1)
        source.subscribe(callback2)

        # Allow time for tailer to start and seek to end
        time.sleep(0.5)

        with open(filepath, "a") as f:
            f.write("Line 2\n")
            f.write("Line 3\n")
            f.flush()

        # Wait for broadcast
        time.sleep(0.5)

        self.assertEqual(len(results_ws1), 2)
        self.assertEqual(len(results_ws2), 2)
        self.assertEqual(results_ws1[0], "Line 2")
        self.assertEqual(results_ws1[1], "Line 3")

        source.unsubscribe(callback1)

        with open(filepath, "a") as f:
            f.write("Line 4\n")
            f.flush()

        time.sleep(0.5)

        self.assertEqual(len(results_ws1), 2)  # Should not receive Line 4
        self.assertEqual(len(results_ws2), 3)  # Should receive Line 4
        self.assertEqual(results_ws2[2], "Line 4")

        self.manager.cleanup()


if __name__ == "__main__":
    unittest.main()
