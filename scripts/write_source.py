import base64
import sys

def write_b64_file(target_path, b64_str):
    content = base64.b64decode(b64_str.encode('utf-8'))
    with open(target_path, 'wb') as f:
        f.write(content)
    print(f"Wrote {target_path} ({len(content)} bytes)")

if __name__ == '__main__':
    target = sys.argv[1]
    b64_data = sys.argv[2]
    write_b64_file(target, b64_data)
