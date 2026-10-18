"""Cut the four band members out of tools/source/band-hd.webp so each can sway on its own.

Writes tools/source/band-stage.webp (the stage with the members removed, filled
by inpainting under where they stand) and tools/source/band-member-{0..3}.webp
(each member with a transparent background, cropped to its box). The box offsets
are printed; js/main.js and css/style.css use them.

    pip install opencv-python-headless numpy
    python3 tools/cut-band.py
"""
import cv2
import numpy as np

img = cv2.imread('tools/source/band-hd.webp')        # the sharp version (2000 px wide)
H, W = img.shape[:2]
F = W / 1402                                         # boxes below are in band.webp (1402 px) units
bg = cv2.medianBlur(img, 87)
diff = np.abs(img.astype(int) - bg.astype(int)).sum(2)
lum = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# a figure differs from the local background, or is simply dark (suits, legs, drums)
raw = ((diff > 45) | (lum < 130)).astype(np.uint8) * 255

# boxes in band.webp pixels: bassist, drummer, keyboardist, guitarist
BOXES = [tuple(min(round(v * F), lim) for v, lim in zip(b, (W, H, W, H)))
         for b in [(10, 235, 250, 668), (606, 18, 924, 368), (1106, 222, 1402, 692), (576, 398, 1044, 984)]]
union = np.zeros((H, W), np.uint8)
for i, (x0, y0, x1, y1) in enumerate(BOXES):
    m = raw[y0:y1, x0:x1].copy()
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23)))
    # keep the figure's own pieces, drop specks
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] > 700:
            keep[lab == k] = 255
    m = keep
    # a figure cut by the bottom edge is closed along that edge before filling holes
    if y1 == H:
        xs = np.where(m[-4:].max(0) > 0)[0]
        if len(xs): m[-1, xs.min():xs.max() + 1] = 255
    pad = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    ff = pad.copy(); cv2.floodFill(ff, None, (0, 0), 255)
    m = (pad | cv2.bitwise_not(ff))[1:-1, 1:-1]
    m = cv2.erode(m, np.ones((3, 3), np.uint8))
    alpha = cv2.GaussianBlur(m, (3, 3), 0)
    cut = cv2.cvtColor(img[y0:y1, x0:x1], cv2.COLOR_BGR2BGRA)
    cut[..., 3] = alpha
    cv2.imwrite(f'tools/source/band-member-{i}.webp', cut, [cv2.IMWRITE_WEBP_QUALITY, 100])
    union[y0:y1, x0:x1] |= m
    print(i, 'box', x0, y0, x1 - x0, y1 - y0)

hole = cv2.dilate(union, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (19, 19)))
stage = cv2.inpaint(img, hole, 13, cv2.INPAINT_TELEA)
# extend the stage by mirroring its own edges so it fills the whole TV screen around the
# band (band.webp sits at 65,100 scaled 0.6134 inside the 990x740 screen)
SC = 860 / W
L = R = round(65 / SC); T = round(100 / SC); B = round((740 - 100 - 604) / SC)
stage = cv2.copyMakeBorder(stage, T, B, L, R, cv2.BORDER_REFLECT)
cv2.imwrite('tools/source/band-stage.webp', stage, [cv2.IMWRITE_WEBP_QUALITY, 95])
print('stage', stage.shape[1], stage.shape[0])
