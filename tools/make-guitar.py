"""Build tools/source/guitar-closeup.webp: the sharp guitar close-up, aligned to the
1393x1011 frame that the string geometry in guitar-closeup-strings.svg uses, at 1.4247x
that resolution. The sharp frame is cropped slightly differently, so its position is
found by feature matching against the original photo; the thin strip it doesn't cover
(at the top) is filled from the original photo.

    pip install opencv-python-headless numpy
    python3 tools/make-guitar.py
"""
import cv2
import numpy as np

hd = cv2.imread('tools/source/guitar-closeup-hd.webp')
ref = cv2.imread('tools/source/guitar-closeup-strings-photo.jpg')       # 1393x1011, the strings' frame

ga, gb = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), cv2.cvtColor(hd, cv2.COLOR_BGR2GRAY)
orb = cv2.ORB_create(6000)
ka, da = orb.detectAndCompute(ga, None); kb, db = orb.detectAndCompute(gb, None)
m = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(db, da), key=lambda x: x.distance)[:800]
pb = np.float32([kb[x.queryIdx].pt for x in m]); pa = np.float32([ka[x.trainIdx].pt for x in m])
M, _ = cv2.estimateAffinePartial2D(pb, pa, method=cv2.RANSAC, ransacReprojThreshold=2)

K = 1 / np.hypot(M[0, 0], M[1, 0])                 # output scale relative to the strings' frame
W, H = round(1393 * K), round(1011 * K)
A = M * K                                          # hd pixels -> output pixels
out = cv2.warpAffine(hd, A, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
cover = cv2.warpAffine(np.full(hd.shape[:2], 255, np.uint8), A, (W, H), flags=cv2.INTER_NEAREST)
base = cv2.resize(ref, (W, H), interpolation=cv2.INTER_CUBIC)
cover = cv2.erode(cover, np.ones((5, 5), np.uint8))
soft = cv2.GaussianBlur(cover, (9, 9), 0).astype(np.float32)[..., None] / 255
out = (out * soft + base * (1 - soft)).astype(np.uint8)
cv2.imwrite('tools/source/guitar-closeup.webp', out, [cv2.IMWRITE_WEBP_QUALITY, 94])
print('guitar-closeup.webp', W, H, 'scale', round(K, 4))
