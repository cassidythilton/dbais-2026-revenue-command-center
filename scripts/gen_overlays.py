#!/usr/bin/env python3
"""Generate title cards + lower-third label overlays for the DAIS mashup."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), "overlays")
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080
FB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FBK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

RED = (255, 54, 33)          # Databricks lava
RED_L = (255, 110, 92)       # lighter red for small text
BLUE = (53, 167, 255)        # Domo blue accent
WHITE = (255, 255, 255)
SUB = (201, 211, 224)
MUTE = (140, 152, 170)

def font(path, size):
    return ImageFont.truetype(path, size)

def text_w(draw, s, f, tracking=0):
    if tracking == 0:
        return draw.textlength(s, font=f)
    return sum(draw.textlength(c, font=f) + tracking for c in s) - tracking

def draw_tracked(draw, xy, s, f, fill, tracking=0, anchor_center=False, total_w=None):
    x, y = xy
    if anchor_center and total_w is not None:
        x = x - total_w / 2
    for c in s:
        draw.text((x, y), c, font=f, fill=fill)
        x += draw.textlength(c, font=f) + tracking

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

# ---------------- gradient background for cards ----------------
def card_bg():
    img = Image.new("RGB", (W, H), (5, 7, 13))
    top = (11, 18, 32)
    bot = (4, 6, 11)
    for y in range(H):
        t = y / H
        r = int(top[0] + (bot[0]-top[0])*t)
        g = int(top[1] + (bot[1]-top[1])*t)
        b = int(top[2] + (bot[2]-top[2])*t)
        for_row = (r, g, b)
        ImageDraw.Draw(img).line([(0, y), (W, y)], fill=for_row)
    # faint red glow top-left
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-350, -450, 750, 500], fill=(255, 54, 33, 45))
    glow = glow.filter(ImageFilter.GaussianBlur(180))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    # faint blue glow bottom-right
    glow2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd2 = ImageDraw.Draw(glow2)
    gd2.ellipse([W-700, H-500, W+350, H+450], fill=(53, 167, 255, 38))
    glow2 = glow2.filter(ImageFilter.GaussianBlur(190))
    img = Image.alpha_composite(img, glow2)
    return img.convert("RGB")

def fit_font(draw, s, path, start, max_w):
    size = start
    while size > 20:
        f = font(path, size)
        if draw.textlength(s, font=f) <= max_w:
            return f
        size -= 2
    return font(path, size)

# ---------------- INTRO ----------------
def make_intro():
    img = card_bg().convert("RGBA")
    d = ImageDraw.Draw(img)
    cx = W//2
    # eyebrow
    fe = font(FB, 30)
    eb = "PATTERN 4   ·   PREDICTIVE REVENUE OPERATIONS"
    tw = text_w(d, eb, fe, tracking=8)
    draw_tracked(d, (cx, 300), eb, fe, RED_L, tracking=8, anchor_center=True, total_w=tw)
    # title (two lines, Arial Black)
    t1 = "REVENUE"
    t2 = "COMMAND CENTER"
    f1 = fit_font(d, t2, FBK, 128, 1500)
    b1 = d.textbbox((0,0), t1, font=f1); w1 = b1[2]-b1[0]
    b2 = d.textbbox((0,0), t2, font=f1); w2 = b2[2]-b2[0]
    d.text((cx - w1/2, 360), t1, font=f1, fill=WHITE)
    d.text((cx - w2/2, 360 + (b1[3]-b1[1]) + 26), t2, font=f1, fill=WHITE)
    # accent divider
    yline = 360 + 2*(b1[3]-b1[1]) + 90
    d.rectangle([cx-70, yline, cx+70, yline+5], fill=RED)
    # subtitle
    fs = font(FR, 40)
    st = "Built with Databricks      Delivered with Domo"
    # draw with a middle dot separator manually for control
    left = "Built with Databricks"
    right = "Delivered with Domo"
    gap = 70
    wl = d.textlength(left, font=fs)
    wr = d.textlength(right, font=fs)
    total = wl + gap + wr
    sx = cx - total/2
    sy = yline + 40
    d.text((sx, sy), left, font=fs, fill=SUB)
    # dot
    dot_x = sx + wl + gap/2
    d.ellipse([dot_x-4, sy+24, dot_x+4, sy+32], fill=RED)
    d.text((sx + wl + gap, sy), right, font=fs, fill=SUB)
    img.convert("RGB").save(os.path.join(OUT, "intro.png"))

# ---------------- OUTRO ----------------
def make_outro():
    img = card_bg().convert("RGBA")
    d = ImageDraw.Draw(img)
    cx = W//2
    fe = font(FB, 28)
    eb = "ONE IDENTITY   ·   ONE GOVERNED METRIC LAYER"
    tw = text_w(d, eb, fe, tracking=7)
    draw_tracked(d, (cx, 322), eb, fe, RED_L, tracking=7, anchor_center=True, total_w=tw)
    # title
    t = "ONE GOVERNED FOUNDATION"
    ft = fit_font(d, t, FBK, 104, 1560)
    bt = d.textbbox((0,0), t, font=ft); wt = bt[2]-bt[0]
    d.text((cx - wt/2, 372), t, font=ft, fill=WHITE)
    ybot = 372 + (bt[3]-bt[1]) + 60
    # divider
    d.rectangle([cx-70, ybot, cx+70, ybot+5], fill=RED)
    # steps subtitle
    fs = font(FR, 34)
    steps = "Predict   ·   Explain   ·   Score   ·   Reason   ·   Act   ·   Record"
    ws = d.textlength(steps, font=fs)
    d.text((cx - ws/2, ybot+34), steps, font=fs, fill=SUB)
    # brand lockup
    fbrand = font(FBK, 54)
    bl = "DATABRICKS"
    br = "DOMO"
    plus = "  +  "
    fp = font(FB, 54)
    wl = d.textlength(bl, font=fbrand)
    wp = d.textlength(plus, font=fp)
    wr = d.textlength(br, font=fbrand)
    tot = wl+wp+wr
    bx = cx - tot/2
    by = ybot + 120
    d.text((bx, by), bl, font=fbrand, fill=WHITE)
    d.text((bx+wl, by), plus, font=fp, fill=RED)
    d.text((bx+wl+wp, by), br, font=fbrand, fill=WHITE)
    img.convert("RGB").save(os.path.join(OUT, "outro.png"))

# ---------------- LOWER THIRDS ----------------
LABELS = [
    ("predict", "01  —  PREDICT",   "A forecast headwind in the West",   "Forecast Home  ·  six governed gold views, zero-copy"),
    ("explain", "02  —  EXPLAIN",   "Ask the lakehouse why",             "Genie  ·  governed SQL over the same metrics"),
    ("score",   "03  —  SCORE",     "Churn probability for one account", "MLflow model on Databricks Model Serving"),
    ("agent",   "04  —  AGENT TO AGENT", "Two agents, two platforms",     "Domo agent consults Databricks Agent Bricks"),
    ("approve", "05  —  APPROVE & ACT",  "Human-approved, then executed", "Governed Domo Workflow  ·  written to the lakehouse"),
    ("govern",  "06  —  GOVERN",    "Why the AI is trustworthy",         "Unity Catalog metadata, synced to Domo AI Readiness"),
    ("prove",   "07  —  PROVE IT",  "One governed source of truth",      "Live in Unity Catalog  ·  no copies, no drift"),
]

def make_label(key, kicker, title, sub):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fk = font(FB, 25)
    ft = font(FB, 47)
    fs = font(FR, 28)
    pad_l = 34
    bar_x = 96
    text_x = bar_x + pad_l
    # measure widths
    wk = text_w(d, kicker, fk, tracking=4)
    wt = d.textlength(title, font=ft)
    ws = d.textlength(sub, font=fs)
    content_w = max(wk, wt, ws)
    panel_top = 812
    panel_bot = 992
    panel_right = text_x + content_w + 44
    # soft shadow
    shadow = Image.new("RGBA", (W, H), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([bar_x-6, panel_top-6, panel_right+10, panel_bot+10], radius=18, fill=(0,0,0,150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img)
    # panel
    d.rounded_rectangle([bar_x, panel_top, panel_right, panel_bot], radius=14, fill=(11, 15, 26, 214))
    # accent bar
    d.rounded_rectangle([bar_x, panel_top, bar_x+9, panel_bot], radius=4, fill=RED+(255,))
    # kicker
    draw_tracked(d, (text_x, panel_top+24), kicker, fk, RED_L, tracking=4)
    # title
    d.text((text_x, panel_top+58), title, font=ft, fill=WHITE)
    # subtitle
    d.text((text_x, panel_top+120), sub, font=fs, fill=SUB)
    # persistent brand chip bottom-right
    fbr = font(FB, 26)
    chip = "DATABRICKS  +  DOMO"
    wchip = d.textlength(chip, font=fbr)
    cx2 = W - 70 - wchip
    cy2 = 928
    # small plus in red: draw pieces
    left = "DATABRICKS  "
    plus = "+"
    right = "  DOMO"
    xx = cx2
    d.text((xx, cy2), left, font=fbr, fill=(210,220,232,255)); xx += d.textlength(left, font=fbr)
    d.text((xx, cy2), plus, font=fbr, fill=RED+(255,)); xx += d.textlength(plus, font=fbr)
    d.text((xx, cy2), right, font=fbr, fill=(210,220,232,255))
    img.save(os.path.join(OUT, f"label_{key}.png"))

make_intro()
make_outro()
for key, k, t, s in LABELS:
    make_label(key, k, t, s)
print("overlays written to", OUT)
print(os.listdir(OUT))
