"""Extract the dialog click ("ka-da") from the reference screen recording.

Keeps 0.085-0.42 s (the two clicks), removes the background by spectral
subtraction using the quiet tail of the clip (0.45-0.80 s) as the noise profile,
high-passes away the low hum, fades the edges and normalises.

    ffmpeg -i tools/source/dialog-click-recording.mp4 -ac 1 -ar 48000 /tmp/raw.wav
    python3 tools/extract-click.py /tmp/raw.wav /tmp/click.wav
    ffmpeg -i /tmp/click.wav -b:a 128k assets/audio/dialog-click.mp3
"""
import sys, wave
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
w = wave.open(src); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768

N, H = 1024, 256
win = np.hanning(N)
def stft(s):
    return np.array([np.fft.rfft(s[i:i + N] * win) for i in range(0, len(s) - N, H)])
def istft(S, n):
    out = np.zeros(n + N); norm = np.zeros(n + N)
    for k, frame in enumerate(S):
        i = k * H
        out[i:i + N] += np.fft.irfft(frame) * win; norm[i:i + N] += win ** 2
    return out[:n] / np.maximum(norm[:n], 1e-8)

noise = np.abs(stft(x[int(.45 * sr):int(.80 * sr)])).mean(0)
seg = x[int(.085 * sr):int(.42 * sr)]
S = stft(seg)
mag, ph = np.abs(S), np.angle(S)
clean = np.maximum(mag - 2.5 * noise, 0.04 * mag)          # over-subtract, keep a small floor
freqs = np.fft.rfftfreq(N, 1 / sr)
clean *= 1 / (1 + (450 / np.maximum(freqs, 1)) ** 4)        # 4th-order-ish high-pass at 450 Hz
y = istft(clean * np.exp(1j * ph), len(seg))
fade = int(.004 * sr)
y[:fade] *= np.linspace(0, 1, fade); y[-int(.04 * sr):] *= np.linspace(1, 0, int(.04 * sr))
y = y / np.abs(y).max() * 10 ** (-3 / 20)
o = wave.open(dst, 'w'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr)
o.writeframes((y * 32767).astype(np.int16).tobytes()); o.close()
