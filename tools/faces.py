"""Illustrations for the six faces of the About cube, one per focus area.

Each face is a 100x100 SVG; the bottom ~22 units stay clear for the label chip.
"""
import math

INK = "#0B0F15"
BONE = "#E9E4D8"
ORANGE = "#FF6A2B"
AMBER = "#F2B544"
STEEL = "#3E5468"
STEEL_LT = "#5A6B80"
SLATE = "#8FA3B0"
NAVY = "#0E1620"


def svg(body):
    return (
        '<svg class="face-art" viewBox="0 0 100 100" aria-hidden="true" '
        'xmlns="http://www.w3.org/2000/svg">' + body + "</svg>"
    )


def sq(cx, cy, s, attrs):
    return f'<rect x="{cx - s / 2:.1f}" y="{cy - s / 2:.1f}" width="{s}" height="{s}" {attrs}/>'


def ai():
    l1 = [(16, 14), (16, 34), (16, 54)]
    l2 = [(46, 8), (46, 26), (46, 44), (46, 62)]
    l3 = [(78, 24), (78, 46)]
    edges = "".join(f'<path d="M{a[0]} {a[1]}L{b[0]} {b[1]}"/>' for a in l1 for b in l2)
    edges += "".join(f'<path d="M{a[0]} {a[1]}L{b[0]} {b[1]}"/>' for a in l2 for b in l3)
    body = f'<g stroke="{INK}" stroke-width=".7" opacity=".55">{edges}</g>'
    body += f'<path d="M16 34L46 26L78 46" fill="none" stroke="{BONE}" stroke-width="2"/>'
    hot = {(16, 34), (46, 26), (78, 46)}
    for p in l1 + l2 + l3:
        if p in hot:
            body += sq(p[0], p[1], 9, f'fill="{BONE}" stroke="{INK}" stroke-width="1.2"')
        else:
            body += sq(p[0], p[1], 8, f'fill="{INK}"')
    return svg(body)


def ml():
    line_y = lambda x: 66 - 0.692 * (x - 12)
    body = f'<path d="M12 6V72H92" fill="none" stroke="{INK}" stroke-width=".9"/>'
    # margins either side of the boundary, as in a support vector machine
    for off in (-7, 7):
        body += f'<path d="M12 {line_y(12) + off:.1f}L90 {line_y(90) + off:.1f}" stroke="{INK}" stroke-width=".6" stroke-dasharray="2 2"/>'
    a = [(18, 68), (26, 60), (34, 66), (42, 58), (46, 50), (54, 64), (62, 56), (70, 64), (78, 50)]
    b = [(20, 40), (28, 28), (36, 38), (44, 22), (52, 26), (60, 14), (68, 12), (40, 12), (24, 16)]
    body += "".join(sq(x, y, 4.6, f'fill="{INK}"') for x, y in a)
    body += "".join(sq(x, y, 4.6, f'fill="none" stroke="{INK}" stroke-width="1.1"') for x, y in b)
    body += f'<path d="M12 {line_y(12):.1f}L90 {line_y(90):.1f}" stroke="{ORANGE}" stroke-width="2.2"/>'
    return svg(body)


def hpc():
    body = ""
    pins = ""
    for i in range(7):
        x = 31 + i * 6.3
        pins += f'<rect x="{x - .8:.1f}" y="7" width="1.6" height="7"/><rect x="{x - .8:.1f}" y="58" width="1.6" height="7"/>'
        y = 17 + i * 6.3
        pins += f'<rect x="21" y="{y - .8:.1f}" width="7" height="1.6"/><rect x="72" y="{y - .8:.1f}" width="7" height="1.6"/>'
    body += f'<g fill="{BONE}">{pins}</g>'
    body += f'<rect x="28" y="14" width="44" height="44" fill="{NAVY}" stroke="{BONE}" stroke-width=".8"/>'
    for i in range(6):
        for j in range(6):
            col = ORANGE if (i + j) % 3 == 0 else STEEL_LT
            body += f'<rect x="{31.2 + i * 6.4:.1f}" y="{17.2 + j * 6.4:.1f}" width="5" height="5" fill="{col}"/>'
    return svg(body)


def mobile():
    body = f'<rect x="32" y="5" width="36" height="66" fill="{NAVY}" stroke="{BONE}" stroke-width="1.6"/>'
    body += f'<rect x="46" y="8" width="8" height="1.4" fill="{BONE}"/>'
    for r in range(3):
        for c in range(3):
            col = ORANGE if (r, c) == (1, 2) else BONE
            body += f'<rect x="{36.5 + c * 10}" y="{14 + r * 10}" width="7" height="7" fill="{col}"/>'
    # a strip of keys, the way High 5! shows a keyboard
    for i in range(6):
        body += f'<rect x="{36 + i * 4.8:.1f}" y="47" width="4.2" height="14" fill="{BONE}"/>'
    for i in (0, 1, 3, 4):
        body += f'<rect x="{39.2 + i * 4.8:.1f}" y="47" width="2.6" height="8" fill="{INK}"/>'
    body += f'<rect x="48" y="64.5" width="4" height="4" fill="none" stroke="{BONE}" stroke-width=".9"/>'
    return svg(body)


def research():
    grey = "#6B6558"
    body = f'<rect x="20" y="5" width="46" height="60" fill="#B3AA96" stroke="{INK}" stroke-width=".6"/>'
    body += f'<rect x="30" y="11" width="48" height="62" fill="#F4EFE3" stroke="{INK}" stroke-width=".9"/>'
    body += f'<rect x="35" y="16" width="32" height="3.4" fill="{INK}"/>'
    body += f'<rect x="35" y="22" width="18" height="1.6" fill="{grey}"/>'
    for i, w in enumerate((37, 35, 31)):
        body += f'<rect x="35" y="{27 + i * 3.2:.1f}" width="{w}" height="1.3" fill="{grey}"/>'
    body += f'<rect x="35" y="38" width="38" height="21" fill="none" stroke="{INK}" stroke-width=".7"/>'
    body += f'<polyline points="37,56 43,49 49,45.5 55,43.5 61,42.5 67,41.5 71,41" fill="none" stroke="{ORANGE}" stroke-width="1.6"/>'
    body += f'<polyline points="37,56 43,53 49,51 55,49.5 61,48.6 67,48 71,47.6" fill="none" stroke="{INK}" stroke-width="1" stroke-dasharray="2 1.4"/>'
    body += f'<rect x="35" y="62" width="26" height="1.3" fill="{grey}"/><rect x="35" y="65.5" width="33" height="1.3" fill="{grey}"/>'
    return svg(body)


def iot():
    body = ""
    for r in (5, 10, 15):
        a0, a1 = math.radians(-150), math.radians(-30)
        sx, sy = 70 + r * math.cos(a0), 27 + r * math.sin(a0)
        ex, ey = 70 + r * math.cos(a1), 27 + r * math.sin(a1)
        body += f'<path d="M{sx:.1f} {sy:.1f}A{r} {r} 0 0 1 {ex:.1f} {ey:.1f}" fill="none" stroke="{ORANGE}" stroke-width="1.8"/>'
    body += f'<rect x="16" y="32" width="54" height="34" fill="{STEEL}" stroke="{BONE}" stroke-width=".7"/>'
    body += f'<g fill="{AMBER}">' + "".join(f'<rect x="{20 + i * 5}" y="34.5" width="2.6" height="2.6"/>' for i in range(10)) + "</g>"
    body += f'<rect x="35" y="43" width="17" height="17" fill="{INK}" stroke="{BONE}" stroke-width=".6"/>'
    legs = "".join(f'<rect x="32" y="{45 + i * 3.6:.1f}" width="3" height="1.2"/><rect x="52" y="{45 + i * 3.6:.1f}" width="3" height="1.2"/>' for i in range(4))
    body += f'<g fill="{BONE}">{legs}</g>'
    body += f'<rect x="11" y="46" width="6" height="9" fill="{SLATE}"/>'
    body += f'<rect x="61" y="58" width="4" height="4" fill="{ORANGE}"/>'
    body += f'<path d="M70 52H80" stroke="{BONE}" stroke-width=".8" stroke-dasharray="2 1.6"/>'
    body += f'<rect x="80" y="47" width="10" height="10" fill="none" stroke="{BONE}" stroke-width="1.2"/>'
    body += f'<rect x="83.5" y="50.5" width="3" height="3" fill="{BONE}"/>'
    return svg(body)


FACES = {"ai": ai, "ml": ml, "hpc": hpc, "mobile": mobile, "research": research, "iot": iot}
