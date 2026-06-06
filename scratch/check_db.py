import sys
sys.path.insert(0, 'sidecar/src')
from metadata_extractor import extract_log_metadata

# Test with a real Apache log line
line = r'83.149.9.216 - - [17/May/2015:10:05:03 +0000] "GET /kibana-search.png HTTP/1.1" 200 203023'
result = extract_log_metadata(line)
print('timestamp:', result['timestamp'])
print('level:    ', result['level'])

line2 = r'66.249.73.185 - - [17/May/2015:10:05:22 +0000] "GET /doc/index.html HTTP/1.1" 404 294'
result2 = extract_log_metadata(line2)
print('404 timestamp:', result2['timestamp'])
print('404 level:    ', result2['level'])

line3 = r'208.91.156.11 - - [17/May/2015:11:05:05 +0000] "GET /files/logstash.jar HTTP/1.1" 500 324'
result3 = extract_log_metadata(line3)
print('500 timestamp:', result3['timestamp'])
print('500 level:    ', result3['level'])
