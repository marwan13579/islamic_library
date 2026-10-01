#!/usr/bin/env python3
"""يولّد أيقونات التطبيق (PNG) من هوية «المكتبة الإسلامية».

الأيقونات مطلوبة للتثبيت على الهاتف والكمبيوتر؛ متصفّح لا يقبل التثبيت
بلا أيقونة 192×192 و512×512 (و.maskable للشاشات الدائرية).

الاستخدام:  python3 scripts/build-icons.py
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "icons")

GREEN = (11, 61, 44)
GOLD = (201, 162, 39)
CREAM = (251, 248, 241)

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/noto/NotoKufiArabic-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_icon(
    size: int,
    *,
    maskable: bool = False,
    padding_ratio: float = 0.0,
    bleed: bool = False,
) -> Image.Image:
    """يرسم الأيقونة.

    `bleed` تملأ الإطار كله (للأيقونات القابلة للقص و touche-iOS التي
    يقصّها النظام بنفسه)، و`padding_ratio` يُبعد الرسم عن الحواف.
    """
    scale = size / 512
    image = Image.new("RGBA", (size, size), GREEN + (255,) if bleed else (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    inset = 0 if bleed else int(size * padding_ratio)
    box = (inset, inset, size - inset, size - inset)
    radius = 0 if (maskable or bleed) else int(112 * scale)
    draw.rounded_rectangle(box, radius=radius, fill=GREEN + (255,))

    # ترجمة المحتوى إلى مساحة آمنة للأيقونات القابلة للقص
    inner = size - 2 * inset
    def px(value: float) -> float:
        return inset + value * scale

    stroke = max(2, int(24 * scale))
    # كتاب مفتوح (قوس علوي + خط الوسط)
    draw.arc(
        [px(112), px(176), px(400), px(378)],
        start=180,
        end=360,
        fill=GOLD + (255,),
        width=stroke,
    )
    draw.line([px(256), px(176), px(256), px(378)], fill=GOLD + (255,), width=max(2, int(18 * scale)))
    draw.arc(
        [px(96), px(300), px(256), px(430)],
        start=270,
        end=360,
        fill=GOLD + (255,),
        width=stroke,
    )
    draw.arc(
        [px(256), px(300), px(416), px(430)],
        start=180,
        end=270,
        fill=GOLD + (255,),
        width=stroke,
    )

    font = load_font(int(inner * 0.19))
    label = "مكتبة"
    box_text = draw.textbbox((0, 0), label, font=font)
    draw.text(
        ((size - (box_text[2] - box_text[0])) / 2, inset + inner * 0.12),
        label,
        font=font,
        fill=CREAM + (255,),
    )
    return image


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    targets = [
        ("icon-192.png", 192, False, 0.0, False),
        ("icon-512.png", 512, False, 0.0, False),
        ("icon-maskable-192.png", 192, True, 0.10, True),
        ("icon-maskable-512.png", 512, True, 0.10, True),
        ("apple-touch-icon.png", 180, True, 0.06, True),
        ("favicon-32.png", 32, False, 0.0, False),
        ("favicon-16.png", 16, False, 0.0, False),
    ]
    for name, size, maskable, padding, bleed in targets:
        image = draw_icon(size, maskable=maskable, padding_ratio=padding, bleed=bleed)
        path = os.path.join(OUT, name)
        image.save(path, "PNG", optimize=True)
        print(f"✔ icons/{name} ({size}×{size}{' maskable' if maskable else ''})")

    # favicon.ico في الجذر: المتصفّحات تطلبه افتراضيًا من كل صفحة قديمة
    ico = draw_icon(64, maskable=True, bleed=True)
    ico_path = os.path.join(OUT, "..", "favicon.ico")
    ico.save(ico_path, "ICO", sizes=[(16, 16), (32, 32), (64, 64)])
    print("✔ favicon.ico (16/32/64)")


if __name__ == "__main__":
    main()