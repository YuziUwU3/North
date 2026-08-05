"""Generate the bundled, seamless incoming-call ringtone.

The sound intentionally avoids alert-like sweeps, square/triangle waves, sharp
attacks, and sustained high-frequency pure tones. Every oscillator completes an
integer number of cycles over the eight-second file so the loop seam stays quiet.
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path


RATE = 44_100
DURATION = 8.0
FRAMES = int(RATE * DURATION)
TARGET_PEAK = 0.22
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "incoming-soft-ring-v1.wav"


def loop_frequency(target_hz: float) -> float:
    return round(target_hz * DURATION) / DURATION


def circular_hann(time_s: float, center_s: float, width_s: float) -> float:
    distance = (time_s - center_s + DURATION / 2) % DURATION - DURATION / 2
    if abs(distance) >= width_s / 2:
        return 0.0
    return 0.5 + 0.5 * math.cos(2 * math.pi * distance / width_s)


pad = [
    (loop_frequency(220.00), 0.022),
    (loop_frequency(277.18), 0.018),
    (loop_frequency(329.63), 0.016),
]
melody = [
    (0.7, loop_frequency(440.00)),
    (2.7, loop_frequency(554.37)),
    (4.7, loop_frequency(659.25)),
    (6.7, loop_frequency(554.37)),
]

samples: list[float] = []
for index in range(FRAMES):
    time_s = index / RATE
    breath = 0.82 + 0.18 * math.cos(2 * math.pi * time_s / DURATION)
    value = sum(level * breath * math.sin(2 * math.pi * freq * time_s) for freq, level in pad)
    for center, freq in melody:
        envelope = circular_hann(time_s, center, 2.8)
        if envelope:
            warm_sub = loop_frequency(freq / 2)
            tone = 0.84 * math.sin(2 * math.pi * freq * time_s)
            tone += 0.16 * math.sin(2 * math.pi * warm_sub * time_s)
            value += 0.068 * envelope * tone
    samples.append(value)

raw_peak = max(abs(value) for value in samples)
gain = TARGET_PEAK / raw_peak
pcm = [max(-32767, min(32767, round(value * gain * 32767))) for value in samples]

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUTPUT), "wb") as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    wav.writeframes(b"".join(struct.pack("<h", value) for value in pcm))

peak = max(abs(value) for value in pcm) / 32767
rms = math.sqrt(sum(value * value for value in pcm) / len(pcm)) / 32767
window = int(RATE * 0.05)
window_rms = [
    math.sqrt(sum(value * value for value in pcm[start : start + window]) / window) / 32767
    for start in range(0, len(pcm) - window + 1, window)
]
seam_jump = abs(pcm[0] - pcm[-1]) / 32767
print(
    f"wrote={OUTPUT} duration={DURATION:.1f}s rate={RATE} "
    f"peak_dbfs={20 * math.log10(peak):.2f} rms_dbfs={20 * math.log10(rms):.2f} "
    f"min_50ms_rms_dbfs={20 * math.log10(min(window_rms)):.2f} seam_jump={seam_jump:.6f}"
)
