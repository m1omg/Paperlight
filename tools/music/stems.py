"""print relative stem energy (dB, loudest=0) per track: python3 stems.py [tracks]"""
import sys, numpy as np
import songs
for name in (sys.argv[1:] or songs.TRACKS):
    songs.TRACKS[name]()
    st = songs.LAST['song'].stats
    L = songs.LAST['song'].L
    mx = max(st.values())
    print(f"{name:12s}", "  ".join(f"{k}:{10*np.log10(v/mx+1e-12):.0f}" for k, v in sorted(st.items(), key=lambda kv: -kv[1])))
