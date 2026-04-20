import ipaddress
import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'sidecar/src'))

from metadata_extractor import extract_log_metadata


def test_ipv6_extraction():
    raw = "2024-03-21 15:30:45 INFO User connected from [2001:0db8:85a3:0000:0000:8a2e:0370:7334]"
    meta = extract_log_metadata("ws1", "src1", raw)
    facets = meta["facets"]
    print(f"Facets: {facets}")
    try:
        if "ip" in facets and ipaddress.ip_address(facets["ip"]) == ipaddress.ip_address("2001:0db8:85a3:0000:0000:8a2e:0370:7334"):
            print("IPv6 extracted successfully!")
        else:
            print("IPv6 extraction FAILED.")
    except Exception as e:
        print(f"Error during validation: {e}")
        print("IPv6 extraction FAILED.")

if __name__ == "__main__":
    test_ipv6_extraction()
