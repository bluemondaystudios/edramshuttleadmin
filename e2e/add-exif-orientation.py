"""Inserts a minimal EXIF block with Orientation=<n> into a JPEG (for testing rotation handling).
Usage: python3 -I e2e/add-exif-orientation.py in.jpg out.jpg 6"""
import struct
import sys

src, dst, orient = sys.argv[1], sys.argv[2], int(sys.argv[3])
data = open(src, 'rb').read()
assert data[:2] == b'\xff\xd8', 'not a JPEG'
# TIFF header (big-endian) + IFD0 with one entry: tag 0x0112 Orientation, SHORT, count 1
tiff = b'MM' + struct.pack('>HI', 42, 8) + struct.pack('>H', 1) + struct.pack('>HHIHH', 0x0112, 3, 1, orient, 0) + struct.pack('>I', 0)
payload = b'Exif\x00\x00' + tiff
app1 = b'\xff\xe1' + struct.pack('>H', len(payload) + 2) + payload
open(dst, 'wb').write(data[:2] + app1 + data[2:])
