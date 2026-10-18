"""Vectorise the scene pictures so every step stays sharp at any size or zoom.

Each picture is gently sharpened, reduced to a small palette (k-means in Lab) so halftone
dots and flat areas become single-colour shapes, then traced to SVG with vtracer.
Cut-outs keep their transparency.

    pip install opencv-python-headless numpy vtracer
    python3 tools/vectorize.py
"""
import os
import cv2
import numpy as np
import vtracer

JOBS = [  # source, output, palette size
    ('tools/source/room-hd.webp',             'assets/images/room.svg',          14),
    ('tools/source/tv-closeup-hd.webp',       'assets/images/tv-closeup.svg',    14),
    ('tools/source/performance-hd.webp',      'assets/images/performance.svg',   16),
    ('tools/source/guitar-closeup.webp',     'assets/images/guitar-closeup.svg', 12),
    ('tools/source/band-stage.webp',         'assets/images/band-stage.svg',    8),
] + [(f'tools/source/band-member-{i}.webp', f'assets/images/band-member-{i}.svg', 10) for i in range(4)]

TMP = '/tmp/vectorize'
os.makedirs(TMP, exist_ok=True)


def quantise(bgr, k, mask=None):
    blur = cv2.GaussianBlur(bgr, (0, 0), 1.2)
    sharp = cv2.addWeighted(bgr, 1.6, blur, -.6, 0)
    lab = cv2.cvtColor(sharp, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    pool = lab if mask is None else lab[mask.reshape(-1) > 0]
    rng = np.random.default_rng(1)
    samp = pool[rng.choice(len(pool), min(60000, len(pool)), replace=False)]
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, _, cent = cv2.kmeans(samp, k, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    lbl = np.empty(len(lab), np.int32)
    for s in range(0, len(lab), 400000):                    # in chunks to keep memory low
        lbl[s:s + 400000] = ((lab[s:s + 400000, None, :] - cent[None]) ** 2).sum(2).argmin(1)
    q = cv2.cvtColor(cent[lbl].reshape(bgr.shape).astype(np.uint8), cv2.COLOR_LAB2BGR)
    return cv2.medianBlur(q, 3)


# pictures whose fine halftone screen is redrawn as a repeating vector dot pattern instead of traced dot by dot
SCREENED = {'assets/images/band-stage.svg': ('#7fb3bc', .38, 9)}

for src, dst, k in JOBS:
    im = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    if dst in SCREENED:
        im = cv2.bilateralFilter(cv2.medianBlur(im, 9), 9, 30, 9)
    alpha = im[..., 3] if im.ndim == 3 and im.shape[2] == 4 else None
    bgr = im[..., :3] if im.ndim == 3 else cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
    q = quantise(bgr, k, None if alpha is None else (alpha > 128).astype(np.uint8))
    tmp = os.path.join(TMP, os.path.basename(dst) + '.png')
    if alpha is not None:
        q = np.dstack([q, np.where(alpha > 128, 255, 0).astype(np.uint8)])
    cv2.imwrite(tmp, q)
    vtracer.convert_image_to_svg_py(tmp, dst, colormode='color', hierarchical='stacked', mode='spline',
                                    filter_speckle=3, color_precision=8, layer_difference=4, corner_threshold=70,
                                    length_threshold=3.5, max_iterations=10, splice_threshold=45, path_precision=1)
    h, w = bgr.shape[:2]
    # give the SVG a viewBox so it scales as vector wherever it is placed
    s = open(dst).read()
    s = s.replace(f'width="{w}" height="{h}"', f'width="{w}" height="{h}" viewBox="0 0 {w} {h}" preserveAspectRatio="none"', 1)
    if dst in SCREENED:
        col, op, per = SCREENED[dst]
        s = s.replace('</svg>', f'<defs><pattern id="screen" width="{per}" height="{per}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="{per/2}" cy="{per/2}" r="{per*.2:.2f}" fill="{col}"/></pattern></defs><rect width="{w}" height="{h}" fill="url(#screen)" opacity="{op}"/></svg>')
    open(dst, 'w').write(s)
    print(dst, w, h, os.path.getsize(dst) // 1024, 'KB')
