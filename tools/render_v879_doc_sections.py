import sys
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "maintenance"
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".qa" / "v879-maintenance-sections.pdf"
MARKERS = {
    "AI开发项目_项目说明文档.docx": "v879｜共同生活上下文与苹果全局适配（2026-08-10）",
    "AI开发项目_Bug记录模板.docx": "v879 Bug 记录｜共同生活上下文错位、主动消息越界与苹果独立 App 偏移（2026-08-10）",
    "AI开发项目_Bug修改规范.docx": "新增强制规范｜共同生活、线下和微信必须以实时状态统一判定（v879 起）",
    "AI开发项目_新聊天启动说明.docx": "新聊天接手状态｜v879 共同生活上下文与苹果全局适配发布路线（2026-08-10）",
}

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
styles = getSampleStyleSheet()
heading = ParagraphStyle("ChineseHeading", parent=styles["Heading1"], fontName="STSong-Light", fontSize=17, leading=24, spaceAfter=10, alignment=TA_LEFT)
body = ParagraphStyle("ChineseBody", parent=styles["BodyText"], fontName="STSong-Light", fontSize=10.5, leading=19, spaceAfter=8, alignment=TA_LEFT)

story = []
for index, (filename, marker) in enumerate(MARKERS.items()):
    document = Document(DOCS / filename)
    paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs]
    start = paragraphs.index(marker)
    if index:
        story.append(PageBreak())
    story.append(Paragraph(escape(filename), body))
    story.append(Spacer(1, 3 * mm))
    for offset, value in enumerate(paragraphs[start:]):
        if value:
            story.append(Paragraph(escape(value), heading if offset == 0 else body))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title="v879 maintenance sections").build(story)
print(OUTPUT)
