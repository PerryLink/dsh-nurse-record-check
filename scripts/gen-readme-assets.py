#!/usr/bin/env python3
"""README visuals for dsh-nurse-record-check, read off the shipped plugin.

Two figures, both derived from this repository rather than a checker template:

  hero 1440x576 (Pillow, zh/en x light/dark, four WebP files)
      Left column: kicker / wordmark / two value lines / one subtitle / one
      meta line / footer.  Right side: the checker's own object -- a nursing
      record sheet for one inpatient episode.  REC-0002 has no recorder, so
      its row is marked and the NR-001 finding card quotes the exact
      `found` / `expected` wording from `src/check.ts` and cites the clause
      the rule pack names (《电子病历应用管理规范（试行）》第十四条).  The two
      risk-assessment forms are missing, which is the NR-009 warning pair in
      `samples/quickstart/expected/result.json`; the skipped drawer names the
      two thresholds that ship empty in `rules/nurse-record.yaml`
      (NR-008 maxAfterAdmission, NR-012 intervalHours).

  flow 1100x660 (hand-written SVG, light/dark)
      Grammar: an INPUT-SURFACE x RULE DEPENDENCY MATRIX with a cap rail and
      a report confluence band.  Four vertical buses (records / orders /
      assessments / episode) carry a dot wherever a rule actually reads that
      collection; the right rail states the evidence-kind ceiling
      (direct <= error, principle <= warn, institutional <= info), the two
      empty thresholds, and the citation base (8 documents, 20 verbatim
      excerpts).  The bottom band is the real report contract: issues with
      rule id, severity, locator, found / expected, basis; skipped with a
      reason; the wording-guard disclaimer.  Every mapping, count, severity
      and clause below is computed from the rule pack in this repository.

      No benchmark data exists in this repository, so no evidence chart.

All labels are measured before they are drawn; a label that would overflow
aborts the run instead of shipping clipped text.

Run once:  python scripts/gen-readme-assets.py
Requires:  Pillow, Windows fonts msyh.ttc / msyhbd.ttc / consola.ttf.
"""
from __future__ import annotations

import os
from html import escape

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")
NAME = "dsh-nurse-record-check"

FONT_FILES = {
    "cjk": r"C:\Windows\Fonts\msyh.ttc",
    "cjk_bold": r"C:\Windows\Fonts\msyhbd.ttc",
    "mono": r"C:\Windows\Fonts\consola.ttf",
    "mono_bold": r"C:\Windows\Fonts\consolab.ttf",
}
for _kind, _path in FONT_FILES.items():
    if not os.path.exists(_path):
        raise SystemExit(f"FATAL: font missing: {_path}")
os.makedirs(OUT, exist_ok=True)

RADIUS = 20
SHADOW = 24

# ---------------------------------------------------------------------------
# palette: family accent + GitHub-page backgrounds
# ---------------------------------------------------------------------------
SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        card="#ffffff", edge="#e6e2ef",
        text="#141419", sub="#4d5261", faint="#8f94a4",
        accent="#4B67B4", pill="#ece7f9", band="#f5f2fb",
        grid="#e7e4f0", margin="#d9a3a3", hole="#f3eef9",
        error="#B42318", error_bg="#fdecea",
        warn="#B45309", warn_bg="#fdf3e9",
        ok="#15803d", ok_bg="#eaf6ee",
        shadow=(38, 30, 72), glow=32,
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        card="#1b2231", edge="#2e374b",
        text="#f0f3f9", sub="#a8b1c4", faint="#737b8d",
        accent="#8496f5", pill="#242d42", band="#202839",
        grid="#262f42", margin="#7a4a4a", hole="#131a2a",
        error="#F97066", error_bg="#2a1616",
        warn="#D9A441", warn_bg="#2a2216",
        ok="#3fb950", ok_bg="#16281c",
        shadow=(0, 0, 0), glow=46,
    ),
}


def font(size: int, kind: str = "cjk") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_FILES[kind], size)


def hx(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))


def gradient(w: int, h: int, top: str, bottom: str) -> Image.Image:
    base = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(base)
    a, b = hx(top), hx(bottom)
    for y in range(h):
        t = 0.12 * (y / h) + 0.88 * (y / h) ** 1.3
        draw.line([(0, y), (w, y)],
                  fill=tuple(int(p + (q - p) * t) for p, q in zip(a, b)))
    return base


def glow(img: Image.Image, cx: int, cy: int, r: int, color: str,
         alpha: int) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rgb = hx(color)
    for i in range(10, 0, -1):
        rr = r * i / 10
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr],
                  fill=rgb + (int(alpha * (1 - i / 11)),))
    return Image.alpha_composite(img.convert("RGBA"),
                                 layer.filter(ImageFilter.GaussianBlur(26))
                                 ).convert("RGB")


def card(img: Image.Image, box: tuple[int, int, int, int], s: dict,
         radius: int = RADIUS, shadow: int = SHADOW,
         fill: str | None = None, edge: str | None = None) -> Image.Image:
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for i in range(shadow, 0, -2):
        sd.rounded_rectangle(
            [x0 - i // 8, y0 + i // 2, x1 + i // 8, y1 + i],
            radius=radius + i // 8,
            fill=s["shadow"] + (int(9 * (1 - i / shadow)),),
        )
    base = Image.alpha_composite(img.convert("RGBA"),
                                 sh.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle(box, radius=radius, fill=hx(fill or s["card"]),
                        outline=hx(edge or s["edge"]), width=2)
    return base.convert("RGB")


_MEASURE = ImageDraw.Draw(Image.new("RGB", (8, 8)))


def measure(text: str, size: int, kind: str) -> float:
    return _MEASURE.textlength(text, font=font(size, kind))


def require_w(text: str, size: int, kind: str, max_w: float, what: str) -> None:
    got = measure(text, size, kind)
    if got > max_w + 0.4:
        raise SystemExit(f"FATAL: {what} overflows: {text!r} needs "
                         f"{got:.1f}px > {max_w:.0f}px")


def fit(text: str, kind: str, max_w: float, start: int, minimum: int) -> int:
    size = start
    while size > minimum:
        if measure(text, size, kind) <= max_w:
            return size
        size -= 1
    raise SystemExit(f"FATAL: text does not fit {max_w}px at >= {minimum}px: "
                     f"{text!r}")


def fit_lines(lines: list[str], kind: str, max_w: float, start: int,
              minimum: int) -> int:
    return min(fit(t, kind, max_w, start, minimum) for t in lines)


def pill(img: Image.Image, xy: tuple[int, int], text: str, s: dict,
         size: int = 15, height: int = 36) -> int:
    d = ImageDraw.Draw(img)
    w = d.textlength(text, font=font(size, "cjk_bold"))
    x, y = xy
    d.rounded_rectangle([x, y, x + w + 34, y + height], radius=height // 2,
                        fill=hx(s["pill"]), outline=hx(s["edge"]), width=1)
    d.text((x + 17, y + height // 2), text, font=font(size, "cjk_bold"),
           fill=hx(s["accent"]), anchor="lm")
    return int(x + w + 34)


def chip_right(img: Image.Image, right: int, y: int, text: str, fg: str,
               bg: str, size: int = 10, height: int = 22,
               kind: str = "cjk_bold") -> int:
    d = ImageDraw.Draw(img)
    w = d.textlength(text, font=font(size, kind)) + 18
    x = right - w
    d.rounded_rectangle([x, y, right, y + height], radius=height // 2,
                        fill=hx(bg))
    d.text((x + 9, y + height // 2), text, font=font(size, kind),
           fill=hx(fg), anchor="lm")
    return int(x)


def dash_round_rect(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int],
                    color: str, radius: int = 10, width: int = 2,
                    dash: int = 7, gap: int = 5) -> None:
    x0, y0, x1, y1 = box
    for x in range(int(x0 + radius), int(x1 - radius), dash + gap):
        end = min(x + dash, x1 - radius)
        d.line([(x, y0), (end, y0)], fill=hx(color), width=width)
        d.line([(x, y1), (end, y1)], fill=hx(color), width=width)
    for y in range(int(y0 + radius), int(y1 - radius), dash + gap):
        end = min(y + dash, y1 - radius)
        d.line([(x0, y), (x0, end)], fill=hx(color), width=width)
        d.line([(x1, y), (x1, end)], fill=hx(color), width=width)
    d.arc([x0, y0, x0 + 2 * radius, y0 + 2 * radius], 180, 270,
          fill=hx(color), width=width)
    d.arc([x1 - 2 * radius, y0, x1, y0 + 2 * radius], 270, 360,
          fill=hx(color), width=width)
    d.arc([x0, y1 - 2 * radius, x0 + 2 * radius, y1], 90, 180,
          fill=hx(color), width=width)
    d.arc([x1 - 2 * radius, y1 - 2 * radius, x1, y1], 0, 90,
          fill=hx(color), width=width)


def check_icon(d: ImageDraw.ImageDraw, x: int, y: int, color: str,
               width: int = 2) -> None:
    d.line([(x, y + 5), (x + 4, y + 9), (x + 11, y)], fill=hx(color),
           width=width, joint="curve")


def cross_icon(d: ImageDraw.ImageDraw, x: int, y: int, color: str,
               width: int = 2) -> None:
    d.line([(x, y), (x + 10, y + 10)], fill=hx(color), width=width)
    d.line([(x + 10, y), (x, y + 10)], fill=hx(color), width=width)


# ---------------------------------------------------------------------------
# Hero copy.  The record sheet is the sample episode used by
# samples/quickstart: two general entries, the second one unsigned, and no
# fall-risk / pressure-ulcer forms.  That run yields 3 issues (1 error,
# 2 warnings) and 10 skipped checks, exactly as quickstart/expected states.
# ---------------------------------------------------------------------------
HERO = {
    "zh": dict(
        kicker="DeepSeek Harness 插件 · 核查器",
        value=["一次住院，十二条规则逐条核对",
               "每条差异都写明所引条款与定位"],
        sub="护理记录 · 医嘱 · 评估表 → 逐条差异清单",
        meta="nurse_record_check · NR-001…NR-012 · issues + skipped",
        foot="Apache-2.0 · 本地纯函数 · 不联网 · 不调用模型",
        sheet_title="护理记录单",
        sheet_sub="内科三病区 · 2026-03-15 · 2 条记录",
        scroll_chip="JSON / YAML",
        headers=["时间", "类型", "记录人", "核对"],
        rows=[
            dict(time="09:00", rid="REC-0001", kind="一般", nurse="N10231",
                 state="pass", tag="可追溯"),
            dict(time="11:00", rid="REC-0002", kind="一般", nurse="—",
                 state="fail", tag="NR-001"),
        ],
        assess_label="评估表",
        assess_chips=["跌倒 / 坠床  未留存", "压力性损伤  未留存"],
        assess_tag="NR-009 · warn ×2",
        find_title="NR-001 · error · REC-0002",
        find_found="记录无签名护士标识",
        find_expected="每条护理记录均应有签名",
        find_basis="《电子病历应用管理规范（试行）》第十四条",
        skip_title_a="skipped 10",
        skip_title_b=" · 不是通过",
        skip_detail="NR-008 maxAfterAdmission 未配置 · NR-012 intervalHours 未配置",
        counts="3 issues — error 1 · warn 2 · info 0",
        bottom_right="结论留给审核人",
    ),
    "en": dict(
        kicker="DeepSeek Harness plugin · checker",
        value=["One inpatient episode, twelve rules",
               "Every difference names its clause"],
        sub="Records, orders, assessments → a difference list",
        meta="nurse_record_check · NR-001…NR-012 · issues + skipped",
        foot="Apache-2.0 · local pure function · no network · no model call",
        sheet_title="Nursing record sheet",
        sheet_sub="Ward 3 · Medical · 2026-03-15 · 2 entries",
        scroll_chip="JSON / YAML",
        headers=["Time", "Kind", "Recorder", "Check"],
        rows=[
            dict(time="09:00", rid="REC-0001", kind="general",
                 nurse="N10231", state="pass", tag="traceable"),
            dict(time="11:00", rid="REC-0002", kind="general", nurse="—",
                 state="fail", tag="NR-001"),
        ],
        assess_label="Assessment forms",
        assess_chips=["fall-risk  not on file", "pressure-ulcer  not on file"],
        assess_tag="NR-009 · warn ×2",
        find_title="NR-001 · error · REC-0002",
        find_found="no signing nurse identifier",
        find_expected="every nursing entry carries a signer",
        find_basis="国卫办医发〔2017〕8号 · 第十四条",
        skip_title_a="skipped 10",
        skip_title_b=" · not a pass",
        skip_detail="NR-008 maxAfterAdmission unset · NR-012 intervalHours unset",
        counts="3 issues — error 1 · warn 2 · info 0",
        bottom_right="the reviewer decides",
    ),
}


def hero(lang: str, skin: str) -> None:
    s = SKIN[skin]
    h = HERO[lang]
    W, H = 1440, 576
    img = gradient(W, H, s["bg_from"], s["bg_to"])
    img = glow(img, 1130, 70, 420, s["accent"], s["glow"])
    img = glow(img, 150, 570, 300, s["accent"], max(8, s["glow"] // 3))
    img = card(img, (740, 40, 1376, 536), s, radius=22, shadow=28)
    d = ImageDraw.Draw(img)

    # ---- left column --------------------------------------------------------
    m = 64
    col_w = 620
    pill(img, (m, 70), h["kicker"], s, size=15, height=36)
    d = ImageDraw.Draw(img)

    title_size = fit(NAME, "mono_bold", col_w, 54, 48)
    require_w(NAME, title_size, "mono_bold", col_w, "hero title")
    d.text((m, 168), NAME, font=font(title_size, "mono_bold"),
           fill=hx(s["text"]), anchor="ls")

    value_size = fit_lines(h["value"], "cjk_bold", col_w, 34, 28)
    for i, line in enumerate(h["value"]):
        require_w(line, value_size, "cjk_bold", col_w, "hero value line")
        d.text((m, 250 + i * 50), line, font=font(value_size, "cjk_bold"),
               fill=hx(s["text"]), anchor="ls")

    require_w(h["sub"], 20, "cjk", col_w, "hero subtitle")
    d.text((m, 354), h["sub"], font=font(20, "cjk"), fill=hx(s["sub"]),
           anchor="ls")

    require_w(h["meta"], 16, "cjk", col_w, "hero meta")
    d.text((m, 402), h["meta"], font=font(16, "cjk"), fill=hx(s["faint"]),
           anchor="ls")

    d.line([m, 436, m + col_w - 4, 436], fill=hx(s["grid"]), width=2)
    require_w(h["foot"], 14, "cjk", col_w, "hero footer")
    d.text((m, 468), h["foot"], font=font(14, "cjk"), fill=hx(s["faint"]),
           anchor="ls")

    # ---- right: the nursing record sheet -----------------------------------
    # paper margin: a thin red rule and three binder holes, so the right side
    # reads as a chart page rather than another dashboard card.
    d.line([(772, 58), (772, 518)], fill=hx(s["margin"]), width=2)
    for hy in (92, 288, 484):
        d.ellipse([766, hy - 6, 778, hy + 6], fill=hx(s["hole"]),
                  outline=hx(s["edge"]), width=1)

    d.text((792, 84), h["sheet_title"], font=font(20, "cjk_bold"),
           fill=hx(s["text"]), anchor="ls")
    chip_right(img, 1356, 58, h["scroll_chip"], s["accent"], s["pill"],
               size=10, height=22, kind="mono_bold")
    d = ImageDraw.Draw(img)
    require_w(h["sheet_sub"], 12, "cjk", 520, "sheet subtitle")
    d.text((792, 106), h["sheet_sub"], font=font(12, "cjk"),
           fill=hx(s["sub"]), anchor="ls")
    d.line([792, 120, 1356, 120], fill=hx(s["grid"]), width=1)

    d.rounded_rectangle([792, 128, 1356, 150], radius=7, fill=hx(s["band"]))
    cols = [800, 918, 1032, 1164]
    for i, head in enumerate(h["headers"]):
        require_w(head, 11, "cjk_bold", (cols[i + 1] - cols[i] - 10)
                  if i < 3 else 180, "sheet header")
        d.text((cols[i], 144), head, font=font(11, "cjk_bold"),
               fill=hx(s["sub"]), anchor="ls")

    row_h = 42
    for r, row in enumerate(h["rows"]):
        top = 158 + r * row_h
        baseline = top + 24
        if row["state"] == "fail":
            d.rounded_rectangle([792, top + 2, 1356, top + row_h - 2],
                                radius=8, fill=hx(s["error_bg"]))
        d.text((cols[0], baseline + 2), row["time"],
               font=font(15, "mono_bold"), fill=hx(s["text"]), anchor="ls")
        d.text((cols[0], baseline + 16), row["rid"], font=font(10, "mono"),
               fill=hx(s["faint"] if row["state"] == "pass" else s["error"]),
               anchor="ls")
        require_w(row["kind"], 14, "cjk", 104, "sheet kind")
        d.text((cols[1], baseline + 2), row["kind"], font=font(14, "cjk"),
               fill=hx(s["text"]), anchor="ls")
        require_w(row["nurse"], 14, "mono", 120, "sheet nurse")
        d.text((cols[2], baseline + 2), row["nurse"], font=font(14, "mono"),
               fill=hx(s["text"] if row["state"] == "pass" else s["error"]),
               anchor="ls")
        if row["state"] == "pass":
            check_icon(d, cols[3], baseline - 4, s["ok"])
            d.text((cols[3] + 18, baseline + 2), row["tag"],
                   font=font(11, "cjk"), fill=hx(s["ok"]), anchor="ls")
        else:
            cross_icon(d, cols[3], baseline - 5, s["error"])
            d.text((cols[3] + 18, baseline + 2), row["tag"],
                   font=font(11, "mono_bold"), fill=hx(s["error"]),
                   anchor="ls")
        if r < len(h["rows"]) - 1:
            d.line([792, top + row_h, 1356, top + row_h],
                   fill=hx(s["grid"]), width=1)

    # ---- assessments --------------------------------------------------------
    require_w(h["assess_label"], 11, "cjk_bold", 120, "assessment label")
    d.text((800, 274), h["assess_label"], font=font(11, "cjk_bold"),
           fill=hx(s["faint"]), anchor="ls")
    require_w(h["assess_tag"], 10, "cjk_bold", 200, "assessment tag")
    d.text((1356, 274), h["assess_tag"], font=font(10, "cjk_bold"),
           fill=hx(s["warn"]), anchor="rs")
    chip_boxes = [(800, 282, 1042, 310), (1052, 282, 1330, 310)]
    for i, label in enumerate(h["assess_chips"]):
        box = chip_boxes[i]
        d.rounded_rectangle(box, radius=14, fill=hx(s["warn_bg"]))
        dash_round_rect(d, box, s["warn"], radius=14, width=1, dash=6, gap=4)
        require_w(label, 11, "cjk", box[2] - box[0] - 24, "assessment chip")
        d.text((box[0] + 13, 300), label, font=font(11, "cjk"),
               fill=hx(s["warn"]), anchor="ls")

    # ---- finding card -------------------------------------------------------
    d.rounded_rectangle([792, 322, 1356, 424], radius=14, fill=hx(s["band"]),
                        outline=hx(s["edge"]), width=1)
    d.rounded_rectangle([800, 332, 804, 414], radius=2, fill=hx(s["error"]))
    require_w(h["find_title"], 12, "mono_bold", 520, "finding title")
    d.text((812, 344), h["find_title"], font=font(12, "mono_bold"),
           fill=hx(s["error"]), anchor="ls")
    labels = [("found", h["find_found"], 12, s["text"]),
              ("expected", h["find_expected"], 12, s["sub"]),
              ("basis", h["find_basis"], 10, s["faint"])]
    for i, (tag, value, size, color) in enumerate(labels):
        require_w(value, size, "cjk", 480, f"finding {tag}")
        d.text((812, 365 + i * 19), tag, font=font(10, "mono"),
               fill=hx(s["faint"]), anchor="ls")
        d.text((866, 365 + i * 19), value, font=font(size, "cjk"),
               fill=hx(color), anchor="ls")

    # ---- skipped drawer -----------------------------------------------------
    d.rounded_rectangle([792, 438, 1356, 496], radius=12, fill=hx(s["band"]))
    dash_round_rect(d, (792, 438, 1356, 496), s["faint"], radius=12,
                    width=1, dash=7, gap=5)
    d.text((812, 458), h["skip_title_a"], font=font(11, "mono_bold"),
           fill=hx(s["faint"]), anchor="ls")
    part_a = measure(h["skip_title_a"], 11, "mono_bold")
    require_w(h["skip_title_b"], 11, "cjk_bold", 240, "skip title")
    d.text((812 + part_a, 458), h["skip_title_b"],
           font=font(11, "cjk_bold"), fill=hx(s["warn"]), anchor="ls")
    require_w(h["skip_detail"], 11, "cjk", 530, "skip detail")
    d.text((812, 478), h["skip_detail"], font=font(11, "cjk"),
           fill=hx(s["sub"]), anchor="ls")

    # ---- sheet footer -------------------------------------------------------
    require_w(h["counts"], 11, "mono", 360, "hero counts")
    d.text((800, 518), h["counts"], font=font(11, "mono"),
           fill=hx(s["faint"]), anchor="ls")
    require_w(h["bottom_right"], 11, "cjk", 180, "hero bottom right")
    d.text((1356, 518), h["bottom_right"], font=font(11, "cjk"),
           fill=hx(s["faint"]), anchor="rs")

    path = os.path.join(OUT, f"{NAME}-hero-{lang}-{skin}.webp")
    img.save(path, "WEBP", quality=90, method=6)
    print(f"wrote {os.path.basename(path)} (1440x576)")


# ---------------------------------------------------------------------------
# Flow: input-surface x rule dependency matrix
# ---------------------------------------------------------------------------
FLOW_SKIN = {
    "light": dict(
        bg_from="#f9f6fd", bg_to="#e4eaf8",
        panel="#ffffff", card="#ffffff", edge="#e6e2ef",
        band="#f5f2fb", pill="#ece7f9", text="#141419", sub="#4d5261",
        faint="#8f94a4", accent="#4B67B4",
        error="#B42318", error_bg="#fdecea",
        warn="#B45309", warn_bg="#fdf3e9",
        info="#4B67B4", info_bg="#eceff9",
        ok="#15803d", ok_bg="#eaf6ee",
        rule="#e7e4f0", shadow="#2b2440", shadow_op="0.13",
        dot="#cfc8e2", dot_op="0.5",
        surface={"records": "#4B67B4", "orders": "#7B5FB0",
                 "assess": "#2C8377", "episode": "#A9742C"},
        surface_bg={"records": "#eef1fa", "orders": "#f2eef9",
                    "assess": "#eaf5f2", "episode": "#faf2e7"},
    ),
    "dark": dict(
        bg_from="#131a2a", bg_to="#0c1016",
        panel="#1b2231", card="#1b2231", edge="#2e374b",
        band="#202839", pill="#242d42", text="#f0f3f9", sub="#a8b1c4",
        faint="#737b8d", accent="#8496f5",
        error="#F97066", error_bg="#2a1616",
        warn="#D9A441", warn_bg="#2a2216",
        info="#8496f5", info_bg="#1e2740",
        ok="#3fb950", ok_bg="#16281c",
        rule="#2b3348", shadow="#000000", shadow_op="0.5",
        dot="#2a3346", dot_op="0.5",
        surface={"records": "#8496f5", "orders": "#B9A6FF",
                 "assess": "#6FC9BB", "episode": "#E0B072"},
        surface_bg={"records": "#1e2740", "orders": "#251f3a",
                    "assess": "#172b28", "episode": "#2a2116"},
    ),
}

FONT_CSS_SANS = ("'Microsoft YaHei','Segoe UI','PingFang SC',"
                 "'Noto Sans CJK SC',sans-serif")
FONT_CSS_MONO = ("Consolas,'Microsoft YaHei',ui-monospace,monospace")

# id, short check, the collections the function actually reads, evidence kind,
# declared severity, number of verbatim citations (basis + alsoBasis).
RULES = [
    ("NR-001", "signature", ("records",), "direct", "error", 2),
    ("NR-002", "timestamps", ("records", "orders", "assess"), "direct",
     "error", 1),
    ("NR-003", "minute-precise", ("records",), "direct", "error", 2),
    ("NR-004", "rescue 6h", ("records",), "direct", "error", 2),
    ("NR-005", "order sign-off", ("orders",), "direct", "error", 2),
    ("NR-006", "order sequence", ("orders",), "principle", "info", 1),
    ("NR-007", "cancellation", ("orders",), "direct", "error", 1),
    ("NR-008", "admission form", ("episode", "assess"), "institutional",
     "info", 1),
    ("NR-009", "risk forms", ("assess",), "direct", "warn", 2),
    ("NR-010", "record order", ("records", "orders"), "principle", "info", 2),
    ("NR-011", "rounds gap", ("episode", "records"), "direct", "error", 3),
    ("NR-012", "doc frequency", ("episode", "records"), "institutional",
     "info", 1),
]

EVIDENCE_LABEL = {
    "direct": "direct",
    "principle": "principle",
    "institutional": "local config",
}

EVIDENCE_COLOR = {
    "light": {"direct": "#4B67B4", "principle": "#B45309",
              "institutional": "#2C8377"},
    "dark": {"direct": "#8496f5", "principle": "#D9A441",
             "institutional": "#6FC9BB"},
}

CAP = {"direct": ("direct clause", "error", 8),
       "principle": ("derived principle", "warn", 2),
       "institutional": ("institutional config", "info", 2)}

SURFACES = [
    ("records", "records"),
    ("orders", "orders"),
    ("assess", "assess"),
    ("episode", "episode"),
]


class Svg:
    """Small SVG writer that measures every label before it is emitted."""

    def __init__(self) -> None:
        self.parts: list[str] = []
        self.overflows: list[str] = []

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def _w(self, content: str, size: float, kind: str,
           tracking: float | None = None) -> float:
        path = FONT_FILES[kind]
        if not content.isascii():
            path = FONT_FILES["cjk_bold" if "bold" in kind else "cjk"]
        got = _MEASURE.textlength(content, font=ImageFont.truetype(path, size))
        if tracking:
            got += tracking * max(len(content) - 1, 0)
        return got

    def text(self, x: float, y: float, content: str, size: float, fill: str, *,
             anchor: str = "start", weight: int | None = None,
             mono: bool = False, max_w: float | None = None,
             opacity: float | None = None, tracking: float | None = None) -> None:
        kind = ("mono" if mono else "cjk") + ("_bold" if weight else "")
        if mono and weight:
            kind = "mono_bold"
        if max_w is not None:
            got = self._w(content, size, kind, tracking)
            if got > max_w + 0.4:
                self.overflows.append(f"{content!r} needs {got:.1f}px > "
                                      f"{max_w:.0f}px")
        family = FONT_CSS_MONO if mono else FONT_CSS_SANS
        attrs = [f'x="{x}"', f'y="{y}"', f'fill="{fill}"',
                 f'font-family="{family}"', f'font-size="{size}"']
        if anchor != "start":
            attrs.append(f'text-anchor="{anchor}"')
        if weight:
            attrs.append(f'font-weight="{weight}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if tracking:
            attrs.append(f'letter-spacing="{tracking}"')
        self.add(f'<text {" ".join(attrs)}>{escape(content)}</text>')

    def rect(self, x: float, y: float, w: float, h: float, *, fill: str,
             rx: float = 0, stroke: str | None = None, sw: float = 1.5,
             shadow: bool = False, dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'x="{x}"', f'y="{y}"', f'width="{w}"', f'height="{h}"']
        if rx:
            attrs.append(f'rx="{rx}"')
        attrs.append(f'fill="{fill}"')
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            attrs.append(f'stroke-width="{sw}"')
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        if shadow:
            attrs.append('filter="url(#soft)"')
        self.add(f'<rect {" ".join(attrs)}/>')

    def line(self, x1: float, y1: float, x2: float, y2: float, *, stroke: str,
             sw: float = 1.5, dash: str | None = None,
             marker: str | None = None, opacity: float | None = None) -> None:
        attrs = [f'x1="{x1}"', f'y1="{y1}"', f'x2="{x2}"', f'y2="{y2}"',
                 f'stroke="{stroke}"', f'stroke-width="{sw}"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append(f'marker-end="url(#{marker})"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<line {" ".join(attrs)}/>')

    def path(self, d: str, *, stroke: str, sw: float = 1.5,
             marker: str | None = None, dash: str | None = None,
             opacity: float | None = None) -> None:
        attrs = [f'd="{d}"', 'fill="none"', f'stroke="{stroke}"',
                 f'stroke-width="{sw}"', 'stroke-linejoin="round"']
        if dash:
            attrs.append(f'stroke-dasharray="{dash}"')
        if marker:
            attrs.append(f'marker-end="url(#{marker})"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<path {" ".join(attrs)}/>')

    def circle(self, cx: float, cy: float, r: float, *, fill: str,
               stroke: str | None = None, sw: float = 1.5,
               opacity: float | None = None) -> None:
        attrs = [f'cx="{cx}"', f'cy="{cy}"', f'r="{r}"', f'fill="{fill}"']
        if stroke:
            attrs.append(f'stroke="{stroke}"')
            attrs.append(f'stroke-width="{sw}"')
        if opacity is not None:
            attrs.append(f'opacity="{opacity}"')
        self.add(f'<circle {" ".join(attrs)}/>')

    def chip_right(self, right: float, y: float, label: str, fg: str, bg: str,
                   *, size: float = 11, pad: float = 9, height: float = 22,
                   mono: bool = False, weight: int | None = None,
                   stroke: str | None = None, dash: str | None = None) -> float:
        kind = "mono" if mono else "cjk"
        if weight:
            kind += "_bold"
        w = self._w(label, size, kind) + pad * 2
        x = right - w
        self.rect(x, y, w, height, fill=bg, rx=height / 2, stroke=stroke,
                  sw=1.2, dash=dash)
        self.text(x + pad, y + height / 2 + size * 0.34, label, size, fg,
                  weight=weight, mono=mono)
        return x

    def svg(self, w: int, h: int, title: str, desc: str) -> str:
        head = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" '
                f'height="{h}" viewBox="0 0 {w} {h}" role="img" '
                f'aria-labelledby="title desc">')
        return "\n".join([head, f'<title id="title">{escape(title)}</title>',
                          f'<desc id="desc">{escape(desc)}</desc>',
                          *self.parts, "</svg>"]) + "\n"


def flow_svg(skin: str) -> str:
    s = FLOW_SKIN[skin]
    W, H = 1100, 660
    v = Svg()

    v.add("<defs>")
    v.add(f'<linearGradient id="bg" x1="0" y1="0" x2="0.18" y2="1">'
          f'<stop offset="0" stop-color="{s["bg_from"]}"/>'
          f'<stop offset="1" stop-color="{s["bg_to"]}"/></linearGradient>')
    v.add(f'<radialGradient id="halo" cx="0.78" cy="0.08" r="0.72">'
          f'<stop offset="0" stop-color="{s["accent"]}" stop-opacity="0.12"/>'
          f'<stop offset="1" stop-color="{s["accent"]}" stop-opacity="0"/>'
          f'</radialGradient>')
    v.add(f'<filter id="soft" x="-30%" y="-30%" width="160%" height="180%">'
          f'<feDropShadow dx="0" dy="8" stdDeviation="10" '
          f'flood-color="{s["shadow"]}" '
          f'flood-opacity="{s["shadow_op"]}"/></filter>')
    v.add(f'<pattern id="dots" width="24" height="24" '
          f'patternUnits="userSpaceOnUse">'
          f'<circle cx="1.2" cy="1.2" r="1.2" fill="{s["dot"]}"/></pattern>')
    v.add("</defs>")

    v.rect(0, 0, W, H, fill="url(#bg)")
    v.rect(0, 0, W, H, fill="url(#dots)", opacity=s["dot_op"])
    v.rect(0, 0, W, H, fill="url(#halo)")

    # ---- header -------------------------------------------------------------
    v.text(44, 52, f"{NAME} · structure", 12, s["faint"], mono=True,
           max_w=320)
    v.text(44, 88, "Twelve rules, four input surfaces", 26, s["text"],
           weight=700, max_w=720)
    v.text(44, 114,
           "Each rule reads only what it declares; the evidence kind caps "
           "severity; unrunnable checks are named.", 13, s["sub"], max_w=780)
    v.chip_right(1056, 26, "rules/nurse-record.yaml · v2026.1", s["accent"],
                 s["pill"], size=11, pad=12, height=26, mono=True)
    v.text(44, 138,
           "IN · records[] · orders[] · assessments[] · episode · JSON / YAML",
           11, s["faint"], mono=True, max_w=620)
    v.text(1056, 138, "OUT · issues[] + skipped[] + disclaimer", 11,
           s["faint"], mono=True, anchor="end", max_w=320)
    v.line(44, 150, 1056, 150, stroke=s["rule"], sw=1)

    # ---- left panel: the matrix --------------------------------------------
    v.rect(44, 164, 746, 402, fill=s["panel"], rx=18, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(62, 184, "12 RULES · WHAT EACH ONE READS", 11, s["faint"],
           weight=700, mono=True, tracking=1.0, max_w=500)
    v.text(62, 198, "● = the rule reads this collection", 11, s["faint"],
           max_w=280)

    # columns
    centers = {"records": 266, "orders": 332, "assess": 398, "episode": 464}
    col_x = {"rule": 62, "what": 126, "evidence": 518, "severity": 644,
             "cites": 738}
    v.text(col_x["rule"], 227, "rule", 11, s["sub"], weight=700, mono=True,
           max_w=54)
    v.text(col_x["what"], 227, "what", 11, s["sub"], weight=700, mono=True,
           max_w=104)
    for key, label in SURFACES:
        cx = centers[key]
        v.rect(cx - 32, 208, 64, 30, fill=s["surface_bg"][key], rx=9,
               stroke=s["surface"][key], sw=1, opacity=0.95)
        v.text(cx, 227, label, 11, s["surface"][key], weight=700, mono=True,
               anchor="middle", max_w=58)
    v.text(col_x["evidence"], 227, "evidence", 11, s["sub"], weight=700,
           mono=True, max_w=104)
    v.text(col_x["severity"], 227, "severity", 11, s["sub"], weight=700,
           mono=True, max_w=66)
    v.text(col_x["cites"], 227, "cites", 11, s["sub"], weight=700, mono=True,
           max_w=38)

    # vertical buses
    for key, _label in SURFACES:
        cx = centers[key]
        v.line(cx, 238, cx, 558, stroke=s["surface"][key], sw=1.4,
               opacity=0.22)

    first_cy = 254
    step = 26.6
    for i, (rid, title, sectors, kind, severity, cites) in enumerate(RULES):
        cy = first_cy + i * step
        if i % 2 == 1:
            v.rect(56, cy - 13.3, 722, 26.6, fill=s["band"], rx=6,
                   opacity=0.55)
        if i < len(RULES) - 1:
            v.line(62, cy + 13.3, 776, cy + 13.3, stroke=s["rule"], sw=0.8)
        v.text(col_x["rule"], cy + 4.5, rid, 13, s["text"], weight=700,
               mono=True, max_w=58)
        v.text(col_x["what"], cy + 4.5, title, 13, s["text"], weight=700,
               max_w=108)
        for key, _label in SURFACES:
            if key in sectors:
                v.circle(centers[key], cy, 4.6, fill=s["surface"][key],
                         stroke=s["panel"], sw=2.4)

        kind_color = EVIDENCE_COLOR[skin][kind]
        v.rect(518, cy - 10, 94, 20, fill=s["band"], rx=10,
               stroke=s["edge"], sw=1.1)
        v.circle(527, cy, 2.6, fill=kind_color)
        v.text(534, cy + 3.8, EVIDENCE_LABEL[kind], 11, kind_color,
               weight=700, mono=True, max_w=76)

        sev_color = {"error": s["error"], "warn": s["warn"],
                     "info": s["info"]}[severity]
        sev_bg = {"error": s["error_bg"], "warn": s["warn_bg"],
                  "info": s["info_bg"]}[severity]
        v.rect(644, cy - 10, 68, 20, fill=sev_bg, rx=10)
        v.circle(653, cy, 3.1, fill=sev_color)
        v.text(661, cy + 3.8, severity, 11, sev_color, weight=700, mono=True,
               max_w=48)

        v.text(col_x["cites"], cy + 4.5, str(cites), 11, s["sub"],
               weight=700, mono=True, max_w=34)

    # ---- right rail: caps, empty thresholds, citations ----------------------
    v.rect(816, 164, 240, 402, fill=s["panel"], rx=18, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.text(834, 188, "EVIDENCE → SEVERITY CAP", 11, s["faint"], weight=700,
           mono=True, tracking=0.9, max_w=204)

    cap_y = [202, 250, 298]
    for i, (kind, (label, cap, count)) in enumerate(CAP.items()):
        y = cap_y[i]
        cap_color = {"error": s["error"], "warn": s["warn"],
                     "info": s["info"]}[cap]
        cap_bg = {"error": s["error_bg"], "warn": s["warn_bg"],
                  "info": s["info_bg"]}[cap]
        v.rect(828, y, 212, 42, fill=cap_bg, rx=12, opacity=0.72)
        v.rect(832, y + 6, 3, 30, fill=cap_color, rx=1.5)
        v.text(842, y + 18, label, 11.5, s["text"], weight=700, max_w=140)
        v.text(1026, y + 18, f"{count} rules", 11, s["faint"], mono=True,
               anchor="end", max_w=52)
        v.text(842, y + 34, f"≤ {cap}", 11, cap_color, weight=700,
               mono=True, max_w=90)

    v.rect(828, 358, 212, 110, fill=s["band"], rx=12, stroke=s["edge"],
           sw=1, dash="4 4")
    v.text(842, 378, "EMPTY THRESHOLDS", 11, s["faint"], weight=700,
           mono=True, tracking=0.8, max_w=190)
    v.text(842, 398, "NR-008", 11, s["text"], weight=700, mono=True,
           max_w=44)
    v.text(894, 398, "maxAfterAdmission", 11, s["sub"], mono=True,
           max_w=108)
    v.text(894, 412, "unset", 11, s["warn"], mono=True, max_w=40)
    v.text(842, 434, "NR-012", 11, s["text"], weight=700, mono=True,
           max_w=44)
    v.text(894, 434, "intervalHours", 11, s["sub"], mono=True, max_w=108)
    v.text(894, 448, "unset", 11, s["warn"], mono=True, max_w=40)
    v.text(842, 462, "→ unset = skipped, never a pass", 11, s["warn"],
           max_w=196)

    v.rect(828, 480, 212, 72, fill=s["band"], rx=12)
    v.text(842, 496, "CITATIONS", 11, s["faint"], weight=700, mono=True,
           tracking=0.9, max_w=190)
    v.text(842, 526, "8", 22, s["accent"], weight=700, mono=True, max_w=28)
    v.text(868, 526, "docs", 11, s["faint"], mono=True, max_w=40)
    v.text(930, 526, "20", 22, s["accent"], weight=700, mono=True, max_w=34)
    v.text(962, 526, "verbatim", 11, s["faint"], mono=True, max_w=60)
    v.text(842, 546, "excerpt ≥ 8 chars · verbatim", 11, s["faint"],
           max_w=184)

    # ---- bottom: report contract -------------------------------------------
    v.rect(44, 580, 1012, 48, fill=s["panel"], rx=14, stroke=s["edge"],
           sw=1.5, shadow=True)
    v.line(170, 588, 170, 620, stroke=s["rule"], sw=1)
    v.text(60, 601, "Report", 12, s["accent"], weight=700, mono=True,
           max_w=80)
    v.text(60, 616, "issues + skipped", 11, s["faint"], max_w=106)
    v.text(186, 598, "issues[]  ruleId · severity · locator · found / "
           "expected · basis", 11, s["text"], mono=True, max_w=520)
    v.text(186, 615, "skipped[]  rule + reason · every declared check is "
           "named", 11, s["faint"], mono=True, max_w=520)
    v.text(1040, 598, "sample · 3 issues (1 error / 2 warn) · skipped 10",
           11, s["text"], mono=True, anchor="end", max_w=320)
    v.text(1040, 615, "empty issues != a pass", 11, s["faint"], mono=True,
           anchor="end", max_w=200)

    # ---- footer -------------------------------------------------------------
    v.line(44, 636, 1056, 636, stroke=s["rule"], sw=1)
    v.text(44, 652,
           "check(input, ruleset, options) -> Report · no network · no model "
           "call", 11, s["faint"], mono=True, max_w=600)
    v.text(1056, 652,
           "rulesFile / disabledRules / onlyRules / skipNotes / timeoutMs",
           11, s["faint"], mono=True, anchor="end", max_w=420)

    if v.overflows:
        raise SystemExit("FATAL: SVG label overflow:\n  " +
                         "\n  ".join(v.overflows))
    return v.svg(
        W, H,
        "dsh-nurse-record-check rule / input-surface matrix",
        "Twelve nursing-record checks against the four collections they read "
        "(records, orders, assessments, episode). A dot marks a collection the "
        "rule actually reads. Evidence kind caps severity: direct at error, "
        "principle at warn, institutional at info. NR-008 maxAfterAdmission and "
        "NR-012 intervalHours ship empty, so both are skipped until configured. "
        "The rule pack cites eight documents in twenty verbatim excerpts. The "
        "report lists issues with rule id, severity, locator, found/expected "
        "and basis, skipped checks with a reason, and always carries the "
        "disclaimer.",
    )


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for skin in ("light", "dark"):
        for lang in ("zh", "en"):
            hero(lang, skin)
        name = f"{NAME}-flow-v5-{skin}.svg"
        with open(os.path.join(OUT, name), "w", encoding="utf-8",
                  newline="\n") as fh:
            fh.write(flow_svg(skin))
        print(f"wrote {name} (1100x660)")


if __name__ == "__main__":
    main()
