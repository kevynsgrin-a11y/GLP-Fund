"""
Generate the printable remaining-actions sheet.

Produced after the autonomous pass over docs/image-content-audit-2026-08.md,
listing only what could not be finished in code: owner actions, the two design
items left for review, and the one item blocked by network egress.

    pip install reportlab
    python3 tools/build-handoff-pdf.py

Output: docs/handoff/GLP1-Fund-remaining-actions.pdf
"""

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, HRFlowable)

OUT = "/home/user/GLP-Fund/docs/handoff/GLP1-Fund-remaining-actions.pdf"

INK        = colors.HexColor("#14171a")
INK_SOFT   = colors.HexColor("#4a5259")
INK_FAINT  = colors.HexColor("#6b747c")
ACCENT     = colors.HexColor("#0b5c4a")
RULE       = colors.HexColor("#d8dde2")
SUNK       = colors.HexColor("#f4f6f8")
WARN       = colors.HexColor("#7a4b00")
WARN_BG    = colors.HexColor("#fff6e5")
STOP       = colors.HexColor("#8a1c11")

S = lambda **k: ParagraphStyle(**k)
title   = S(name='t',  fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=INK, spaceAfter=2)
sub     = S(name='s',  fontName='Helvetica', fontSize=10.5, leading=14.5, textColor=INK_SOFT, spaceAfter=10)
h2      = S(name='h2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=INK, spaceBefore=12, spaceAfter=3)
h2note  = S(name='h2n',fontName='Helvetica-Oblique', fontSize=9.5, leading=13, textColor=INK_FAINT, spaceAfter=6)
body    = S(name='b',  fontName='Helvetica', fontSize=9.8, leading=13.6, textColor=INK, spaceAfter=5)
small   = S(name='sm', fontName='Helvetica', fontSize=8.6, leading=11.8, textColor=INK_SOFT)
mono    = S(name='m',  fontName='Courier', fontSize=8.6, leading=11.6, textColor=INK)
itemh   = S(name='ih', fontName='Helvetica-Bold', fontSize=10, leading=13.4, textColor=INK, spaceAfter=2)
itemb   = S(name='ib', fontName='Helvetica', fontSize=9.2, leading=12.4, textColor=INK_SOFT, spaceAfter=2)
tagS    = S(name='tg', fontName='Helvetica-Bold', fontSize=7.6, leading=10, textColor=colors.white)

doc = BaseDocTemplate(OUT, pagesize=LETTER,
                      leftMargin=0.85*inch, rightMargin=0.85*inch,
                      topMargin=0.62*inch, bottomMargin=0.7*inch,
                      title="GLP-1 Price Check: remaining actions",
                      author="Oak and Main Developers LLC")

def deco(canvas, d):
    canvas.saveState()
    canvas.setStrokeColor(RULE); canvas.setLineWidth(0.6)
    canvas.line(d.leftMargin, 0.58*inch, d.width + d.leftMargin, 0.58*inch)
    canvas.setFont('Helvetica', 7.8); canvas.setFillColor(INK_FAINT)
    canvas.drawString(d.leftMargin, 0.42*inch, "GLP-1 Price Check  |  remaining actions after the autonomous audit pass")
    canvas.drawRightString(d.width + d.leftMargin, 0.42*inch, "Page %d" % canvas.getPageNumber())
    canvas.setFillColor(ACCENT)
    canvas.rect(d.leftMargin, d.height + d.topMargin - 0.06*inch, d.width, 3.2, stroke=0, fill=1)
    canvas.restoreState()

frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height - 0.18*inch, id='n')
doc.addPageTemplates([PageTemplate(id='p', frames=[frame], onPage=deco)])

def tag(text, bg):
    t = Table([[Paragraph(text, tagS)]], colWidths=[len(text)*4.9 + 12])
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1), bg), ('LEFTPADDING',(0,0),(-1,-1),5),
        ('RIGHTPADDING',(0,0),(-1,-1),5), ('TOPPADDING',(0,0),(-1,-1),2.5),
        ('BOTTOMPADDING',(0,0),(-1,-1),2.5), ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    return t

def task(n, heading, why, how, meta, bg=None):
    """A checkbox row: [ ]  N. Heading / why / how"""
    box = Table([['']], colWidths=[13], rowHeights=[13])
    box.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.9,INK), ('BACKGROUND',(0,0),(-1,-1),colors.white)]))
    inner = [Paragraph(f"{n}. {heading}", itemh), Paragraph(why, itemb)]
    if how:
        inner.append(Spacer(1,1))
        inner.append(Paragraph(how, mono))
    if meta:
        inner.append(Spacer(1,2))
        inner.append(Paragraph(meta, small))
    t = Table([[box, inner]], colWidths=[24, doc.width-24])
    t.setStyle(TableStyle([
        ('VALIGN',(0,0),(0,0),'TOP'), ('VALIGN',(1,0),(1,0),'TOP'),
        ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('LEFTPADDING',(0,0),(0,0),0), ('LEFTPADDING',(1,0),(1,0),4),
        ('LINEBELOW',(0,0),(-1,-1),0.5,RULE),
    ] + ([('BACKGROUND',(0,0),(-1,-1),bg)] if bg else [])))
    return KeepTogether(t)

F = []
F.append(Paragraph("Remaining actions", title))
F.append(Paragraph(
    "Everything in the image and content audit that could be completed in code has been. "
    "This is what is left: work only you can do, plus two design items deliberately left for review. "
    "Printed to be worked through in one sitting.", sub))

info = Table([[
    Paragraph("<b>Publisher</b><br/>Oak and Main Developers LLC<br/>2108 N St., Sacramento, CA 95816", small),
    Paragraph("<b>Shipped this pass</b><br/>6 commits, 19 pages<br/>118 tests, browser QA 25/25", small),
    Paragraph("<b>Branch</b><br/>claude/glp1-fund-<br/>frontend-audit-upw4ec", small),
]], colWidths=[doc.width/3.0]*3)
info.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,-1), SUNK), ('BOX',(0,0),(-1,-1),0.6,RULE),
    ('INNERGRID',(0,0),(-1,-1),0.6,RULE), ('VALIGN',(0,0),(-1,-1),'TOP'),
    ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
    ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
]))
F.append(info)

# ---------------- A. BLOCKS LAUNCH ----------------
F.append(Paragraph("A. Blocks launch", h2))
F.append(Paragraph("The site now collects personal data and promises things that need these to be true. "
                   "Do these before the site takes another signup.", h2note))

F.append(task(1, "Create the contact@glp1-fund.com mailbox",
    "You gave an entity and an address but no email, so I wired a placeholder on your own domain rather than "
    "invent a third-party address or publish your personal Gmail. It is now printed on four pages as the "
    "corrections channel, the privacy contact and the CCPA/CPRA request route. Until the mailbox exists, "
    "those pages promise a channel that bounces.",
    "public/engine/config.js &rarr; PUBLISHER.email",
    "If you would rather use a different address, change that one constant and rebuild. It flows everywhere.",
    WARN_BG))

F.append(task(2, "Set the ALERTS_SECRET binding in Cloudflare",
    "The unsubscribe endpoint signs its links with HMAC so a stranger cannot remove someone else's address. "
    "Without the secret it fails closed: unsubscribe returns an error rather than deleting anything. Signup is "
    "unaffected, so this will not look broken until someone tries to leave.",
    "Cloudflare Pages &rarr; Settings &rarr; Functions &rarr; Environment variables &rarr; ALERTS_SECRET",
    "Any long random string. Generate with: openssl rand -hex 32",
    WARN_BG))

F.append(task(3, "Have a lawyer read /privacy/ and /terms/",
    "Both are written against what the code actually does rather than from a template: the privacy policy names "
    "all five stored fields, both KV locations, the retention window and the CCPA/CPRA and GDPR rights. That "
    "makes them accurate, not reviewed. A California LLC collecting email addresses on a health-adjacent site "
    "should have a professional read them once.",
    "public/privacy/index.html and public/terms/index.html",
    "Both are generated. Edit the builders in tools/build-pages.mjs, not the HTML, then rebuild.",
    WARN_BG))

F.append(task(4, "Decide the data retention period",
    "I set 730 days after last interaction and published it as a promise. It is a reasonable default, not your "
    "decision. If you want a different window, change it before anyone reads the policy and relies on it.",
    "public/engine/config.js &rarr; DATA_RETENTION_DAYS",
    None))

# ---------------- B. BEFORE FIRST EMAIL ----------------
F.append(Paragraph("B. Before the first alert email goes out", h2))
F.append(Paragraph("The list can accept signups today. It cannot lawfully send yet.", h2note))

F.append(task(5, "Build the send path, with the unsubscribe link in it",
    "There is no email-sending code anywhere in the project. The unsubscribe endpoint and its token signer are "
    "built and tested, but nothing generates the links yet. CAN-SPAM requires a working opt-out in every "
    "message, and the alerts page promises one-click.",
    "signUnsubscribe(email, env.ALERTS_SECRET) in functions/api/alerts.js<br/>"
    "link: https://glp1-fund.com/api/alerts?unsubscribe=EMAIL&amp;t=TOKEN",
    "Also set the List-Unsubscribe and List-Unsubscribe-Post headers so one-click works in Gmail and Apple Mail. "
    "The endpoint already answers the RFC 8058 POST."))

F.append(task(6, "Add a physical postal address to the email footer",
    "CAN-SPAM requires it in the message itself, not only on the website. Your address is already in config and "
    "renders on four pages, so it is a copy-paste into the template.",
    "PUBLISHER_ADDRESS in public/engine/config.js",
    None))

# ---------------- C. DESIGN, LEFT FOR YOUR EYE ----------------
F.append(Paragraph("C. Design work left for your review", h2))
F.append(Paragraph("I could have shipped these. I chose not to, because both are judgment calls about how the "
                   "site looks rather than defects, and you said the rest of the audits land tonight.", h2note))

F.append(task(7, "The introductory-pricing cliff diagram",
    "The caveat now renders as a weighted warning block on all five pages whose data carries it, which was the "
    "urgent half. The audit also proposed drawing the cliff: what you pay at first, what you pay after, and what "
    "triggers the change. That is a genuine design decision and it sits on pages about money, so it wants your eye.",
    "Prompt P3 in docs/image-content-audit-2026-08.md",
    "Constraints are in the prompt: inline SVG only, HTML labels not SVG text, seven-element vocabulary."))

F.append(task(8, "Empty-state visual treatment",
    "All 45 rows are null, so the no-verified-price state is the site's dominant visual state and still renders "
    "as grey blocks. The homepage now states the position in plain type above it, which was the worst of it. The "
    "block itself is authored in five places across three files, so redesigning it is a real change rather than "
    "a tweak, and worth doing deliberately.",
    "app.js:66,72,157 &nbsp; render.js:231 &nbsp; build-pages.mjs:362",
    "Prompt P5. Do not change ad-slot dimensions: they are CLS controls gated by qa.mjs."))

# ---------------- D. BLOCKED ----------------
F.append(Paragraph("D. Blocked, not forgotten", h2))

F.append(task(9, "Verify actual prices",
    "Every one of the 45 figures is unverified because this build's network refuses outbound connections to "
    "every primary source: fda.gov, cms.gov, medicare.gov, trumprx.gov and all Eli Lilly and Novo Nordisk "
    "domains. QA confirms 8 of 8 source URLs unreachable for that reason, not because they are broken. Nothing "
    "in code fixes this. It needs a network that can reach them.",
    None,
    "When the first real price lands, test 42 and test 71 must be relaxed. The new provenance gate "
    "(test/provenance.test.js) then becomes the real check and needs no change."))

closing = [
    Spacer(1, 10),
    HRFlowable(width="100%", thickness=0.6, color=RULE),
    Spacer(1, 8),
    Paragraph("One thing worth protecting", ParagraphStyle(name='pf', fontName='Helvetica-Bold',
                                                          fontSize=10.5, leading=14, textColor=ACCENT, spaceAfter=3)),
    Paragraph(
    "Everything above adds to the site. Nothing above softens it. The refusal to publish a figure that has not "
    "been read from a primary source is the most valuable thing this project has, and it is now enforced by a "
    "test that keeps working after you start publishing prices rather than one that expires on that day. "
    "The fastest way to undo this pass would be to fill the silence with confident numbers.", body),
]
# Keep the closing note whole: the heading orphaned onto its own page otherwise.
F.append(KeepTogether(closing))

doc.build(F)
print("built", OUT)
