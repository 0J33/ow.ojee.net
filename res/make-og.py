#!/usr/bin/env python3
"""Render the link-preview cards. 1200x630, the site's own icon and palette.

Same layout as the other ojee.net sites (teg.ojee.net/assets/make-og.py).
Run from the repo root:  python3 res/make-og.py
Needs Pillow and rsvg-convert.
"""
import os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# css/styles.css :root — --ow-bg, --ow-panel-solid, --ow-orange, --ow-text, --ow-text-dim
PALETTE = dict(bg="#05070f", panel="#111624", accent="#F99E1A", ink="#E6ECF5", dim="#9DAEC6")
SVG = "res/favicon.svg"

CARDS = [
    dict(out="res/og-ow.png", title="ow.", sub="trackers",
         lines=["Overwatch 2 trackers for one group of friends",
                "ranks per role · who can queue together · aim drills"]),
    dict(out="res/og.png", title="ow.", sub="rank",
         lines=["Overwatch 2 ranks for you and your friends",
                "per role · narrow or wide group · rank history"]),
    dict(out="res/og-aim.png", title="ow.", sub="aim",
         lines=["Practice-range aim scores for you and your friends",
                "drills · heroes · leaderboards · stats"]),
]

def font(size, bold=False):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else
                 "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
                 "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()

with tempfile.TemporaryDirectory() as tmp:
    glyph_png = os.path.join(tmp, "og-glyph.png")
    subprocess.run(["rsvg-convert", "-w", "150", "-h", "150", os.path.join(ROOT, SVG), "-o", glyph_png], check=True)
    glyph = Image.open(glyph_png).convert("RGBA")

    for card in CARDS:
        c = {**PALETTE, **card}
        W, H = 1200, 630
        im = Image.new("RGB", (W, H), c["bg"])
        d = ImageDraw.Draw(im)
        # a faint grid, the same lattice the site draws behind its panels
        for x in range(0, W, 40):
            d.line([(x, 0), (x, H)], fill=c["panel"], width=1)
        for y in range(0, H, 40):
            d.line([(0, y), (W, y)], fill=c["panel"], width=1)
        d.rectangle([56, 56, W - 56, H - 56], outline=c["accent"], width=2)

        im.paste(glyph, (110, 150), glyph)

        d.text((110, 340), c["title"], font=font(84, True), fill=c["ink"])
        tw = d.textlength(c["title"], font=font(84, True))
        d.text((110 + tw + 16, 372), c["sub"], font=font(40), fill=c["accent"])
        for i, line in enumerate(c["lines"]):
            d.text((112, 442 + i * 40), line, font=font(26), fill=c["dim"] if i else c["ink"])
        d.text((112, H - 88), "ojee.net", font=font(22), fill=c["accent"])
        im.save(os.path.join(ROOT, c["out"]))
        print("wrote", c["out"])
