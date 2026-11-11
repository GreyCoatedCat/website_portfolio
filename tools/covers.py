"""Generates the layered SVG covers for the project tiles.

Each cover is three stacked SVG layers (base, middle, top). On hover the
layers separate in Z, so every cover reads as one flat picture at rest and as
a stack of planes when tilted.

Colours come from the page's CSS tokens (--ink, --paper, --acc-l and so on in
css/base.css), so changing a token there recolours every cover.
Run tools/inline_art.py after editing to write the covers into index.html.
"""
import math
import random


def fill(tok):
    return f'style="fill:var(--{tok})"'


def stroke(tok, w):
    return f'fill="none" style="stroke:var(--{tok})" stroke-width="{w}"'


def svg(body, i):
    return (
        f'<svg class="layer" style="--i:{i}" viewBox="0 0 100 100" '
        'preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' + body + "</svg>"
    )


def stack(layers):
    return "".join(svg(body, i) for i, body in enumerate(layers))


def curve(fn, start=0.004, n=120, clip=4.2):
    pts = []
    for i in range(n + 1):
        yh = start + i * ((1 - start) / n)
        loss = fn(yh)
        if loss > clip:
            continue
        pts.append(f"{14 + yh * 72:.1f},{86 - (loss / 4) * 72:.1f}")
    return " ".join(pts)


def proposed():
    # loss vs. confidence in the true class: the published baselines, plus the proposed loss in the accent colour
    rings = "".join(
        f'<rect x="{4 + i * 6}" y="{4 + i * 6}" width="{92 - i * 12}" height="{92 - i * 12}"/>'
        for i in range(8)
    )
    base = (
        f'<rect width="100" height="100" {fill("ink")}/><g {stroke("mid", .5)} opacity=".7">{rings}</g>'
        f'<path d="M14 10V86H90" {stroke("paper", .7)}/>'
    )
    ce = curve(lambda y: -math.log(y), start=0.012)
    focal = curve(lambda y: -((1 - y) ** 2) * math.log(y), start=0.012)
    poly = curve(lambda y: -math.log(y) + 2 * (1 - y), start=0.012)
    gce = curve(lambda y: (1 - y ** 0.7) / 0.7, start=0.004)
    label = 'font-size="3.7" font-family="Overpass, Archivo, sans-serif"'
    legend = ""
    for i, (name, tok, dash) in enumerate([("Cross-entropy", "paper", ""), ("Focal", "soft", ""), ("PolyLoss", "paper", ' stroke-dasharray="2.4 1.4"'), ("GCE", "soft", ' stroke-dasharray="1 1.4"')]):
        y = 16 + i * 6
        legend += f'<path d="M60 {y}H67" {stroke(tok, 1.1)}{dash}/><text x="69" y="{y + 1.3}" {label} {fill(tok)}>{name}</text>'
    mid = (
        f'<polyline points="{ce}" {stroke("paper", 1.2)}/>'
        f'<polyline points="{focal}" {stroke("soft", 1.2)}/>'
        f'<polyline points="{poly}" {stroke("paper", .9)} stroke-dasharray="2.4 1.4"/>'
        f'<polyline points="{gce}" {stroke("soft", .9)} stroke-dasharray="1 1.4"/>'
        + legend
    )
    # illustrative only: a generic curve for the proposed loss, not drawn from its real formula
    proposed_curve = curve(lambda y: -1.3 * math.log(y), start=0.012)
    top = (
        f'<polyline points="{proposed_curve}" {stroke("acc-d", 2.2)}/>'
        f'<rect x="60" y="38.6" width="7" height="2.8" {fill("acc-fill")}/>'
        f'<text x="69" y="41.3" {label} font-weight="700" {fill("acc-d")}>Proposed</text>'
    )
    return stack([base, mid, top])


def teliti():
    xs = [7, 25, 43, 61, 79]
    flagged = (3, 2)
    base = f'<rect width="100" height="100" {fill("mid")}/>'
    base += f'<g {stroke("soft", .5)}>' + "".join(
        f'<rect x="{x - 1.5}" y="{y - 1.5}" width="17" height="17"/>' for x in xs for y in xs
    ) + "</g>"
    cells, l1, l2 = "", "", ""
    for ci, x in enumerate(xs):
        for ri, y in enumerate(xs):
            if (ci, ri) == flagged:
                continue
            cells += f'<rect x="{x}" y="{y}" width="14" height="14"/>'
            l1 += f'<rect x="{x + 2.5}" y="{y + 3}" width="9" height="1.5"/>'
            l2 += (
                f'<rect x="{x + 2.5}" y="{y + 6.4}" width="6" height="1.5"/>'
                f'<rect x="{x + 2.5}" y="{y + 9.8}" width="7.5" height="1.5"/>'
            )
    mid = f'<g {fill("ink")}>{cells}</g><g {fill("paper")}>{l1}</g><g {fill("soft")}>{l2}</g>'
    fx, fy = xs[flagged[0]], xs[flagged[1]]
    top = (
        # the flagged posting: an accent card with dark lines, ringed
        f'<rect x="{fx}" y="{fy}" width="14" height="14" {fill("acc-fill")}/>'
        f'<g {fill("ink")}><rect x="{fx + 2.5}" y="{fy + 3}" width="9" height="1.5"/>'
        f'<rect x="{fx + 2.5}" y="{fy + 6.4}" width="6" height="1.5"/><rect x="{fx + 2.5}" y="{fy + 9.8}" width="7.5" height="1.5"/></g>'
        f'<rect x="{fx - 5}" y="{fy - 5}" width="24" height="24" {stroke("ink", 1.3)}/>'
    )
    return stack([base, mid, top])


def high5():
    keys, centers = "", []
    for i in range(7):
        x = 5 + i * 13
        centers.append(x + 6)
        keys += f'<rect x="{x}" y="34" width="12" height="58"/>'
    base = f'<rect width="100" height="100" {fill("void")}/><g {fill("paper")}>{keys}</g>'
    mid = f'<g {fill("void")}>' + "".join(
        f'<rect x="{5 + 12 * (i + 1) + i + 0.5 - 3.5}" y="34" width="7" height="34"/>' for i in (0, 1, 3, 4, 5)
    ) + "</g>"
    fingers, lines = "", ""
    for i in (0, 1, 2, 4, 6):
        c = centers[i]
        fingers += f'<rect x="{c - 4}" y="12" width="8" height="8"/><rect x="{c - 6}" y="83" width="12" height="9"/>'
        lines += f'<rect x="{c - 0.4}" y="20" width=".8" height="12"/>'
    top = f'<g style="fill:var(--acc-fill);stroke:var(--void)" stroke-width=".5">{fingers}</g><g {fill("acc-d")}>{lines}</g>'
    return stack([base, mid, top])


def rag():
    cpu = [(8, 30), (25, 30), (8, 47), (25, 47)]
    gpu = [(53 + c * 5, 27 + r * 5) for r in range(8) for c in range(8)]
    base = f'<rect width="100" height="100" {fill("mid")}/>'
    base += f'<g {stroke("paper", .8)}>' + "".join(f'<rect x="{x}" y="{y}" width="15" height="15"/>' for x, y in cpu) + "</g>"
    base += f'<g {stroke("soft", .4)}>' + "".join(f'<rect x="{x}" y="{y}" width="4" height="4"/>' for x, y in gpu) + "</g>"
    base += (
        f'<g font-size="5" font-family="Archivo, sans-serif" {fill("paper")}>'
        '<text x="8" y="76">CPU</text><text x="53" y="76">GPU</text></g>'
    )
    mid = f'<g {fill("paper")}>' + "".join(f'<rect x="{x}" y="{y}" width="15" height="15"/>' for x, y in cpu[:2]) + "</g>"
    mid += f'<g {fill("ink")}>' + "".join(f'<rect x="{x}" y="{y}" width="4" height="4"/>' for x, y in gpu) + "</g>"
    top = f'<path d="M40 46H51" {stroke("acc-d", 1.2)}/>'
    top += f'<g {fill("acc-fill")}>' + "".join(
        f'<rect x="{53 + c * 5}" y="{27 + r * 5}" width="4" height="4"/>' for r in range(2, 6) for c in range(8)
    ) + "</g>"
    return stack([base, mid, top])


def kvcache():
    rnd = random.Random(7)
    xs = [7 + i * 11 for i in range(8)]
    base = (
        f'<rect width="100" height="100" {fill("paper-hi")}/>'
        f'<rect x=".75" y=".75" width="98.5" height="98.5" {stroke("ink", 1.5)}/>'
    )
    base += f'<g {stroke("soft", .5)}>' + "".join(
        f'<rect x="{x}" y="{y}" width="9" height="9"/>' for x in xs for y in xs
    ) + "</g>"
    kept = ""
    for ci, x in enumerate(xs):
        for y in xs:
            # first column = attention-sink tokens, last two = the recent window: always kept
            if ci == 0 or ci >= 6 or rnd.random() < 0.45:
                kept += f'<rect x="{x}" y="{y}" width="9" height="9"/>'
    mid = f'<g {fill("ink")}>{kept}</g>'
    pts = [(10, 14), (22, 20), (34, 28), (46, 38), (58, 50), (72, 64), (88, 82)]
    d = f"M{pts[0][0]} {pts[0][1]}" + "".join(f"H{x}V{y}" for x, y in pts[1:])
    top = (
        f'<path d="{d}" {stroke("paper-hi", 3.6)}/>'
        f'<path d="{d}" {stroke("acc-l", 1.6)}/>'
        f'<g style="fill:var(--acc-l);stroke:var(--paper-hi)" stroke-width=".9">'
        + "".join(f'<rect x="{x - 2.6}" y="{y - 2.6}" width="5.2" height="5.2"/>' for x, y in pts)
        + "</g>"
    )
    return stack([base, mid, top])


def dica():
    # object detection on a plate: viewfinder, food, and the model's boxes with confidence tabs
    grid = "".join(f'<path d="M{x} 0V100"/>' for x in range(10, 100, 10)) + "".join(f'<path d="M0 {y}H100"/>' for y in range(10, 100, 10))
    base = (
        f'<rect width="100" height="100" {fill("ink")}/>'
        f'<g style="stroke:var(--mid)" stroke-width=".35" opacity=".7">{grid}</g>'
        f'<path d="M6 16V6H16M84 6H94V16M94 84V94H84M16 94H6V84" {stroke("paper", 1.1)}/>'
    )
    mid = (
        f'<circle cx="50" cy="54" r="31" {fill("paper")}/>'
        f'<circle cx="50" cy="54" r="25" {stroke("soft", .7)}/>'
        f'<circle cx="40" cy="45" r="9" {fill("mid")}/>'
        f'<rect x="51" y="51" width="14" height="14" {fill("ink")}/>'
        f'<path d="M34 72H52L43 58Z" {fill("soft")}/>'
    )
    boxes = [(29, 34, 22, 22, "0.97"), (48, 48, 20, 20, "0.91"), (31, 55, 23, 19, "0.88")]
    top = ""
    for x, y, w, h, conf in boxes:
        top += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" {stroke("acc-l", 1.1)}/>'
        top += f'<rect x="{x}" y="{y - 5.5}" width="12" height="5.5" {fill("acc-fill")}/>'
        top += f'<text x="{x + 1.2}" y="{y - 1.6}" font-size="3.8" font-weight="700" font-family="Overpass, Archivo, sans-serif" {fill("ink")}>{conf}</text>'
    return stack([base, mid, top])


def tb():
    # a chest X-ray: torso and ribs behind, lungs and a spine of blocks, then the segmentation outline and the call
    lab = 'font-family="Overpass, Archivo, sans-serif" font-weight="700"'
    base = (
        f'<rect width="100" height="100" {fill("ink")}/>'
        f'<rect x="8" y="8" width="84" height="84" {stroke("mid", .6)}/>'
        f'<path d="M18 92C18 62 20 36 33 24C39 19 45 17 50 17C55 17 61 19 67 24C80 36 82 62 82 92Z" {fill("mid")}/>'
    )
    left = "M45 27C37 25 27 35 25 51C23 65 25 75 31 79C37 81 43 77 45 71Z"
    right = "M55 27C63 25 73 35 75 51C77 65 75 75 69 79C63 81 57 77 55 71Z"
    ribs = "".join(f'<path d="M24 {33 + i * 8}Q50 {25 + i * 8} 76 {33 + i * 8}"/>' for i in range(6))
    spine = "".join(f'<rect x="47.2" y="{20 + i * 6.2:.1f}" width="5.6" height="4.4"/>' for i in range(11))
    mid = (
        f'<path d="{left}" {fill("ink")}/><path d="{right}" {fill("ink")}/>'
        f'<g {stroke("soft", .55)} opacity=".55">{ribs}</g>'
        f'<g {fill("soft")} opacity=".8">{spine}</g>'
    )
    top = (
        f'<path d="{left}" {stroke("acc-l", 1.2)}/><path d="{right}" {stroke("acc-l", 1.2)}/>'
        f'<path d="M14 22V14H22M78 14H86V22M86 78V86H78M22 86H14V78" {stroke("paper", 1)}/>'
        f'<rect x="61" y="19" width="17" height="6" {fill("acc-fill")}/>'
        f'<text x="62.3" y="23.4" font-size="3.9" {lab} {fill("ink")}>TB 0.92</text>'
    )
    return stack([base, mid, top])


def dream():
    # Mimpi Sang Pemikir: a night sky with a crescent moon over the maze of the first puzzle, and the way out
    rng = random.Random(11)
    n, x0, y0, c = 7, 14.0, 21.0, 72 / 7
    walls = {(x, y, d) for x in range(n) for y in range(n) for d in "ES"}  # wall east of / south of each cell
    seen, todo = {(0, 0)}, [(0, 0)]
    while todo:  # carve a perfect maze, depth first
        x, y = todo[-1]
        nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < n and 0 <= y + dy < n and (x + dx, y + dy) not in seen]
        if not nb:
            todo.pop()
            continue
        nx, ny = rng.choice(nb)
        if nx != x:
            walls.discard((min(x, nx), y, "E"))
        else:
            walls.discard((x, min(y, ny), "S"))
        seen.add((nx, ny))
        todo.append((nx, ny))

    def open_(a, b):
        (ax, ay), (bx, by) = a, b
        if ay == by:
            return (min(ax, bx), ay, "E") not in walls
        return (ax, min(ay, by), "S") not in walls

    prev, queue = {(0, 0): None}, [(0, 0)]
    for cell in queue:  # breadth first from the entrance to find the way out
        x, y = cell
        for nb in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nb[0] < n and 0 <= nb[1] < n and nb not in prev and open_(cell, nb):
                prev[nb] = cell
                queue.append(nb)
    path, cell = [], (n - 1, n - 1)
    while cell:
        path.append(cell)
        cell = prev[cell]
    path.reverse()

    def ctr(cell):
        return f"{x0 + (cell[0] + 0.5) * c:.1f},{y0 + (cell[1] + 0.5) * c:.1f}"

    segs = ""
    for x, y, d in walls:
        if d == "E" and x < n - 1:
            segs += f"M{x0 + (x + 1) * c:.1f} {y0 + y * c:.1f}V{y0 + (y + 1) * c:.1f}"
        if d == "S" and y < n - 1:
            segs += f"M{x0 + x * c:.1f} {y0 + (y + 1) * c:.1f}H{x0 + (x + 1) * c:.1f}"
    stars = "".join(f'<rect x="{sx}" y="{sy}" width="1.3" height="1.3"/>' for sx, sy in ((10, 8), (22, 13), (35, 6), (47, 12), (58, 7), (66, 14), (6, 15)))
    base = (
        f'<rect width="100" height="100" {fill("ink")}/>'
        f'<g {fill("soft")} opacity=".8">{stars}</g>'
        f'<path d="M86 4.5a6.5 6.5 0 1 0 5 11.2 5.2 5.2 0 1 1-5-11.2Z" {fill("paper")}/>'
        f'<rect x="{x0}" y="{y0}" width="72" height="72" {fill("mid")} opacity=".35"/>'
    )
    edge = c  # entrance on the top left, exit on the bottom right
    mid = (
        f'<path d="{segs}" {stroke("paper", 1.5)} stroke-linecap="square"/>'
        f'<path d="M{x0 + edge:.1f} {y0}H{x0 + 72}V{y0 + 72}M{x0 + 72 - edge:.1f} {y0 + 72}H{x0}V{y0}" {stroke("paper", 1.5)} stroke-linecap="square"/>'
    )
    pts = " ".join(ctr(p) for p in path)
    top = (
        f'<polyline points="{x0 + 0.5 * c:.1f},{y0 - 4} {pts} {x0 + 72 - 0.5 * c:.1f},{y0 + 76}" {stroke("acc-l", 2.2)} stroke-linejoin="round"/>'
        f'<rect x="{x0 + 0.5 * c - 3.2:.1f}" y="{y0 - 9}" width="6.4" height="6.4" {fill("soft")}/>'
        f'<rect x="{x0 + 0.5 * c - 1.9:.1f}" y="{y0 - 7.2}" width="1.1" height="1.6" {fill("ink")}/>'
        f'<rect x="{x0 + 0.5 * c + 0.8:.1f}" y="{y0 - 7.2}" width="1.1" height="1.6" {fill("ink")}/>'
    )
    return stack([base, mid, top])


COVERS = {
    "proposed": proposed,
    "teliti": teliti,
    "high5": high5,
    "rag": rag,
    "kvcache": kvcache,
    "dica": dica,
    "tb": tb,
    "dream": dream,
}
