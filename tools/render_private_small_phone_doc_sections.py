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
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".qa" / "private-small-phone-doc-sections.pdf"
MARKERS = {
    "AI开发项目_项目说明文档.docx": "私人「小手机」真实 App 总纲与基础工程（2026-08-11）",
    "AI开发项目_Bug记录模板.docx": "私人 App 转向风险记录｜双控制器、工程缺失与方向误解（2026-08-11）",
    "AI开发项目_Bug修改规范.docx": "新增强制规范｜私人 App 单一总纲与单设备单控制器（2026-08-11 起）",
    "AI开发项目_新聊天启动说明.docx": "新聊天最高优先级｜私人「小手机」真实 App 已启动（2026-08-11）",
}

pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
styles = getSampleStyleSheet()
heading = ParagraphStyle("HeadingCN", parent=styles["Heading1"], fontName="STSong-Light", fontSize=17, leading=24, spaceAfter=10, alignment=TA_LEFT)
body = ParagraphStyle("BodyCN", parent=styles["BodyText"], fontName="STSong-Light", fontSize=10.5, leading=19, spaceAfter=8, alignment=TA_LEFT)

story = []
for index, (filename, marker) in enumerate(MARKERS.items()):
    paragraphs = [p.text.strip() for p in Document(DOCS / filename).paragraphs]
    start = paragraphs.index(marker)
    if index:
        story.append(PageBreak())
    story.append(Paragraph(escape(filename), body))
    story.append(Spacer(1, 3 * mm))
    for offset, value in enumerate(paragraphs[start:]):
        if value:
            story.append(Paragraph(escape(value), heading if offset == 0 else body))

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title="Private small-phone maintenance sections").build(story)
print(OUTPUT)
