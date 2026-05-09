import logging
import os
import struct

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RepairIndex")


def rebuild_index(path, idx_path):
    count = 0
    try:
        with open(path, "rb") as lf, open(idx_path, "wb") as idx:
            # First offset is always 0
            idx.write(struct.pack("<Q", 0))

            while True:
                chunk = lf.read(1 << 20)
                if not chunk:
                    break
                # We need to find every \n and record the offset AFTER it
                base_offset = lf.tell() - len(chunk)
                pos = chunk.find(b"\n")
                while pos != -1:
                    count += 1
                    abs_offset = base_offset + pos + 1
                    idx.write(struct.pack("<Q", abs_offset))
                    pos = chunk.find(b"\n", pos + 1)

            # Ensure the very last byte of the file is indexed if not ending in \n
            final_size = lf.tell()
            idx.flush()

        # Re-check the last entry
        with open(idx_path, "rb+") as f:
            f.seek(-8, os.SEEK_END)
            last_val = struct.unpack("<Q", f.read(8))[0]
            if last_val != final_size:
                logger.info(f"Adding final offset {final_size} to {idx_path}")
                f.write(struct.pack("<Q", final_size))

        return count
    except Exception as exc:
        logger.error(f"Failed to rebuild index for {path}: {exc}")
        return 0


storage_dir = r"i:/01-Master_Code/Apps/LogLensAi/data/storage"
for f in os.listdir(storage_dir):
    if f.endswith(".log"):
        log_path = os.path.join(storage_dir, f)
        idx_path = os.path.join(storage_dir, f[:-4] + ".index")
        logger.info(f"Repairing index for {f}...")
        c = rebuild_index(log_path, idx_path)
        logger.info(f"Done. {c} lines indexed.")
