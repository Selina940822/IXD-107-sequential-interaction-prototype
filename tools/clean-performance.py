"""Build assets/images/performance.webp from the raw reference frame.

The rhythm-game note lanes are a semi-transparent tint, so the scene under them
(legs, TV pedestal, floor and reflection) is still in the pixels. This script:
  1. crops the letterbox bars,
  2. reverses the lane tint row by row (an affine colour map per row that matches
     the untinted rows just above and below the lanes),
  3. inpaints only the opaque UI marks: lane divider lines, grid lines, star notes,
     the progress bar and the hearts.

    pip install opencv-python-headless numpy
    python3 tools/clean-performance.py tools/source/performance-raw.webp assets/images/performance.webp
"""
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
img = cv2.imread(src)[126:1253].astype(np.float32)   # 2000 x 1127
H, W = img.shape[:2]
raw = img.copy()

TOP, BOT = 772, 978                       # tinted lane block
BANDS = [(773, 825), (830, 875), (884, 929), (934, 977)]
LINES = [(770, 774), (824, 832), (873, 886), (928, 936), (975, 981)]

# 1. un-tint: for each band and each horizontal window, map the band's colour
#    statistics onto those of the untinted rows just above (752-770) and below
#    (982-1000) in the same window; the map is interpolated smoothly along x.
STEP, HALF = 40, 160
centers = np.arange(0, W + STEP, STEP)
ref_a, ref_b = img[752:771], img[982:1001]
for y0, y1 in BANDS:
    blk = img[y0:y1 + 1]
    K = np.zeros((len(centers), 3)); MO = np.zeros_like(K); MT = np.zeros_like(K)
    for i, cx in enumerate(centers):
        x0, x1 = max(0, cx - HALF), min(W, cx + HALF)
        o = blk[:, x0:x1].reshape(-1, 3)
        t = ((y0 + y1) / 2 - TOP) / (BOT - TOP)
        ra, rb = ref_a[:, x0:x1].reshape(-1, 3), ref_b[:, x0:x1].reshape(-1, 3)
        mt = ra.mean(0) * (1 - t) + rb.mean(0) * t
        st = ra.std(0) * (1 - t) + rb.std(0) * t
        K[i] = st / (o.std(0) + 1e-3); MO[i] = o.mean(0); MT[i] = mt
    xs = np.arange(W)
    k = np.stack([np.interp(xs, centers, K[:, c]) for c in range(3)], 1)
    mo = np.stack([np.interp(xs, centers, MO[:, c]) for c in range(3)], 1)
    mt = np.stack([np.interp(xs, centers, MT[:, c]) for c in range(3)], 1)
    k = np.clip(k, 1, 3)                       # a tint can only have darkened and flattened the scene
    img[y0:y1 + 1] = (blk - mo) * k + mt
    # remove the remaining vertical shading inside the band (row means drift)
    band_mean = img[y0:y1 + 1].reshape(-1, 3).mean(0)
    for y in range(y0, y1 + 1):
        img[y] += (band_mean - img[y].mean(0)) * .8
img = np.clip(img, 0, 255)

# 2. inpaint the small opaque marks: star notes, grid lines and the divider lines
mask = np.zeros((H, W), np.uint8)
for y0, y1 in LINES:
    mask[y0:y1, :] = 255
# vertical grid lines: thin bright columns that run through the whole lane block
band = raw[TOP:BOT].mean(2)
colprof = np.median(band, 0)
bg = cv2.blur(colprof[None, :].astype(np.float32), (15, 1))[0]
for x in np.where(colprof - bg > 10)[0]:
    mask[TOP:BOT, max(0, x - 2):x + 3] = 255
# star notes (positions read off the raw frame)
NOTES = [(985, 852), (1258, 852), (1335, 852), (1410, 852), (1527, 852),
         (1642, 852), (1757, 852), (1870, 852), (1948, 852),
         (485, 905), (1098, 905), (1484, 905), (1712, 905), (872, 962)]
# the four stacked "hit" stars on the left are covered by one tall box
BOXES = [(cx - 32, cx + 32, cy - 32, cy + 32) for cx, cy in NOTES] + [(348, 422, 764, 994)]
mask = cv2.dilate(mask, np.ones((3, 3), np.uint8))
img = cv2.inpaint(np.clip(img, 0, 255).astype(np.uint8), mask, 5, cv2.INPAINT_TELEA).astype(np.float32)

# each note is replaced by a smooth patch blended from its four surrounding edges
# (a Coons patch), so lane stripes and the legs both run through it
for x0, x1, y0, y1 in BOXES:
    L, Rt = img[y0:y1, x0 - 1].copy(), img[y0:y1, x1].copy()
    T, B = img[y0 - 1, x0:x1].copy(), img[y1, x0:x1].copy()
    u = (np.arange(x1 - x0) + 1)[None, :, None] / (x1 - x0 + 1)
    v = (np.arange(y1 - y0) + 1)[:, None, None] / (y1 - y0 + 1)
    c00, c10, c01, c11 = img[y0 - 1, x0 - 1], img[y0 - 1, x1], img[y1, x0 - 1], img[y1, x1]
    patch = ((1 - u) * L[:, None] + u * Rt[:, None] + (1 - v) * T[None] + v * B[None]
             - ((1 - u) * (1 - v) * c00 + u * (1 - v) * c10 + (1 - u) * v * c01 + u * v * c11))
    img[y0:y1, x0:x1] = patch

# 3. divider lines again, now by interpolating each column across the gap
#    (keeps vertical shapes such as the legs and pedestal continuous)
def column_fill(x0, x1, y0, y1):
    top, bot = img[y0 - 1, x0:x1].copy(), img[y1, x0:x1].copy()
    for i, y in enumerate(range(y0, y1)):
        t = (i + 1) / (y1 - y0 + 1)
        img[y, x0:x1] = top * (1 - t) + bot * t
for y0, y1 in LINES:
    column_fill(0, W, y0, y1)

# 4. HUD. The progress bar is thin, so it is filled per column like the lines;
#    the taller hearts and right marker are filled by mirroring the rows above.
column_fill(0, 728, 1062, 1100)          # progress bar
column_fill(622, 728, 1044, 1106)        # "NF"
def mirror_fill(x0, x1, y0, y1, feather=10):
    h = y1 - y0
    src = img[y0 - h:y0, x0:x1][::-1].copy()
    for i in range(h):
        w = min(1, (h - i) / feather)
        img[y0 + i, x0:x1] = src[i] * w + img[y0 + i, x0:x1] * (1 - w)
mirror_fill(1084, 1546, 1036, 1118)      # hearts
mirror_fill(1956, W, 1030, 1120)         # right marker

out = np.clip(img, 0, 255).astype(np.uint8)
cv2.imwrite(dst, out, [cv2.IMWRITE_WEBP_QUALITY, 92])
