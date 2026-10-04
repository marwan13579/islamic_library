#!/usr/bin/env python3
"""يبني كتالوج PDF تعريفي بالمكتبة الإسلامية (نور الهدى + بوابة النور + الأدوات).

    python3 -m venv .catalog-venv
    .catalog-venv/bin/pip install -r scripts/requirements-catalog.txt
    .catalog-venv/bin/python scripts/make-catalog.py
"""
import json
import os
import re
import sys
import tempfile
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab import rl_config
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph,
                                Spacer, Table, TableStyle, PageBreak)
import arabic_reshaper
from bidi.algorithm import get_display

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "catalog.pdf")

FONT_DIRS = ("/usr/share/fonts/truetype/noto",
             "/usr/share/fonts/noto",
             os.path.join(ROOT, "vendor", "fonts"))


def register(name, filename):
    for directory in FONT_DIRS:
        path = os.path.join(directory, filename)
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont(name, path))
            return
    raise SystemExit(
        f"الخط المطلوب غير موجود: {filename}\n"
        f"ثبّت خطوط Noto العربية أو ضعها في أحد: {', '.join(FONT_DIRS)}")


register("Naskh", "NotoNaskhArabic-Regular.ttf")
register("NaskhB", "NotoNaskhArabic-Bold.ttf")
register("Sans", "NotoSansArabic-Regular.ttf")

GREEN = colors.HexColor("#0b3d2c")
GREEN_DEEP = colors.HexColor("#14654a")
GOLD = colors.HexColor("#b8912f")
CREAM = colors.HexColor("#F6EFDF")
SAND = colors.HexColor("#EFE6D2")
INK = colors.HexColor("#20261f")
GREY = colors.HexColor("#5c6357")
PAPER = colors.white
TINT = colors.HexColor("#3a4136")
MUTED = colors.HexColor("#4a5145")
CALLOUT_BODY = colors.HexColor("#f2ede0")

MARGIN = 22 * mm
CONTENT_W = A4[0] - 2 * MARGIN


def hx(color):
    """لون HexColor إلى نصّ #rrggbb صالح داخل وسوم ReportLab."""
    return "#" + color.hexval()[2:]


# ── أرقام تُقرأ من شيفرة الموقع نفسها، فلا تتقدّم على المصدر ──

def read_source(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


def array_body(source, marker):
    """نصّ المصفوفة الأولى بعد العلامة، أو نصّ الكائن إن كان مصفوفةً map."""
    start = source.index(marker)
    start = min(pos for pos in (source.find("[", start), source.find("{", start)) if pos != -1)
    open_ch = source[start]
    close_ch = "]" if open_ch == "[" else "}"
    depth = quote = 0
    for pos in range(start, len(source)):
        char = source[pos]
        if quote:
            if char == quote:
                quote = 0
            continue
        if char in "\"'`":
            quote = char
        elif char == open_ch:
            depth += 1
        elif char == close_ch:
            depth -= 1
            if depth == 0:
                return source[start:pos + 1]
    raise ValueError(f"لم تُغلق المجموعة بعد: {marker}")


def count_entries(source, marker):
    """عدد عناصر المصفوفة الأولى في نصّ البيانات."""
    body = array_body(source, marker)[1:-1].rstrip().rstrip(",")
    depth = quote = commas = 0
    for char in body:
        if quote:
            if char == quote:
                quote = 0
            continue
        if char in "\"'`":
            quote = char
        elif char in "[{(":
            depth += 1
        elif char in "]})":
            depth -= 1
        elif char == "," and depth == 0:
            commas += 1
    return commas + 1


SITE_SECTIONS = count_entries(read_source("src", "site", "sections.js"), "export const SECTIONS =")
APP_TABS = count_entries(read_source("src", "app", "app.js"), "const TABS =")
LESSONS_COUNT = (count_entries(read_source("src", "data", "lessons.js"), "export const LESSONS =")
                 + count_entries(read_source("src", "data", "lessons-extra.js"),
                                 "export const EXTRA_LESSONS ="))
APPS_DUAS_COUNT = count_entries(read_source("src", "data", "app-duas.js"), "export const APP_DUAS =")
APP_HADITHS_COUNT = count_entries(read_source("src", "data", "hadiths.js"), "export const HADITHS =")
SCHOLARS_COUNT = count_entries(read_source("src", "data", "scholars.js"), "export const SCHOLARS =")
SAYINGS_COUNT = count_entries(read_source("src", "data", "sayings.js"), "export const SAYINGS =")
NAMES99_COUNT = int(
    read_source("src", "data", "names99.js").split("NAMES99_COUNT = ")[1].split(";")[0])
RADIO_COUNT = count_entries(read_source("src", "data", "radio.js"), "export const RADIO_STATIONS =")
CITY_COUNT = count_entries(read_source("src", "data", "cities.js"), "export const CITY_COORDS =")
RECITER_COUNT = count_entries(read_source("src", "lib", "quran-audio.js"), "export const RECITERS =")
TEST_FILES = [name for name in os.listdir(os.path.join(ROOT, "tests")) if name.endswith(".test.js")]
TEST_CASES = sum(read_source("tests", name).count("\ntest(") + read_source("tests", name).count("test(\n")
                 for name in TEST_FILES)
ARBAEEN_COUNT = count_entries(read_source("3-arbaeen.html"), "const H = [")
HADITH_COUNT = count_entries(read_source("27-hadith.html"), "const HADITHS = [")
PROPHETS_COUNT = count_entries(read_source("8-qasas-anbiya.html"), "const P =")
AZKAR_SECTIONS = count_entries(read_source("25-azkar-shamila.html"), "const CATS =")
SITES_COUNT = count_entries(read_source("21-sites-directory.html"), "const SITES =")

# مكتبة المحتوى المقسّمة هي مصدر الأعداد الكبيرة، وهي التي تقرأ منها الصفحات
# نفسها، فتُكتب هنا أعداد تُعرض في الموقع لا تقديرًا.
MANIFEST = json.loads(read_source("content", "manifest.json"))
QUIZ_COUNT = MANIFEST["collections"]["quiz"]["count"]
QUIZ_CATEGORIES = MANIFEST["collections"]["quiz"]["categories"]
FATAWA_COUNT = MANIFEST["collections"]["fatwa"]["count"]
KHUTBAH_COUNT = MANIFEST["collections"]["khutbahs"]["count"]
TAFSIR_COUNT = MANIFEST["tafsir"]["count"]
HISN_COUNT = MANIFEST["hisn"]["count"]
SIRAJ_COUNT = MANIFEST["siraj"]["count"]
SEARCH_TERMS = MANIFEST["search"]["terms"]
RECITERS_TOTAL = MANIFEST["misc"]["reciters"]
RADIO_TOTAL = MANIFEST["misc"]["radio"]

# ── الفهرس نفسه مصدر الأدوات: يُقرأ كما هو فلا يفترق الدليل عن الموقع ──

INDEX_HTML = read_source("index.html")
_FIELD = re.compile(r"""(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*:\s*"""
                    r"""(?:"((?:[^"\\]|\\.)*)"|(true|false))""")


def js_unescape(text):
    return text.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


def js_objects(body):
    """كائنات JavaScript البسيطة داخل مصفوفة: {id:"x", external:true}."""
    objects = []
    for chunk in re.finditer(r"\{([^{}]*)\}", body, re.S):
        fields = {}
        for field in _FIELD.finditer(chunk.group(1)):
            key, text, flag = field.group(1), field.group(2), field.group(3)
            fields[key] = flag == "true" if flag is not None else js_unescape(text)
        objects.append(fields)
    return objects


INDEX_CATS = [(cat_id, cat_name) for cat_id, cat_name in re.findall(
    r'\[\s*"([^"]+)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]',
    array_body(INDEX_HTML, "const CATS ="))]
INDEX_TOOLS = js_objects(array_body(INDEX_HTML, "const TOOLS ="))


def tool_groups(include_books=True):
    """[(معرّف القسم, اسم القسم, أدواته)] بترتيب أقسام الفهرس."""
    groups = []
    for cat_id, cat_name in INDEX_CATS:
        if cat_id == "all":
            continue
        items = [tool for tool in INDEX_TOOLS if tool.get("cat") == cat_id]
        if items and (include_books or cat_id != "books"):
            groups.append((cat_id, cat_name, items))
    return groups


def html_pages_checked():
    """عدد صفحات HTML التي يفتحها فحص المتصفح كما يكتشفها هو."""
    skip = ("node_modules", ".git", "tests", "scripts", "vendor", "dist", ".kilo")
    pages = []
    for base, dirs, files in os.walk(ROOT):
        rel = os.path.relpath(base, ROOT).split(os.sep)
        if rel[0] == "." and len(rel) == 1:
            rel = []
        dirs[:] = [d for d in dirs
                   if not (d in skip or (not rel and d.startswith(".")))]
        pages += [os.path.join(base, name) for name in files if name.endswith(".html")]
    return len(pages)


def ar(text):
    """تشكيل + ترتيب ثنائي الاتجاه."""
    shaped = arabic_reshaper.reshape(str(text))
    return get_display(shaped, base_dir="R")


_AR_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def num(n):
    return str(n).translate(_AR_DIGITS)


_ONES = {1: "واحد", 2: "اثنان", 3: "ثلاثة", 4: "أربعة", 5: "خمسة", 6: "ستة",
         7: "سبعة", 8: "ثمانية", 9: "تسعة", 10: "عشرة", 11: "أحدَ عشرَ",
         12: "اثنا عشرَ", 15: "خمسةَ عشرَ", 18: "ثمانيةَ عشرَ", 22: "اثنتان وعشرون"}


def word(n, form, override=None):
    """العدّاد بالحروف عند الحاجة إلى صيغة لا يقبلها num()."""
    return override or _ONES.get(n, num(n)) + f" {form}"


def esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def P(text, font="Naskh", size=11.5, leading=19, color=INK, align=TA_RIGHT,
      space_before=0, space_after=6, indent=0):
    st = ParagraphStyle(
        "s", fontName=font, fontSize=size, leading=leading, textColor=color,
        alignment=align, spaceBefore=space_before, spaceAfter=space_after,
        rightIndent=indent, wordWrap="rtl" if align == TA_RIGHT else None,
    )
    return Paragraph(esc(ar(text)), st)


def raw_p(markup, font="Naskh", size=11.5, leading=19, color=INK, align=TA_RIGHT,
          space_before=0, space_after=6):
    st = ParagraphStyle("s", fontName=font, fontSize=size, leading=leading,
                        textColor=color, alignment=align,
                        spaceBefore=space_before, spaceAfter=space_after)
    return Paragraph(markup, st)


def h1(num, text):
    return [raw_p(
        f'<font name="NaskhB" color="{hx(GOLD)}">{esc(ar(num))}</font> &nbsp; '
        f'<font name="NaskhB" size="21" color="{hx(GREEN)}">{esc(ar(text))}</font>',
        align=TA_RIGHT, space_before=0, space_after=10)]


def h2(text, kicker=None):
    out = []
    bar = Table([[""]], colWidths=[3], rowHeights=[1])
    bar.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    out.append(Spacer(1, 4))
    if kicker:
        out.append(raw_p(
            f'<font name="Sans" size="8.5" color="{hx(GOLD)}">{esc(ar(kicker))}</font>',
            align=TA_RIGHT, space_after=2))
    out.append(raw_p(f'<font name="NaskhB" size="15" color="{hx(GREEN)}">{esc(ar(text))}</font>',
                     align=TA_RIGHT, space_after=4))
    out.append(bar)
    out.append(Spacer(1, 7))
    return out


def para(text, size=11.5):
    return P(text, size=size, leading=19.5, space_after=7)


def bullets(items, size=11.5, marker="◆"):
    out = []
    for it in items:
        out.append(raw_p(
            f'<font name="Sans" size="{size - 2.5}" color="{hx(GOLD)}">{esc(ar(marker))}</font>'
            f' &nbsp; <font name="Naskh" size="{size}" color="{hx(INK)}">{esc(ar(it))}</font>',
            align=TA_RIGHT, space_after=4))
    out.append(Spacer(1, 5))
    return out


def atomic_rows(table):
    """يمنع تقسيم الصفّ الواحد بين صفحتين: البطاقة أو الشريط يبقى كاملًا."""
    table.splitInRow = 0
    return table


def callout(title, body, accent=GREEN):
    t = Table([[raw_p(
        f'<font name="NaskhB" size="12.5" color="#ffffff">{esc(ar(title))}</font>'
        f'<br/><font name="Naskh" size="10.8" color="{hx(CALLOUT_BODY)}">{esc(ar(body))}</font>',
        align=TA_RIGHT, space_after=0)]], colWidths=[CONTENT_W], splitByRow=0)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), accent),
        ("LINEBEFORE", (0, 0), (0, -1), 3, GOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ]))
    return [Spacer(1, 3), t, Spacer(1, 9)]


def stat_grid(stats):
    """stats: list of (value, label)"""
    cells = []
    for v, l in stats:
        cells.append(raw_p(
            f'<font name="NaskhB" size="22" color="{hx(GREEN)}">{esc(ar(v))}</font><br/>'
            f'<font name="Sans" size="9" color="{hx(GREY)}">{esc(ar(l))}</font>',
            align=TA_CENTER, space_after=0))
    cols = 4
    rows = []
    for i in range(0, len(cells), cols):
        row = cells[i:i + cols]
        while len(row) < cols:
            row.append("")
        rows.append(row)
    t = Table(rows, colWidths=[CONTENT_W / cols] * cols, rowHeights=[20 * mm] * len(rows))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("GRID", (0, 0), (-1, -1), 0.6, SAND),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return [t, Spacer(1, 11)]


def cards(items, cols=2, w=CONTENT_W):
    """items: list of (title, body)"""
    cells = []
    for t_, b_ in items:
        inner = (f'<font name="NaskhB" size="11.8" color="{hx(GREEN)}">{esc(ar(t_))}</font><br/>'
                 f'<font name="Naskh" size="10.2" color="{hx(TINT)}">{esc(ar(b_))}</font>')
        cells.append(raw_p(inner, align=TA_RIGHT, space_after=0))
    rows = []
    for i in range(0, len(cells), cols):
        row = cells[i:i + cols]
        while len(row) < cols:
            row.append("")
        rows.append(row)
    t = Table(rows, colWidths=[w / cols] * cols)
    atomic_rows(t)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("BOX", (0, 0), (-1, -1), 0.6, SAND),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, SAND),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ]))
    return [t, Spacer(1, 10)]


# ── مصدر واحد لأقسام الكتالوج: العنوان والوصف يُقرأان منه في كل مكان ──
# العنوان يظهر في: ترويسة القسم، والفهرس السريع، وصفحة المحتويات.
SECTION_META = [
    ("١", "ما هذا الموقع؟", "الفكرة، ولوحة اليوم، والفهرس، ودليل المكتبة، ولمن ينفع."),
    ("٢", "موقع نور الهدى", "ثمانيةَ عشرَ قسمًا في صفحةٍ واحدة."),
    ("٣", "بوابة النور", "اثنا عشرَ تبويبًا من المصحف إلى الزكاة."),
    ("٤", "الأدوات", "الفهرسُ الكامل في ست فئات."),
    ("٥", "الكتب والمواقع", "مصادرُ القراءة المرجعية."),
    ("٦", "المصحف", "القراءةُ والتلاوةُ والتجويدُ والترجمةُ والتفسير."),
    ("٧", "الحاسبات الشرعية", "الزكاةُ والمواقيتُ والقبلةُ والمواريثُ والهجري."),
    ("٨", "يومك مع الموقع", "من الفجر إلى النوم: متى تفتح ماذا."),
    ("٩", "المزايا المشتركة", "بحثٌ ومفضّلةٌ وملاحظاتٌ ومظهرٌ وتثبيتٌ بلا إنترنت."),
    ("١٠", "الخصوصية والأمان", "بياناتُك على جهازك، بلا خادم ولا حساب."),
    ("١١", "الجودة والصيانة", "ماذا يُفحص قبل أن يصلك الموقع."),
    ("١٢", "الموقف العلمي", "ما وثّقناه، وما ينتظر مراجعة أهل العلم."),
    ("١٣", "كيف تبدأ؟", "ثلاث خطوات من أول دقيقة، وروابط مباشرة."),
]

SECTION_TITLE = {key: title for key, title, _ in SECTION_META}


def tools_total():
    """عدد بطاقات الفهرس كلها، ومنها الكتب والمواقع المرجعية."""
    return len(INDEX_TOOLS)


def site_tools_total():
    return sum(len(items) for cat, _, items in tool_groups(include_books=False))


def books_total():
    return sum(len(items) for cat, _, items in tool_groups() if cat == "books")


def external_books():
    return [tool for _, _, items in tool_groups() for tool in items if tool.get("external")]


def index_cards():
    return tools_total()

# المحتوى: كل ما تحت هذا السطر مكتوب لزائر الموقع

def cover():
    out = [Spacer(1, 24 * mm)]
    out.append(raw_p(f'<font name="Sans" size="12" color="{hx(GOLD)}">'
                     + esc(ar("دليل مرتب بالأرقام لكل ما في الموقع"))
                     + '</font>', align=TA_CENTER, space_after=10))
    out.append(raw_p(f'<font name="NaskhB" size="40" color="{hx(GREEN)}">'
                     + esc(ar("المكتبة الإسلامية")) + '</font>',
                     align=TA_CENTER, space_after=6))
    out.append(raw_p(f'<font name="NaskhB" size="21" color="{hx(GREEN_DEEP)}">'
                     + esc(ar("نور الهدى  ·  بوابة النور")) + '</font>',
                     align=TA_CENTER, space_after=4))
    out.append(Spacer(1, 6 * mm))
    rule = Table([[""]], colWidths=[70 * mm], rowHeights=[1.2])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD),
                              ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    t = Table([[rule]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    out += [t, Spacer(1, 8 * mm)]
    out.append(raw_p(f'<font name="Naskh" size="13" color="{hx(TINT)}">'
                     + esc(ar("كل ما تحتاجه في يومك: أذكار وقرآن وتعليم وقصص وحاسبات شرعية، "
                              "في رابط واحد، بلا تسجيل ولا كلمة مرور، ويعمل بلا إنترنت."))
                     + '</font>', align=TA_CENTER, space_after=5))
    out.append(raw_p(f'<font name="Sans" size="10" color="{hx(GREY)}">'
                     + esc(ar("islamic-library-green.vercel.app"))
                     + '</font>', align=TA_CENTER, space_after=14))
    out += stat_grid([
        (num(index_cards()), "بطاقة في الفهرس"),
        (num(SITE_SECTIONS), "قسمًا في موقع نور الهدى"),
        (num(APP_TABS), "تبويبًا في تطبيق بوابة النور"),
        ("١١٤", "سورة في المصحف"),
    ])
    out += stat_grid([
        (num(QUIZ_COUNT), "سؤالًا في بنك الاختبارات"),
        (num(FATAWA_COUNT), "فتوى في مكتبة الفتاوى"),
        (num(SIRAJ_COUNT), "معنًى لغويًّا في غريب القرآن"),
        (num(NAMES99_COUNT), "اسمًا من أسماء الله الحسنى"),
    ])
    out.append(Spacer(1, 3 * mm))
    out += callout(
        "صدقة جارية",
        "«اللهم اجعل هذا العمل خالصًا لوجهك، وانفع به كل من يقرأه وينشره»",
        GOLD)
    out.append(PageBreak())
    return out


def toc():
    out = h1("٠", "محتويات الدليل")
    out += bullets([f"{title} — {sub}" for _, title, sub in SECTION_META])
    out += callout("لماذا هذا الدليل؟",
                   "كيعرف كل من يفتح الموقع، طالبًا كان أو معلّمًا أو وليًّا أو داعيةً، ما الذي"
                   " سيجده فيه بالضبط: أي أداة، وأي ميزة، وأي حدود. وما ذُكر هنا مأخوذ من الموقع"
                   " نفسه لا من وصف تسويقي، وآخر صفحة فيه روابط الموقع نفسها.")
    out.append(PageBreak())
    return out


def page_intro():
    out = h1("١", SECTION_TITLE["١"])
    out.append(para(
        "المكتبة الإسلامية موقع عربي يجمع في مكان واحد كل ما يحتاجه المسلم في يومه: أذكاره"
        " وأدعيته، وقرآنه وتلاوته، ودروسه ودروس أطفاله، ومواقيت صلاته، وحاسباته الشرعية،"
        " وكتبه ومواقعه المرجعية. لا يطلب أن تسجل، ولا تدفع، ولا تنتظر تحميلًا طويلًا: تفتح"
        " الرابط فتعمل أمامك."))
    out += cards([
        ("لوحة اليوم: أول ما تراه",
         "قبل الفهرس نفسه لوحة اليوم: الصلاة القادمة والوقت المتبقي عليها، ووردك اليومي"
         " وعدد الأيام المتتالية، وآية اليوم وذكره، وسبحة تضغطها، وأحد عشر اختصارًا"
         " تفتح بكرة المصحف أو الأذكار أو المواقيت. وفيها تذكيرات يومية اختيارية"
         " لا تُطلب إلا بإذنك، ويمكنك إيقافها من مكانها."),
        ("الفهرس: كل الأدوات",
         "ما تحت اللوحة فهرس كامل: كل الأدوات موزّعة في فئات ست، وبحث واحد يجمع كل ما"
         " في الموقع، ونجمة على كل أداة تضعها في المفضّلة، وأيقونة ملاحظة تكتب فيها رأيك،"
         " وترتيب للأدوات حسب آخر استخدام لك، وزر لغة يبدل الموقع كله بين العربية"
         " والإنجليزية."),
        ("دليل المكتبة: جولة تعريفية",
         "عند أول فتح تظهر لك جولة تمرّ بك في الموقع كله: ما هو، ولوحة اليوم، ومميزات"
         " الفهرس، ثم كل أداة في قسمها، ثم من أين تبدأ. وتبقى متاحة بزر"
         " «دليل المكتبة» في الترويسة، وتُعرض من جديد إن تغيّرت أقسام الموقع."),
        ("موقع نور الهدى: المنهج التعليمي",
         "صفحة واحدة طويلة فيها ثمانية عشر قسمًا: المنهج، وأعلام السلف، والدروس الفقهية،"
         " والسيرة، وقصص الأنبياء، وأسماء الله الحسنى، والأذكار، والاختبارات والشهادات،"
         " وركن الأطفال."),
        ("تطبيق بوابة النور: مصمم للهاتف",
         "تطبيق باثني عشر تبويبًا: المصحف، والختمة، والأذكار، والمواقيت، والمتابعة، والأدعية،"
         " والإذاعة، والبطاقات، والحديث، والزكاة، والصدقة. واجهته عريضة صنعت للهاتف أولًا."),
    ])
    out += h2("لمن ينفع هذا الموقع؟", "ستة أوضاع تلتقي فيها")
    out += bullets([
        "طالب علم يريد دروسًا في العقيدة والأدب، واختبارًا يختبر نفسه فيه، وشهادة تعلَّق.",
        "طالب حفظ يريد ورده اليومي، وعلامات في المصحف، وختمة يوزعها مع رفاقه.",
        "أم أو أب يريد شرح الصلاة بأسلوب مبسط، وأدعية يومية، ومحتوى هادئًا لأبنائه.",
        "مسافر، أو من تنقطع عنه الشبكة: مواقيت الصلاة والقبلة والورد كلها متاحة بلا إنترنت.",
        "معلم أو داعية يبحث عن مادة جاهزة للعرض أو للنشر.",
        "من أراد أن ينشر خيرًا: يصنع بطاقة من آية أو حديث ويشاركها في دقيقة.",
    ])
    out += callout("الفكرة في سطر واحد",
                   "بدل أن تفتح عشرة مواقع وتبحث في كل منها، تفتح رابطًا واحدًا فيه كل هذه الأدوات"
                   " معًا، ويعمل حتى في الطريق أو في المسجد حيث لا شبكة.")
    out.append(PageBreak())
    return out


def page_site():
    out = h1("٢", f"{SECTION_TITLE['٢']}: المنهج التعليمي")
    out.append(para(
        "صفحة واحدة لا يُعاد تحميلها: كل ما بداخلها يظهر مع تمريرك للأسفل، والقسم الذي تقرؤه"
        " يميز لك في الشريط الجانبي حتى لا تفقد مكانك. إليك أقسامها كما تظهر للزائر:"))
    sections = [
        ("الرئيسية",
         "ما تراه أول الفتح: آية اليوم وحديث اليوم، وأربع عدادات تعرض تقدمك: دروس مقروءة،"
         " وأيام متتالية، وعناصر محفوظة، وأذكار اليوم. وبطاقة تحدي الأسبوع، وبطاقة شهاداتك."),
        ("منهج سلف الأمة",
         "اثنا عشر درسًا منهجيًا في محاور: العقيدة، والأصول، والبدع، والاتباع، والأخلاق،"
         " مع شرائح تنقلك بين المحاور."),
        ("أعلام السلف",
         "واحد وعشرون عالمًا في شبكة قابلة للبحث، فلو كتبت جزءًا من اسم أو نسبته ظهر لك فورًا."),
        ("أقوال السلف",
         "تسعة عشر قولًا لعلماء السلف، تنتقي منها ما تشاء."),
        ("الدروس الفقهية",
         "أربعة عشر درسًا في الطهارة والأحكام والآداب. كل درس يفتح في نافذة فيها المتن،"
         " وأسئلة شائعة، ومصادره، واختبار خاص به، وتُعلم عليه أنه مقروء إذا أتممته."),
        ("السيرة النبوية",
         "ستة محاور مرتبة زمنيًا، من المولد ﷺ إلى وفاته، اقرأها متتابعة كخط زمني."),
        ("قصص الأنبياء",
         "ستة أنبياء في هذا القسم: آدم، ونوح، وإبراهيم، ويوسف، وموسى، وعيسى. وقسم مستقل"
         " في الفهرس يوسعها إلى خمسة وعشرين نبيًا."),
        ("أدعية المناسبات",
         "أربع فئات: الصباح، والمساء، والسفر، والمريض، في عشر أدعية، لكل منها زر نسخ ومشاركة."),
        ("أسماء الله الحسنى",
         "الأسماء التسعة والتسعون بمعانيها، وبحث يقبل الاسم أو المعنى."),
        ("الأذكار",
         "أذكار النوم وبعد الصلاة، وسبحة عدّاد مستقلة تتفرغ للذكر بأهداف ٣٣ و٩٩ و١٠٠ و٢٠٠"
         " أو بلا هدف، وتقدر بها المسافة بالكيلومترات."),
        ("ركن الأطفال",
         "أربعة دروس مبسطة للصغار، مع الفئة العمرية لكل درس."),
        ("أدوات إسلامية",
         "بوصلة القبلة وإبرتها الدوارة، ومواقيت الصلاة الست، والتحويل بين التقويم الهجري والميلادي."),
        ("الاختبارات",
         "تحد أسبوعي، وبنك أسئلة بثلاثة أنواع: اختيار من متعدد، وصح وخطأ، وتعبئة فراغ،"
         " مع شرح بعد كل إجابة، ومؤقت إن أردت، وجدول مراجعة يشرح لك كل إجابة."),
        ("شهاداتي",
         "حين تنتهي اختبارًا بنسبة ٨٠٪ فأعلى ترسم لك شهادة إتمام باسمك، تحفظ في جهازك،"
         " وتُنزّل صورة لتطبعها أو تشاركها."),
        ("اسأل سؤالًا",
         "نموذج تكتب فيه سؤالك وتصنفه، ثم تنسخه أو ترسله بالبريد. لا يوجد خادم يستقبله؛"
         " النص يصل إليك أنت لتقرر ما تفعل به."),
        ("أسئلة وأجوبة",
         "ثمانية أسئلة شائعة في قوائم تفتح وتغلق."),
        ("عن الموقع",
         "بطاقات تعلن الهدف والمنهج والمصادر والعقيدة، ومنها نص مجلس المراجعة العلمية بحروفه."),
        ("سياسة الخصوصية",
         "ثلاث بطاقات: ما الذي يحفظ عندك، وما الذي لا يرسل إلى أحد."),
    ]
    cells = []
    for i, (title, desc) in enumerate(sections, 1):
        cells.append(raw_p(
            f'<font name="NaskhB" size="10" color="{hx(GOLD)}">{esc(ar(num(i)))}</font> &nbsp; '
            f'<font name="NaskhB" size="11" color="{hx(GREEN)}">{esc(ar(title))}</font><br/>'
            f'<font name="Naskh" size="9.4" color="{hx(MUTED)}">{esc(ar(desc))}</font>',
            align=TA_RIGHT, space_after=0))
    table = Table([[c] for c in cells], colWidths=[CONTENT_W])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PAPER),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, SAND),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    out += [table, Spacer(1, 10)]
    out += callout("نقطة مهمة عن الشهادات",
                   "الشهادة ترسم عندك في جهازك ولا ترفع إلى أي خادم، والفصل عند ٨٠٪ لأن الإتقان"
                   " في الاختبار وحده لا يثبت إتقانًا في العلم.")
    out.append(PageBreak())
    return out


def page_app():
    out = h1("٣", f"{SECTION_TITLE['٣']}: {num(APP_TABS)} تبويبًا")
    out.append(para(
        "هذا التطبيق مصمم للهاتف أولًا: أزرار كبيرة، وشريط تنقٍ في أسفل الشاشة، ويفتح بلا"
        " إنترنت بعد أول زيارة. وآخر تبويب فتحته يُذكر، فيعود إليه من حيث توقف."))
    out += callout("أزرار أعلى الشاشة",
                   "زر يبدل المظهر بين الفاتح والداكن، وزر تنبيه الصلاة قبل الأذان،"
                   " وزر تثبيت الموقع على الشاشة الرئيسية، وزر تحديث النسخة، والإعدادات."
                   " وإن انقطع الإنترنت ظهر شريط أسفل الشاشة يقول لك إنك غير متصل"
                   " ولا يتعطل شيء.")
    out += cards([
        ("الرئيسية",
         "آية اليوم وحديث اليوم وحكمة اليوم، وعدّاد سبحة بشريط تقدم،"
         " وأحداث هجرية يميز منها حدث اليوم، واثنا عشر اختصارًا سريعًا."),
        ("المصحف",
         f"١١٤ سورة بتلاوة صوتية لـ{word(RECITER_COUNT, 'قرّاء')}، تكبر الخط أو تصغره، ووضع تركيز"
         " يخفي كل ما ليس القرآن، وورد يومي تسجل فيه ما قرأت، وحفظ السورة للعمل بلا إنترنت،"
         " وتلوين التجويد، والترجمة كلمة بكلمة، والتفسير الميسر والجلالي، والنسخ مع المعرف،"
         " والعلامات، وقائمة السور بالبحث والتصفية مكية ومدنية."),
        ("الختمة",
         "ثلاثون جزءًا بعدّاد «كذا من ٣٠»، وإهداء يكتب لكل جزء، وإسناد لكل جزء،"
         " ورابط مزامنة يرسل لرفاقك فينسخونه بلا حساب ولا خادم."),
        ("الأذكار",
         "أربع فئات بثمانية أذكار، مع ستريك يومي يحفظ تقدمك، وشريط تم لكل ذكر،"
         " وتبويب فرعي للسبحة."),
        ("المواقيت",
         f"تختار من {num(CITY_COUNT)} مدينة أو تحدد موقعك، وستة مواقيت، والصلاة القادمة بعدّاد"
         " تنازلي، وتنبيه قبل الأذان بخمس أو عشر أو خمس عشرة دقيقة، وصوت أذان للتجربة،"
         " وأوقات النهي عن الصلاة مع آياتها."),
        ("المتابعة",
         "تأشر الصلوات الخمس كل يوم، وترى مخطط أداء آخر سبعة أيام، وتصدر بياناتك أو تستعيدها."),
        ("الأدعية",
         "ثلاثة عشر دعاءً في مجموعات، مع البحث والنسخ."),
        ("الإذاعة",
         f"{num(RADIO_COUNT)} محطة: قرّاء وتفسير ورقية وعامة، مع البحث، ومستوى الصوت،"
         " ومؤقت نوم يوقف الإذاعة بعد ١٥ أو ٣٠ أو ٦٠ دقيقة."),
        ("البطاقات",
         "ستة قوالب بثلاثة مقاسات تصنع منها بطاقة من أي آية أو حديث أو ذكر، وتنزّلها صورة"
         " جاهزة للنشر."),
        ("الحديث",
         f"{num(HADITH_COUNT)} حديثًا من الكتب الستة، مع البحث والمفضلة والنسخ."),
        ("الزكاة",
         "أربعة أنماط: نقود، وذهب وفضة، وأسهم وعقارات، وأنعام. وأدق ما فيه أن الزينة تحسب"
         " حكمًا يخالف التجارة في المعدن."),
        ("الصدقة",
         "بطاقات صدقة جارية تصنعها باسمك وتؤرشفها، تذكرك بما نويت."),
        ("الإعدادات",
         "فيها المظهر وحجم خط المصحف ونوع التقويم، ومقدار التنبيه قبل الأذان، وطريقة حساب"
         " المواقيت، ومستوى صوت الإذاعة، وتصدير بياناتك أو استيرادها أو مسحها كلها."),
    ])
    out += callout("أزرار أعلى الشاشة",
                   "زر يبدل المظهر بين الفاتح والداكن، وزر تنبيه الصلاة قبل الأذان،"
                   " وزر تثبيت الموقع على الشاشة الرئيسية، وزر تحديث النسخة، والإعدادات."
                   " وإن انقطع الإنترنت ظهر شريط أسفل الشاشة يقول لك إنك غير متصل"
                   " ولا يتعطل شيء.")
    out.append(PageBreak())
    return out


def tool_target(tool):
    """مصدر الأداة كما هو في الفهرس: ملف داخل الموقع أو رابط خارجي."""
    return "رابط خارجي" if tool.get("external") else tool.get("url", "")


def tool_card(index, tool):
    return (f"{index}. {tool['name']}", f"{tool_target(tool)} — {tool['desc']}")


def page_tools():
    groups = tool_groups(include_books=False)
    out = h1("٤", f"{SECTION_TITLE['٤']}: {num(site_tools_total())} أداة")
    out.append(para(
        f"في الفهرس {num(index_cards())} بطاقة موزّعة على ست فئات: {num(site_tools_total())}"
        f" أداة تفتح من داخل الموقع في {num(len(groups))} فئات، و{num(books_total())}"
        " كتابًا وموقعًا وصوتًا في قسمها. والأسماء والأوصاف أدناه منقولة من الفهرس نفسه"
        " كما تظهر للزائر، فما هنا هو ما هناك لا وصفًا آخر."))
    out.append(para(
        "والفهرس بلسانين: زر اللغة يبدل اسم كل أداة ووصفها بين العربية والإنجليزية، ويبدل"
        " اتجاه الصفحة من اليمين إلى اليسار إلى العكس. ولكل أداة نجمة تضعها في المفضّلة،"
        " وأيقونة ملاحظة تكتب فيها رأيك، وترتيب للأدوات حسب آخر استخدام لك."))
    for _, title, items in groups:
        out += h2(title, f"{num(len(items))} أدوات")
        out += cards([tool_card(i, tool) for i, tool in enumerate(items, 1)], cols=2)
    out += callout("المجموع",
                   f"{num(index_cards())} بطاقة في صفحة واحدة: {num(site_tools_total())} أداة"
                   f" و{num(books_total())} كتابًا وموقعًا وصوتًا. وأول ما تراه في الفهرس"
                   " لوحة اليوم، لا هذه البطاقات: ترى فيها ما تفعله اليوم بدل أن تبحث"
                   " عنه في القائمة.")
    out.append(PageBreak())
    return out


def page_books():
    _, _, items = next(group for group in tool_groups() if group[0] == "books")
    inside = [tool for tool in items if not tool.get("external")]
    outside = [tool for tool in items if tool.get("external")]
    out = h1("٥", SECTION_TITLE["٥"])
    out.append(para(
        f"قسم مستقل في الفهرس يجمع {num(len(items))} بطاقة: {num(len(inside))} مكتبة"
        f" قراءة تفتح من داخل الموقع، و{num(len(outside))} كتابًا وملفًا صوتيًا على درايف"
        " تفتح على ملفك الخاص بك أنت، لا على حساب عند أحد."))
    out += callout("لماذا مصادر خارجية؟",
                   "لأن الكتب لا تنسخ في مشروع مفتوح، فهذه روابط إلى ملفات قائمة كما هي."
                   " وأي نص منسوب إلى النبي صلى الله عليه وسلم أو صحابي أو عالم لا يكتب"
                   " بلا مراجعة أهل العلم، وهذا مبدأ التزمه الموقع منذ بدايته.")
    out += h2("المكتبة داخل الموقع", f"{num(len(inside))} أدوات")
    out += cards([tool_card(i, tool) for i, tool in enumerate(inside, 1)], cols=2)
    out += h2("كتب وملفات صوتية", f"{num(len(outside))} ملفًا خارجيًّا")
    out += cards([tool_card(i, tool) for i, tool in enumerate(outside, 1)], cols=2)
    out += callout("ما في هذا القسم بالأرقام",
                   f"{num(SITES_COUNT)} موقعًا مرجعيًّا في دليل المواقع، و{num(SIRAJ_COUNT)}"
                   f" معنًى لغويًّا في غريب القرآن، و{num(HISN_COUNT)} بابًا من حصن المسلم"
                   f" مع الصوت، و{num(TAFSIR_COUNT)} تفسيرًا في {num(114)} سورة،"
                   f" و{num(FATAWA_COUNT)} فتوى مصنّفة، و{num(KHUTBAH_COUNT)} خطبة،"
                   " ودورة في التاريخ الإسلامي، ومكتبة فيديو موثّقة. وهذه الأعداد من"
                   " فهرس المحتوى الذي تقرأ منه الصفحات نفسها.")
    out.append(PageBreak())
    return out


def page_quran():
    out = h1("٦", f"{SECTION_TITLE['٦']}: كيف تقرأ القرآن من الموقع")
    out.append(para(
        "القراءة أكبر ما في الموقع، ولذلك جُمعت فيها أكبر دورة: تلاوة صوتية، ونص بالرسم"
        " العثماني، وتلوين لأحكام التجويد، وترجمة كلمة بكلمة، وتفسير بثلاثة مصادر،"
        " كلها في شاشة واحدة لا يُعاد تحميلها."))
    out += cards([
        ("نص كامل وتصريف مريح",
         "١١٤ سورة بالرسم العثماني، وقائمة سور تبحث فيها بالاسم وتصفّيها مكية أو مدنية."),
        (f"تلاوة صوتية لـ{word(RECITER_COUNT, 'قرّاء')}",
         "تختار القارئ، وتبدأ وتوقف وتنتقل بين السور، ومؤقت نوم يوقف الصوت بعد ١٥ أو ٣٠"
         " أو ٦٠ دقيقة، مع زر إلغاء."),
        ("أحكام التجويد ملونة",
         "تلون أحكام التجويد داخل نص السورة، فيقرأ البصر أين مد وأين إخفاء وأين غنة."),
        ("ترجمة كلمة بكلمة",
         "كل كلمة ومعناها، ومعها الترجمة الإجمالية أسفل الآية."),
        ("تفسير بثلاثة مصادر",
         "الميسر والجلالي والإنجليزي، وتبدل المصدر بلا إعادة تحميل."),
        ("الورد اليومي",
         "حدد عدد الصفحات هدفًا، وسجل ما قرأت، وتابع تقدمك متصلًا."),
("احفظ السورة بلا إنترنت",
         "تفرغ السورة في جهازك فتفتحها في الطائرة أو في الشبكة الضعيفة. والحد الأقصى"
         " خمسون سورة، وتُعلم بما نزل."),
        (f"قرّاء وإذاعات بلا إنترنت",
         f"في صفحة القرّاء والتلاوة {num(RECITERS_TOTAL)} قرّائًا و{num(RADIO_TOTAL)} إذاعة"
         " مستقيمة، وتحمّل منها السور بملفاتها كاملة فتعمل في أي مكان"),
        ("علامات ونسخ بالمعرف",
         "زر حفظ العلامة على الآية، والضغط على العلامة يفتح سورتها ويتمرر إليها."
         " ونسخ الآية يرفق معرفها: سورة البقرة، الآية ٢٥٥."),
        ("قراءة مريحة للعين",
         "تكبر الخط أو تصغره، ووضع التركيز يخفي كل ما ليس نص القرآن."),
    ])
    out += callout("تخزين السور على جهازك فقط",
                   "ما تحفظه من سور يبقى في جهازك وحده، لا يرفع إلى خادم. ولا يخزن شيء يخصك"
                   " في أي مكان آخر.")
    out.append(PageBreak())
    return out


def page_calc():
    out = h1("٧", SECTION_TITLE["٧"])
    out.append(para(
        "ست حاسبات تجيب عن أسئلة يومية حساسة، من زكاة مالك إلى جهة قبلته. وقاعدتها واحدة:"
        " إن لم تكن القيمة في جدول شرعي معروف، أعادت أنها غير متوفرة بدل التخمين."))
    out += cards([
        ("حاسبة الزكاة",
         "أربعة أنماط: نقود، وذهب وفضة مع تمييز الزينة عن التجارة فلكل حكمه، وأسهم وعقارات،"
         " وأنعام: إبل وبقر وغنم بجداولها الشرعية."),
        ("مواقيت الصلاة",
         "من الفجر إلى العشاء، مع عدّاد للصلاة القادمة، وسبع طرق حساب، وأوقات النهي عن"
         " الصلاة الثلاث المحسوبة من مواقيت اليوم مع الآيات، وتنبيه قبل الأذان، وصوت أذان حقيقي."),
        ("حاسبة المواريث",
         "أنصبة الزوج والأم والأب والبنين والبنات في الحالات الشائعة، مع الفروق والعلامات"
         " التحذيرية حيث يختلف الحكم."),
        ("اتجاه القبلة",
         "زاوية القبلة تحسب من موقعك إلى الكعبة، مع إبرة دوارة وأسماء الجهات الثمانية."),
        ("التقويم الهجري",
         "تحويل في الاتجاهين، مع المناسبات والصيام المستحب."),
        ("متابعة صيام القضاء",
         "سجل الأيام الفائتة وتابع قضاءها يومًا بيوم."),
    ])
    out += callout("متى لا تجيب الحاسبة؟",
                   "الجداول الشرعية لها حدود: ما خرج عن حد في جدول الأنعام، أو المسائل"
                   " الخلافية، لا تحسب بل تعرض عليك مراجعة لا تخمينًا. والحاسبة أداة تذكير"
                   " لا فتوى.")
    out.append(PageBreak())
    return out


def page_routine():
    out = h1("٨", "يومك مع الموقع: من الفجر إلى النوم")
    out.append(para(
        "أحسن طريقة لاستخدام موقع كهذا ألا تفتحه وتنسى، بل أن تجعله جزءًا من يومك."
        " ولذلك بُنيت لوحة اليوم في أول الصفحة: هي التي تقول لك الآن ماذا تفعل،"
        " لا أن تبحث عنه في قائمة. وهذا يوم عادي مع الموقع:"))
    out += cards([
        ("عند أول فتح",
         "تظهر لك جولة تعريفية قصيرة تمرّ بالموقع كله: ما هو، ولوحة اليوم، ومميزات"
         " الفهرس، ثم كل أداة في قسمها. وتُعرض من جديد بزر «دليل المكتبة» متى شئت."),
        ("قبل الفجر",
         "تفتح أذكار الصباح من اختصارات اللوحة، ثم ترى مواقيت اليوم كلها وصفحة المصحف"
         " فيها السورة التالية مع الصوت في صفحة واحدة."),
        ("في العمل أو في البيت",
         "من اللوحة تضغط «ابدأ وردك»، فيحسب لك ما قرأته اليوم وعدد الأيام المتتالية،"
         " وتضع علامة عند آية تريد العودة إليها في المصحف."),
        ("في الطريق",
         "الصلاة القادمة والوقت المتبقي عليها في أعلى اللوحة، والقبلة والتسبيح"
         " من اختصاراتها. ويعمل كل ذلك بلا إنترنت."),
        ("قبل النوم",
         "أذكار النوم من الأذكار الشاملة، ولو سمح وقتك وردًا قبلها بقليل،"
         " وتسجيل الورد يتم في لوحة اليوم نفسها."),
        ("مع رفاقك",
         "تفتح الختمة الجماعية وتوزع الأجزاء، أو التسبيح الجماعي في المجلس،"
         " أو تشارك من اللوحة رابط الموقع مع من تحب."),
    ])
    out += callout("لا تفتح الموقع كله",
                   "افتح الأداة التي تحتاجها في وقتها فقط. والعدادات في اللوحة لتنظيمك"
                   " لا لتقارنك، وهي رسالة مكتوبة في الفهرس نفسه.")
    out.append(PageBreak())
    return out


def page_features():
    out = h1("٩", SECTION_TITLE["٩"])
    out.append(para("وهذه أشياء تصاحبك في كل صفحات الموقع:"))
    out += cards([
        ("لوحة اليوم",
         "الصلاة القادمة بعدّاد، ووردك اليومي وأيامك المتتالية، وآية اليوم وذكره،"
         " وسبحة تضغطها، وأحد عشر اختصارًا تفتح بكرة الأداة التي تريدها."),
        ("دليل المكتبة",
         "جولة تعريفية شاملة تظهر عند أول فتح وتغطي الموقع وأدواته كلها،"
         " وتبقى بزر واحد في الترويسة، وتُعرض من جديد إن تغيّر الموقع."),
        ("بحث واحد في كل المحتوى",
         f"بحث يجمع ما في الموقع كله في نافذة واحدة: نحو {num(SEARCH_TERMS // 1000)}"
         " ألف مدخل من الأذكار والأدعية والأحاديث والعلماء والأنبياء والكتب،"
         " ويصحّح خطأ الإملائي ويعرف قصدك من سؤالك."),
        ("مظهر فاتح وداكن", "زر واحد يبدل المظهر، ويحفظ اختيارك عند فتحه في المرة القادمة."),
        ("خط أكبر أو أصغر", "كبر الخط إن كنت تقرأ من شاشة صغيرة، وصغره إن كان الخط كبيرًا عندك."),
        ("بالعربية والإنجليزية", "زر اللغة يبدل الموقع كله، بما فيه اتجاه الصفحات وأسماء الأدوات."),
        ("المفضّلة", "نجمة على كل أداة، فتجمع ما تحبه في مكان واحد."),
        ("ملاحظاتك", "أيقونة ملاحظة تكتب فيها رأيك في الأداة أو تذكر فيها ملاحظة لنفسك."),
        ("تقدّمك محفوظ", "ما قرأته من الدروس، وعلاماتك في المصحف، ووردك، وأذكارك اليومي،"
                         " ومتابعة صلواتك، كلها تبقى لك في جهازك."),
        ("مشاركة سهلة", "أرسل الآية أو الدعاء أو الحديث أو بطاقتك إلى واتساب أو تيليجرام"
                       " أو غيرهما، أو انسخها بضغطة."),
        ("تذكير الصلاة", "يذكرك قبل الأذان بخمس أو عشر أو خمس عشرة دقيقة إن سمحت الإذن،"
                        " وتذكيرات أخرى للورد وأذكار الصباح والمساء，你可以 إيقافها كلها."),
        ("تنزيل السور كاملة", "في صفحة القرّاء والتلاوة تحمّل السور بملفاتها كاملة لتعمل"
                              " بلا إنترنت، مع تلاوات وقراءات كثيرة."),
        ("شهادات على canvas", "تنتهي اختبارًا بنسبة عالية فيُرسم لك شهادة باسمك في جهازك،"
                             " تُنزّل صورة تطبعها أو تشاركها."),
        ("تثبيت على الهاتف", "ثبته على الشاشة الرئيسية ليُفتح كتطبيق بأيقونته، بخطوة واحدة"
                             " على أندرويد وخطوتين على الآيفون."),
        ("يعمل بلا إنترنت", "بعد أول زيارة تحفظ الصفحات في جهازك، فتفتح المكتبة كاملة في"
                           " المسجد والطائرة حيث لا شبكة."),
        ("مصمم للهاتف", "من هاتف صغير إلى شاشة كبيرة، والزر كبير يبلغه إبهامك بسهولة."),
    ])
    out.append(PageBreak())
    return out


def page_privacy():
    out = h1("١٠", SECTION_TITLE["١٠"])
    out.append(para(
        "أخطر سؤال يسأله الناس لأي موقع: ماذا يفعل ببياناتي؟ الجواب هنا قصير: لا يفعل شيئًا."))
    out += cards([
        ("لا حساب ولا تسجيل", "لا تطلب منك بيانات تعريفية. لا بريد، ولا رقم، ولا كلمة مرور."),
        ("ما يحفظ عندك وحدك", "التقدم والمفضلة والملاحظات ونتائج الاختبارات، كلها في ذاكرة"
                              " متصفحك على جهازك، لا عندنا."),
        ("لا تحليل ولا تتبع", "لا أدوات إحصاء تتابع من أين جاء الزائر."),
        ("ثلاثة اتصالات فقط", "للخطوط، ولمواقيت الصلاة ولا ترسل إلا الإحداثيات، ولمصحف"
                             " والطلب يحمل رقم السورة فقط لا بيانات شخصية."),
        ("نصك الذي تكتبه لا يرسل", "ما تكتبه في نموذج اسأل سؤالًا يبقى في جهازك، تنسخه أو"
                                  " ترسله أنت بالبريد، ولا يوجد خادم يستقبله."),
        ("نسخة احتياطية بيدك", "تقدر تصدّر كل بياناتك في ملف واحد وتستعيده متى شئت."),
    ])
    out += callout("الأمان في الإدخال",
                   "أي نص تكتبه أنت، كاسم المسند أو نص البطاقة أو ملاحظتك، يمر بفلتر قبل"
                   " أن يعرض، فلا يستطيع نص ما أن يخدع صفحتك أو يغير شكلها.")
    out.append(PageBreak())
    return out


def page_quality():
    out = h1("١١", SECTION_TITLE["١١"])
    out.append(para(
        "لا فائدة لقول إن الموقع شغّال ثم يفشل معك في الطريق. لذلك اختُبر بعد كل تعديل،"
        " ويُفتح آليًا في متصفح حقيقي تُضغط أزراره وتُقارن نتائجها بما يظهر في الصفحة."))
    out += bullets([
        "لا زر صامت: كل زر ضُغط آليًا، وتُحقَّق النتيجة في الصفحة، فلا يمر زر لا يعمل.",
        "لا نص غريب: يُفحص النص العربي خلوًا من الحروف اللاتينية ومن الكلمات المفتاحية،"
        " فلا يظهر في الصفحة حرف لاتيني ولا كلمة لا معنى لها.",
        "لا آية خطأ: كل آية في الدروس تُقابل آليًا بمصحف رقمي، فيُرفض المرجع الخاطئ والنص المختلق.",
        "لا حارس مكسور: أي حذف لعنصر من مصدره يُفشل الفحص بدل أن يمر صامتًا.",
        f"فحص في متصفح حقيقي يفتح {word(html_pages_checked(), 'صفحة')} من الموقع، ويتأكد من عدم"
        " وجود تمرير أفقي على شاشة صغيرة، ومن عمل الموقع بلا إنترنت.",
    ])
    out += callout("حقيقة تُقال بصراحة",
                   f"أرقام هذا الدليل هي أرقام الموقع اليوم: {num(LESSONS_COUNT)} درسًا في المنهج،"
                   f" و{num(APPS_DUAS_COUNT)} دعاءً في التطبيق،"
                   f" و{num(QUIZ_COUNT)} سؤالًا في بنك الاختبارات،"
                   f" و{num(PROPHETS_COUNT)} نبيًا في قسم القصص،"
                   f" و{num(SITES_COUNT)} موقعًا في دليل المواقع."
                   " والموقع يعرض هذه الأرقام بصدق ولا يدّعي الاكتمال. ولو كبر المحتوى يومًا"
                   " ستتغير، وهذه الأرقام مأخوذة من الموقع مباشرة وقت كتابة الدليل.")
    out.append(PageBreak())
    return out


def page_scholar():
    out = h1("١٢", SECTION_TITLE["١٢"])
    out.append(para(
        "نقطة نبّهك إليها في أي كتاب فيه نصوص منسوبة إلى النبي صلى الله عليه وسلم: ليس كل نص"
        " يحفظ وينقل بلا سند. والموقع نفسه يعلن هذا بحرفه: الموقع قيد إنشاء مجلس مراجعة من"
        " طلاب العلم المتخصصين على منهج السلف لمراجعة كل درس، حتى الآن المحتوى مكتوب بمساعدة"
        " تقنية ويحتاج مراجعة نهائية. وهذا النص معروض في الموقع كما هو، لا يُخفى ولا يُحذف."))
    out += cards([
        ("ما وُثِّق",
         "الأدعية الثلاثة عشر لها مخارجها، والأحاديث العشرة بسندها ودرجتها،"
         " والأقوال التسعة عشر منسوبة إلى أصحابها."),
        ("ما ينتظر مراجعة أهل العلم",
         "ثمانية من الأذكار نصوصها في المصدر لكن لم يثبت تخريجها، والعناوين الوصفية للسيرة"
         " والأنبياء تحتاج من يثبت نسبها."),
        ("ما لا يقرره الحاسوب أبدًا",
         "أحكام الفقه في الدروس، وجداول زكاة الأنعام فوق مدولها، وسنن العبادات،"
         " هذه فتاوى تؤخذ عن أهل العلم لا أرقام تحسب."),
    ])
    out += callout("لماذا لم يكمل المحتوى آليًا؟",
                   "لأن المحاولات الأولى لتوليد النصوص آليًا أنتجت عربية مشوهة وأدعية مكررة"
                   " بلا معنى، فردت إلى الملفات الأصلي المتحقق منها. وتوليد نص منسوب إلى النبي"
                   " صلى الله عليه وسلم أو صحابي يدخل أخطاء في الدين، وهي أخطاء لا يظهرها"
                   " أي فحص آلي، فلا يكمل إلا بمراجعة أهل العلم.")
    out.append(PageBreak())
    return out


def page_start():
    out = h1("١٣", SECTION_TITLE["١٣"])
    out += h2("ثلاث خطوات من أول دقيقة", "ابدأ هكذا")
    out += cards([
        ("اقرأ الجولة ثم اللوحة",
         "عند أول فتح تظهر جولة تعريفية بالموقع وأدواته كلها، تقرأها في دقيقة أو две."
         " بعدها تبدأ يومك من لوحة اليوم: الصلاة القادمة، ووردك، وآية اليوم، والاختصارات."),
        ("ثبّت الموقع على هاتفك",
         "من زر التثبيت في الأعلى، أو على الآيفون: مشاركة ثم إضافة إلى الشاشة الرئيسية."
         " بعدها يفتح الموقع كتطبيق مستقل ويعمل بلا إنترنت."),
        ("ابدأ بما ينفعك",
         "طالب علم: نور الهدى ثم اختبار وشهادة. والِدًا: تعلّم الصلاة وركن الأطفال."
         " ومسافرًا: المواقيت والقبلة والورد."),
    ])
    out += callout("نصيحة أول زيارة",
                   "افتح الموقع مرة واحدة وأنت متصل، واتركه يحفظ نفسه؛ بعدها افتحه وقت ما شئت"
                   " بلا شبكة. أمّا المصحف والإذاعة فتحتاج اتصالًا وقت طلبها، ولهذا زر التفريغ"
                   " يخزن السور مسبقًا للعمل في الطريق.")
    out += h2("روابط مباشرة", "احفظها الآن")
    out += cards([
        ("صفحة الموقع", "islamic-library-green.vercel.app"),
        ("موقع نور الهدى", "islamic-library-green.vercel.app/src/site/noor.html"),
        ("تطبيق بوابة النور", "islamic-library-green.vercel.app/src/app/app.html"),
        ("الكتالوج التعريفي", "islamic-library-green.vercel.app/catalog.pdf — هذا الدليل،"
                              " وهو مرفق في آخر الفهرس نفسه"),
        ("للتواصل",
         "عبر اسأل سؤالًا في قسم عن الموقع، أو بريد المؤلف المذكور في تذييل الفهرس."),
    ])
    out.append(PageBreak())
    return out


def page_end():
    out = [Spacer(1, 40 * mm)]
    out.append(raw_p(f'<font name="NaskhB" size="26" color="{hx(GREEN)}">'
                     + esc(ar("اللهم اجعل هذا العمل")) + '</font>',
                     align=TA_CENTER, space_after=4))
    out.append(raw_p(f'<font name="NaskhB" size="17" color="{hx(GREEN_DEEP)}">'
                     + esc(ar("خالصًا لوجهك، وانفع به كل من يقرأه وينشره")) + '</font>',
                     align=TA_CENTER, space_after=10))
    rule = Table([[""]], colWidths=[60 * mm], rowHeights=[1.2])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GOLD)]))
    t = Table([[rule]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    out += [t, Spacer(1, 12 * mm)]
    out.append(raw_p(f'<font name="NaskhB" size="14" color="{hx(GREEN)}">'
                     + esc(ar("آمين")) + '</font>', align=TA_CENTER, space_after=20))
    out.append(raw_p(f'<font name="Sans" size="9" color="{hx(GREY)}">'
                     + esc(ar("دليل تعريفي للمكتبة الإسلامية. كل ما ذُكر فيه مأخوذ من الموقع نفسه،"
                              " وما ذُكر من حدود فهو مُعلن فيه لا مُخفى."))
                     + '</font>', align=TA_CENTER))
    return out


# ─────────────────────────── القالب ───────────────────────────

def decorate(canvas, doc):
    canvas.saveState()
    page = canvas.getPageNumber()
    W, H = A4
    if page == 1:
        canvas.setFillColor(GREEN)
        canvas.rect(0, H - 14 * mm, W, 14 * mm, stroke=0, fill=1)
        canvas.setFillColor(GOLD)
        canvas.rect(0, H - 15.2 * mm, W, 1.2 * mm, stroke=0, fill=1)
        canvas.setFillColor(GREEN)
        canvas.rect(0, 0, W, 9 * mm, stroke=0, fill=1)
    else:
        canvas.setStrokeColor(SAND)
        canvas.setLineWidth(0.5)
        canvas.line(20 * mm, H - 16 * mm, W - 20 * mm, H - 16 * mm)
        canvas.setFillColor(GREEN)
        canvas.setFont("Sans", 8)
        canvas.drawRightString(W - 20 * mm, H - 13 * mm,
                               ar("المكتبة الإسلامية · نور الهدى وبوابة النور"))
        canvas.setFillColor(GREY)
        canvas.setFont("Sans", 8)
        canvas.drawString(20 * mm, 11 * mm, ar("كتالوج تعريفي"))
        canvas.drawRightString(W - 20 * mm, 11 * mm, str(page))
        canvas.setStrokeColor(SAND)
        canvas.line(20 * mm, 14 * mm, W - 20 * mm, 14 * mm)
    canvas.restoreState()


def build(out=None):
    """يبني الكتالوج في out (أو catalog.pdf)، ويجعله ثابت البايتات."""
    out = out or OUT
    rl_config.invariant = 1
    rl_config.unicodedata = "none"
    doc = BaseDocTemplate(out, pagesize=A4,
                          leftMargin=22 * mm, rightMargin=22 * mm,
                          topMargin=21 * mm, bottomMargin=18 * mm,
                          title="المكتبة الإسلامية — كتالوج تعريفي",
                          author="المكتبة الإسلامية", subject="نور الهدى · بوابة النور")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=decorate)])

    story = []
    for fn in (cover, toc, page_intro, page_site, page_app, page_tools, page_books,
               page_quran, page_calc, page_routine, page_features, page_privacy,
               page_quality, page_scholar, page_start, page_end):
        story += fn()
    os.makedirs(os.path.dirname(out), exist_ok=True)
    doc.build(story)
    return out


def check():
    """يفشل إن كان catalog.pdf أقدم من مصدره: الدليل لا يفترق عن الموقع."""
    with tempfile.TemporaryDirectory() as tmp:
        fresh = build(os.path.join(tmp, "catalog.pdf"))
        with open(fresh, "rb") as new, open(OUT, "rb") as shipped:
            if new.read() != shipped.read():
                raise SystemExit(
                    f"catalog.pdf لا يطابق ما في الموقع.\n"
                    f"شغّل: python3 scripts/make-catalog.py\n"
                    f"ثم ارفع الملف الناتج {OUT}")
    print("catalog.pdf مطابق للموقع.")


if __name__ == "__main__":
    if "--check" in sys.argv[1:]:
        check()
    else:
        print("written:", build())
