"""
Generate the 30-day plan of action, re-confirming the original structural
audit (docs/frontend-audit-2026-08.md) against current main and sequencing
everything still open.

Reads /tmp/claude-0/.../scratchpad/ordered_items.json, produced by a
6-agent verification workflow plus a 7th adversarial cross-check on every
claim of "fixed" -- see this session's record for the full methodology and
per-finding evidence. That intermediate file is not committed; re-running
this exact script requires re-running the verification pass first. This
generator is committed so the document's structure and content are
reviewable and reproducible, not just the rendered PDF.

    pip install reportlab
    python3 tools/build-30day-plan.py

Output: docs/handoff/GLP1-Fund-30-day-plan.pdf
"""

import json
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, HRFlowable, PageBreak)

items = json.load(open('/tmp/claude-0/-home-user-GLP-Fund/0f201093-36df-5043-8858-6c139fc5618c/scratchpad/ordered_items.json'))
byid = {it['id']: it for it in items}

OUT = "/home/user/GLP-Fund/docs/handoff/GLP1-Fund-30-day-plan.pdf"

INK        = colors.HexColor("#14171a")
INK_SOFT   = colors.HexColor("#4a5259")
INK_FAINT  = colors.HexColor("#6b747c")
ACCENT     = colors.HexColor("#0b5c4a")
RULE       = colors.HexColor("#d8dde2")
SUNK       = colors.HexColor("#f4f6f8")
WARN       = colors.HexColor("#7a4b00")
WARN_BG    = colors.HexColor("#fff6e5")
STOP       = colors.HexColor("#8a1c11")
STOP_BG    = colors.HexColor("#fdecea")
GO         = colors.HexColor("#14603f")
GO_BG      = colors.HexColor("#e9f3ee")

S = lambda **k: ParagraphStyle(**k)
title   = S(name='t',  fontName='Helvetica-Bold', fontSize=19, leading=23, textColor=INK, spaceAfter=2)
sub     = S(name='s',  fontName='Helvetica', fontSize=10, leading=14, textColor=INK_SOFT, spaceAfter=8)
h2      = S(name='h2', fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=INK, spaceBefore=12, spaceAfter=4)
h3      = S(name='h3', fontName='Helvetica-Bold', fontSize=10.6, leading=13.5, textColor=ACCENT, spaceBefore=9, spaceAfter=2)
h2note  = S(name='h2n',fontName='Helvetica-Oblique', fontSize=9.2, leading=12.6, textColor=INK_FAINT, spaceAfter=6)
body    = S(name='b',  fontName='Helvetica', fontSize=9.5, leading=13, textColor=INK, spaceAfter=4)
small   = S(name='sm', fontName='Helvetica', fontSize=8.3, leading=11.2, textColor=INK_SOFT)
smallB  = S(name='smb', fontName='Helvetica-Bold', fontSize=8.3, leading=11.2, textColor=INK)
mono    = S(name='m',  fontName='Courier', fontSize=8, leading=10.8, textColor=INK)
tagS    = S(name='tg', fontName='Helvetica-Bold', fontSize=7.4, leading=9.6, textColor=colors.white)
tcell   = S(name='tc', fontName='Helvetica', fontSize=7.6, leading=10.2, textColor=INK)
tcellB  = S(name='tcb', fontName='Helvetica-Bold', fontSize=7.6, leading=10.2, textColor=INK)
th      = S(name='th', fontName='Helvetica-Bold', fontSize=7.2, leading=9.4, textColor=colors.white)

doc = BaseDocTemplate(OUT, pagesize=LETTER,
                      leftMargin=0.75*inch, rightMargin=0.75*inch,
                      topMargin=0.62*inch, bottomMargin=0.7*inch,
                      title="GLP-1 Price Check: 30-day plan of action",
                      author="Oak and Main Developers LLC")

def deco(canvas, d):
    canvas.saveState()
    canvas.setStrokeColor(RULE); canvas.setLineWidth(0.6)
    canvas.line(d.leftMargin, 0.55*inch, d.width + d.leftMargin, 0.55*inch)
    canvas.setFont('Helvetica', 7.6); canvas.setFillColor(INK_FAINT)
    canvas.drawString(d.leftMargin, 0.40*inch, "GLP-1 Price Check  |  structural audit re-confirmation + 30-day plan")
    canvas.drawRightString(d.width + d.leftMargin, 0.40*inch, "Page %d" % canvas.getPageNumber())
    canvas.setFillColor(ACCENT)
    canvas.rect(d.leftMargin, d.height + d.topMargin - 0.05*inch, d.width, 3, stroke=0, fill=1)
    canvas.restoreState()

frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height - 0.15*inch, id='n')
doc.addPageTemplates([PageTemplate(id='p', frames=[frame], onPage=deco)])

def pill(text, bg, fg=colors.white):
    st = ParagraphStyle(name='pillstyle', fontName='Helvetica-Bold', fontSize=7.4, leading=9.4, textColor=fg)
    t = Table([[Paragraph(text, st)]], colWidths=[len(text)*4.4 + 12])
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1), bg), ('LEFTPADDING',(0,0),(-1,-1),5),
        ('RIGHTPADDING',(0,0),(-1,-1),5), ('TOPPADDING',(0,0),(-1,-1),2),
        ('BOTTOMPADDING',(0,0),(-1,-1),2), ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    return t

def trunc_word(text, maxlen):
    text = (text or '').strip()
    if len(text) <= maxlen:
        return text
    cut = text[:maxlen]
    sp = cut.rfind(' ')
    if sp > maxlen * 0.6:
        cut = cut[:sp]
    return cut.rstrip(',;: ') + '...'

F = []

# ============================================================ PAGE 1: SUMMARY
F.append(Paragraph("30-day plan of action", title))
F.append(Paragraph(
    "Re-confirmation of docs/frontend-audit-2026-08.md (the original structural audit) against current main, "
    "commit 6c2e1df, plus every manual step and a sequenced 30-day roadmap for what remains. Six independent "
    "verification passes, one adversarial cross-check applied to every claim of ‘fixed.’", sub))

score_head = ParagraphStyle(name='scorehead', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=colors.white, alignment=1)
score_body = ParagraphStyle(name='scorebody', fontName='Helvetica', fontSize=9.5, leading=12, textColor=INK, alignment=1)
score = Table([
    [Paragraph("Critical", score_head), Paragraph("High", score_head), Paragraph("Medium (named)", score_head), Paragraph("Pattern", score_head)],
    [Paragraph("1 of 7 fixed", score_body), Paragraph("2 of 21 fixed", score_body), Paragraph("2 of 9 fixed, 1 partial", score_body), Paragraph("1 of 5 fixed", score_body)],
], colWidths=[doc.width/4.0]*4)
score.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0), INK), ('TEXTCOLOR',(0,0),(-1,0), colors.white),
    ('BACKGROUND',(0,1),(-1,1), SUNK), ('BOX',(0,0),(-1,-1),0.6,RULE), ('INNERGRID',(0,0),(-1,-1),0.6,RULE),
    ('ALIGN',(0,0),(-1,-1),'CENTER'), ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
]))
F.append(score)
F.append(Spacer(1,10))

F.append(Paragraph("Headline: none of this was in scope for the two PRs that just shipped", h2))
F.append(Paragraph(
    "PR#8 and PR#9 implemented a separate audit (image and content generation). Whatever overlaps with the "
    "original structural audit here is incidental. Of the 42 individually-named findings across critical, high, "
    "named-medium and pattern-underneath categories: <b>6 fixed, 1 partial, 35 still open.</b> The redesign-blocker "
    "checklist -- five items the original audit said must be resolved before any visual work begins -- is "
    "<b>zero of five resolved.</b>", body))

def callout(label, text, bg, border):
    t = Table([[Paragraph(f"<b>{label}</b> &nbsp; {text}", body)]], colWidths=[doc.width])
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1), bg), ('BOX',(0,0),(-1,-1),0,colors.white),
        ('LINEBEFORE',(0,0),(0,-1), 3, border),
        ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),8),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
    ]))
    return t

F.append(Spacer(1,6))
F.append(callout("C2 -- live right now:", "the staleness banner fires purely on data age with zero reference to "
    "whether anything is priced. Verified by execution against today's date: the site is currently telling "
    "visitors prices 'may be outdated' above a page where every single price is null. One-line fix.", STOP_BG, STOP))
F.append(Spacer(1,5))
F.append(callout("C4 -- the redesign trap:", "tools/qa.mjs still locates ~11 elements by CSS class name. Rename "
    ".card or .visually-hidden in a future redesign and the deploy gate reports a wrong price or a missing "
    "safety caveat -- not 'selector not found.' render.js still has zero direct tests.", WARN_BG, WARN))
F.append(Spacer(1,5))
F.append(callout("What still holds:", "the site's core invariant -- never render a price it hasn't verified -- "
    "was re-tested by injection and still holds. Nothing above touches the honesty. It's all delivery.", GO_BG, GO))

F.append(Spacer(1,10))
F.append(Paragraph("What this document contains", h2))
F.append(Paragraph(
    "<b>A.</b> Manual steps -- only you can do these, code cannot. &nbsp; "
    "<b>B.</b> A sequenced 30-day plan covering every remaining item, dev and owner alike. &nbsp; "
    "<b>C.</b> The full findings appendix: all 52 checked items (excluding exact duplicates), status, evidence "
    "and effort, for reference.", body))

F.append(PageBreak())

# ============================================================ SECTION A: MANUAL STEPS
F.append(Paragraph("A. Manual steps -- only you can do these", h2))
F.append(Paragraph(
    "Carried over from the prior handoff (docs/handoff/GLP1-Fund-remaining-actions.pdf) where still open, plus "
    "new items this re-confirmation surfaced. I cannot verify Cloudflare or email-provider state from this "
    "session -- if you've already done 1 or 2, check them off and move on.", h2note))

def task(n, heading, why, meta=None, bg=None):
    box = Table([['']], colWidths=[13], rowHeights=[13])
    box.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.9,INK), ('BACKGROUND',(0,0),(-1,-1),colors.white)]))
    inner = [Paragraph(f"{n}. {heading}", smallB), Spacer(1,1), Paragraph(why, small)]
    if meta:
        inner.append(Spacer(1,1))
        inner.append(Paragraph(meta, mono))
    t = Table([[box, inner]], colWidths=[22, doc.width-22])
    t.setStyle(TableStyle([
        ('VALIGN',(0,0),(0,0),'TOP'), ('VALIGN',(1,0),(1,0),'TOP'),
        ('TOPPADDING',(0,0),(-1,-1),5), ('BOTTOMPADDING',(0,0),(-1,-1),5),
        ('LEFTPADDING',(0,0),(0,0),0), ('LEFTPADDING',(1,0),(1,0),4),
        ('LINEBELOW',(0,0),(-1,-1),0.5,RULE),
    ] + ([('BACKGROUND',(0,0),(-1,-1),bg)] if bg else [])))
    return KeepTogether(t)

F.append(task(1, "Confirm the contact@glp1-fund.com mailbox actually receives mail",
    "It is printed on 4 pages as your corrections and CCPA/CPRA contact. If this was already done since the "
    "last handoff, check it off.", "public/engine/config.js -> PUBLISHER.email", WARN_BG))
F.append(task(2, "Confirm ALERTS_SECRET is set in Cloudflare Pages",
    "Unsubscribe fails closed without it. If already set, check it off.",
    "Cloudflare Pages -> Settings -> Functions -> Environment variables", WARN_BG))
F.append(task(3, "Send /privacy/ and /terms/ to a lawyer",
    "Confirmed still unreviewed as of this re-check. Both are accurate to what the code does; that is not the "
    "same as reviewed.", "public/privacy/index.html, public/terms/index.html", WARN_BG))
F.append(task(4, "Decide: is 730-day data retention correct for your business?",
    "I set a default and published it as a promise on the privacy page. Change it now, before anyone relies on it.",
    "public/engine/config.js -> DATA_RETENTION_DAYS"))
F.append(task(5, "Pick an email service and decide the alerts confirmation flow",
    "H5 confirmed unfixed: the alerts endpoint has no rate limiting and no confirmation step -- it will accept "
    "and store a breach dump, then eventually mail all of it. Decide now whether signup requires double opt-in "
    "(email a confirm link before indexing) or just rate limiting. This is a product decision before it is code.",
    "functions/api/alerts.js"))
F.append(task(6, "Decide the ad vendor before Content-Security-Policy can be written",
    "MEDIUM-5 confirmed unfixed: no CSP exists anywhere, on a site planning to inject third-party ad scripts "
    "into three slots. The CSP's script-src/frame-src depends entirely on which network you pick.",
    "public/_headers"))
F.append(task(7, "Decide: self-host a variable font, or accept fewer heading weights",
    "H21 confirmed unfixed: font-weight 650 collapses to bold on Android system fonts, flattening your whole "
    "heading hierarchy on the platform most of your traffic likely uses. The cheap fix (collapse to 400/700) "
    "is a visual decision, not just a code change.", "public/assets/css/base.css"))
F.append(task(8, "Verify actual prices",
    "Still blocked: every one of the 45 figures is unverified because this build's network refuses outbound "
    "connections to fda.gov, cms.gov, medicare.gov, trumprx.gov and all Lilly/Novo Nordisk domains. Needs a "
    "network that can reach them, or a manual read-and-paste of confirmed figures with citations."))

F.append(PageBreak())

# ============================================================ SECTION B: 30-DAY PLAN
F.append(Paragraph("B. 30-day plan of action", h2))
F.append(Paragraph(
    "Sequenced by dependency and blast radius, not by the audit's own severity labels. C2 is 'only' medium "
    "effort but it is live and wrong today, so it leads. Redesign-blocking work comes before polish, because "
    "every day without it compounds the risk of a future redesign misdiagnosing its own failures.", h2note))

def week_table(rows, colw=None):
    header = [Paragraph("ID", th), Paragraph("Action", th), Paragraph("Effort", th), Paragraph("Who", th)]
    data = [header]
    for r in rows:
        data.append([Paragraph(r[0], tcellB), Paragraph(r[1], tcell), Paragraph(r[2], tcell), Paragraph(r[3], tcell)])
    colw = colw or [0.95*inch, doc.width-0.95*inch-0.95*inch-0.5*inch, 0.95*inch, 0.5*inch]
    t = Table(data, colWidths=colw, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0), ACCENT),
        ('BOX',(0,0),(-1,-1),0.5,RULE), ('INNERGRID',(0,0),(-1,-1),0.4,RULE),
        ('VALIGN',(0,0),(-1,-1),'TOP'), ('TOPPADDING',(0,0),(-1,-1),3.2),('BOTTOMPADDING',(0,0),(-1,-1),3.2),
        ('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SUNK]),
    ]))
    return t

F.append(Paragraph("Week 1 &mdash; stop what's actively wrong, in parallel with owner items above", h3))
F.append(week_table([
    ("C2", "Filter overallStaleness() to priced results only. It is firing incorrectly right now.", "1 line + test", "Dev"),
    ("C1", "Add DOCTYPE + html lang=\"en\" to layout(); add compatMode/lang assertions to qa.mjs.", "3 lines", "Dev"),
    ("H13", "Add color-scheme:light (or a meta tag) so native controls stop rendering dark-on-white.", "1 line", "Dev"),
    ("C5", "Branch describeAge() on confidence so assistive text stops saying \"verified\" on unverified cards.", "Small", "Dev"),
    ("MEDIUM-3", "Validate officialUrl in validateDataset the same way source_url already is.", "Small", "Dev"),
    ("H9", "Add an /alerts/ link to the footer nav and/or a homepage callout.", "Small", "Dev"),
    ("C6", "Move aria-live off the whole results region; add a one-line status element outside it; debounce render().", "Small", "Dev"),
]))

F.append(Paragraph("Week 2 &mdash; redesign readiness (0 of 5 blockers resolved; do this before any visual work)", h3))
F.append(week_table([
    ("C4 / BLOCKER-1", "Convert qa.mjs's ~11 class-name selectors to data-* hooks, in lockstep with render.js/CSS.", "1-2 days", "Dev"),
    ("C4 / BLOCKER-2", "Add test/render.test.js: source link + date on every card, monthlyCost===null never numeric, suppressed pathways excluded.", "Half day", "Dev"),
    ("H8 / BLOCKER-3", "Content-hash CSS/JS filenames, or drop /assets/* to revalidate-always as a stopgap.", "Half-1 day", "Dev"),
    ("BLOCKER-4", "Sweep qa.mjs's fold/overflow checks across 320x568, 375x667, 390x844, 768x1024, 1440x900.", "Half day", "Dev"),
    ("H20 / BLOCKER-5", "Add Network.emulateNetworkConditions + Emulation.setCPUThrottlingRate to the CLS check.", "Half day", "Dev"),
    ("CONSTRAINT-1,3", "Move the CSS-URL-allowlist and affiliate-slot rules into v0-handoff.md, where a redesigner will actually look.", "Under 1 hr", "Dev"),
]))

F.append(Paragraph("Week 3 &mdash; accessibility and robustness (the rest of the 21 high-severity items)", h3))
F.append(week_table([
    ("H14", "Fix select/input border contrast (measured 1.72:1 / 1.86:1; needs 3:1 for SC 1.4.11).", "Small", "Dev"),
    ("H15,H16,H17", "Fix the dangling aria-labelledby, restore list semantics on the ranked results, move the cost line after the h3.", "Small", "Dev"),
    ("H18,H19", "Associate the alerts validation error via aria-describedby; re-enable the submit button on success.", "Small", "Dev"),
    ("H1,H2", "Stop the false permanent \"Loading\" state on failed fetch; add a fetch timeout/retry/abort.", "Small-Med", "Dev"),
    ("H3", "Add method=\"post\" action to the alerts form so no-JS visitors don't leak an email into the URL.", "Small", "Dev"),
    ("H4", "Make the two-step alerts KV write atomic-enough, or repair the index on the existing-subscriber path.", "Medium", "Dev"),
    ("H5", "Implement whatever Manual Step 5 decided: rate limiting and/or double opt-in.", "Medium", "Both"),
    ("H10,H11,H12", "Distinguish .empty from .ad-slot visually; move the disclaimer above the footer ad slot; fix print styles.", "Small-Med", "Dev"),
]))

F.append(Paragraph("Week 4 &mdash; polish, content debt, and the two design calls left for your eye", h3))
F.append(week_table([
    ("C7", "Split --measure into prose/app/data tokens with real breakpoints; bound .table-scroll's height.", "Half-1 day", "Dev"),
    ("PATTERN-2,4", "Fix the dead space under unverified cards; promote the \"none verified\" message out of the smallest type.", "Small", "Dev"),
    ("PATTERN-5", "Reorganize LillyDirect's caveats so the no-answer page isn't the longest read on the site.", "Small", "Dev"),
    ("MEDIUM-4,6,8,9", "Assert hasDataStamp in qa.mjs; consolidate .empty to one template; fix off-scale type and raw hex.", "Small-Med", "Dev"),
    ("H21", "Implement whatever Manual Step 7 decided about heading weights.", "Medium", "Both"),
    ("MEDIUM-5", "Write the CSP once Manual Step 6 names the ad vendor.", "Small", "Both"),
    ("Carried over", "Intro-pricing cliff diagram and empty-state redesign, from the prior handoff -- still deliberately unshipped design calls.", "Design review", "Owner"),
]))

F.append(Spacer(1,8))
F.append(Paragraph(
    "<b>Not on this calendar:</b> PATTERN-3 (renderSavings never fires) and real price verification. Both are "
    "the same underlying block -- nothing renders a saving until a real price is confirmed, and confirming a "
    "price needs the network access Manual Step 8 depends on. No amount of code work in weeks 1-4 moves this.",
    body))

F.append(PageBreak())

# ============================================================ SECTION C: APPENDIX
F.append(Paragraph("C. Full findings appendix", h2))
F.append(Paragraph(
    "All 52 distinct checked items (the 6 ‘if you do only five things’ entries are omitted here as exact "
    "duplicates of C1/C2/C3/C4/H6 above). STATUS reflects the adversarial cross-check, not the first-pass claim. "
    "Method: 6 parallel agents re-read current source and reproduced behaviour -- built the site, ran the engine "
    "directly, drove headless Chromium -- rather than trusting the original audit's prose; every FIXED claim was "
    "then independently re-checked by a 7th, adversarial agent before being accepted.",
    h2note))

STATUS_COLORS = {
    'FIXED': (GO, colors.white),
    'PARTIALLY_FIXED': (WARN, colors.white),
    'NOT_FIXED': (STOP, colors.white),
    'NO_LONGER_APPLICABLE': (INK_FAINT, colors.white),
}
STATUS_LABEL = {'FIXED':'FIXED','PARTIALLY_FIXED':'PARTIAL','NOT_FIXED':'OPEN','NO_LONGER_APPLICABLE':'N/A'}

SKIP_IDS = {'FIVE-1','FIVE-2','FIVE-3','FIVE-4','FIVE-5'}

header = [Paragraph("ID", th), Paragraph("Finding", th), Paragraph("Status", th), Paragraph("Effort", th)]
data = [header]
for it in items:
    if it['id'] in SKIP_IDS:
        continue
    bg, fg = STATUS_COLORS.get(it['status'], (INK_FAINT, colors.white))
    stcell = Table([[Paragraph(STATUS_LABEL.get(it['status'], it['status']), ParagraphStyle(name='sc', fontName='Helvetica-Bold', fontSize=6.6, leading=8, textColor=fg, alignment=1))]],
                   colWidths=[0.55*inch])
    stcell.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),bg), ('TOPPADDING',(0,0),(-1,-1),1.5),('BOTTOMPADDING',(0,0),(-1,-1),1.5), ('ALIGN',(0,0),(-1,-1),'CENTER')]))
    data.append([
        Paragraph(it['id'], tcellB),
        Paragraph(it['title'][:130] + ('...' if len(it['title'])>130 else ''), tcell),
        stcell,
        Paragraph(trunc_word(it.get('effort',''), 70), tcell),
    ])

colw = [0.92*inch, doc.width-0.92*inch-0.55*inch-1.05*inch, 0.55*inch, 1.05*inch]
t = Table(data, colWidths=colw, repeatRows=1)
t.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0), INK), ('TEXTCOLOR',(0,0),(-1,0), colors.white),
    ('BOX',(0,0),(-1,-1),0.5,RULE), ('INNERGRID',(0,0),(-1,-1),0.35,RULE),
    ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('TOPPADDING',(0,0),(-1,-1),1.8),('BOTTOMPADDING',(0,0),(-1,-1),1.8),
    ('LEFTPADDING',(0,0),(-1,-1),4),('RIGHTPADDING',(0,0),(-1,-1),4),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, SUNK]),
]))
F.append(t)


doc.build(F)
print("built", OUT)
