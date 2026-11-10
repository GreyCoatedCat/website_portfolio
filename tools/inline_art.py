"""Regenerates the project covers and the About-cube faces inside index.html.

The art is inline SVG, so it can use the page's CSS colour tokens. Each piece sits between markers:

    <!--cover:NAME--> ... <!--/cover:NAME-->     drawn by tools/covers.py
    <!--face:NAME--> ... <!--/face:NAME-->       drawn by tools/faces.py

Edit a drawing in covers.py or faces.py, then run from the project folder:

    python tools/inline_art.py

It updates index.html and every project page (project/NAME/index.html); the template folder is skipped.
To add a new cover, write a function in covers.py, register it in COVERS, put an empty
<!--cover:NAME--><!--/cover:NAME--> pair wherever it should appear (the tile on the home page, the top of
the project page), and run the script.
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from covers import COVERS  # noqa: E402
from faces import FACES  # noqa: E402

ROOT = HERE.parent


def refill(text, kind, drawings, page):
    def draw(m):
        name = m.group(1)
        if name not in drawings:
            raise SystemExit(f"{page} asks for {kind} {name!r}, but tools/{kind}s.py has no drawing by that name")
        return f"<!--{kind}:{name}-->{drawings[name]()}<!--/{kind}:{name}-->"

    return re.subn(rf"<!--{kind}:(\w+)-->.*?<!--/{kind}:\1-->", draw, text, flags=re.S)


pages = [ROOT / "index.html"] + sorted(p for p in (ROOT / "project").glob("*/index.html") if not p.parent.name.startswith("_"))
for page in pages:
    html = page.read_text(encoding="utf-8")
    name = page.relative_to(ROOT).as_posix()
    html, covers = refill(html, "cover", COVERS, name)
    html, faces = refill(html, "face", FACES, name)
    page.write_text(html, encoding="utf-8")
    print(f"{name}: redrew {covers} covers and {faces} cube faces")
