"""임의로 디자인한 HTML의 구조와 CSS를 보존하고 편집 도구만 인라인한다."""

from __future__ import annotations

import argparse
import html
import re
from html.parser import HTMLParser
from pathlib import Path


class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.roots = self.mains = self.fields = self.slides = 0
        self.external: list[str] = []
        self.editors: list[tuple[str, str | None]] = []
        self.css: list[str] = []
        self.in_style = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "style":
            self.in_style = True
        if a.get("style"):
            self.css.append(a["style"])
        self.roots += "data-teach-document" in a
        self.mains += tag == "main"
        self.fields += "data-edit" in a or "data-math" in a
        self.slides += "data-slide" in a
        if "data-teach-freeform" in a:
            self.editors.append((tag, a["data-teach-freeform"]))
        names = ["src", "poster", "srcset"]
        if tag == "link" and "stylesheet" in (a.get("rel") or ""):
            names.append("href")
        for key in names:
            value = a.get(key) or ""
            if value and not value.startswith(("data:", "#")):
                self.external.append(f"{tag}.{key}: {value[:100]}")

    def handle_data(self, data):
        if self.in_style:
            self.css.append(data)

    def handle_endtag(self, tag):
        if tag == "style":
            self.in_style = False


def math_assets():
    folder = Path(__file__).resolve().parent
    if not (folder / "math-editor.js").is_file():
        folder = folder.parent / "assets/freeform"
    css = "\n".join(
        (folder / name).read_text(encoding="utf-8") for name in ["katex.css", "math-editor.css"]
    )
    js = "\n".join(
        (folder / name).read_text(encoding="utf-8") for name in ["katex.js", "math-editor.js"]
    )
    return css, js


def attach(
    source: str, css: str, js: str, kind: str, filename: str, *, refresh: bool = False
) -> str:
    parser = Inspect()
    parser.feed(source)
    if not (parser.roots == 1 or (parser.roots == 0 and parser.mains == 1)):
        raise ValueError("본문 컨테이너 하나에 data-teach-document를 붙이세요.")
    if not parser.fields:
        raise ValueError("수정할 글이나 표의 셀에 data-edit를 붙이세요.")
    if kind == "slides" and not parser.slides:
        raise ValueError("각 슬라이드 컨테이너에 data-slide를 붙이세요.")
    if parser.external or re.search(
        r"@import\s|url\(\s*['\"]?(?!data:|#)[^\s'\")]+", "\n".join(parser.css), re.I
    ):
        raise ValueError(
            "이미지·스타일 등의 외부/상대 파일 참조를 HTML 안에 포함하세요: "
            + "; ".join(parser.external)
        )
    if parser.editors:
        if not refresh:
            raise ValueError(
                "편집기가 이미 연결되어 있습니다. 기능만 갱신하려면 --refresh-editor를 쓰세요."
            )
        if sorted(parser.editors) != [("script", "script"), ("style", "style")]:
            raise ValueError("편집기 표식이 중복되거나 손상되어 자동으로 교체할 수 없습니다.")
        for tag, name in [("style", "style"), ("script", "script")]:
            pattern = rf"<{tag}\b(?=[^>]*\bdata-teach-freeform\s*=\s*[\"\']{name}[\"\'])[^>]*>.*?</{tag}\s*>"
            source, count = re.subn(pattern, "", source, flags=re.I | re.S)
            if count != 1:
                raise ValueError("기존 편집기 자원을 정확히 찾지 못했습니다. 원본을 보존합니다.")
    elif refresh:
        raise ValueError("갱신할 편집기가 없습니다. 새 연결에는 --refresh-editor를 빼세요.")
    if not re.search(r"</head\s*>", source, re.I) or not re.search(r"</body\s*>", source, re.I):
        raise ValueError("head와 body를 갖춘 완전한 HTML이 필요합니다.")
    config = f' data-teach-kind="{kind}" data-teach-filename="{html.escape(filename, quote=True)}"'

    def body_config(match):
        tag = re.sub(
            r"""\sdata-teach-(?:kind|filename)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)""",
            "",
            match[0],
            flags=re.I,
        )
        return tag[:-1] + config + ">"

    source = re.sub(r"<body\b[^>]*>", body_config, source, count=1, flags=re.I)
    math_css, math_js = math_assets()
    css = math_css + "\n" + css
    js = math_js + "\n" + js
    source = re.sub(
        r"</head\s*>",
        lambda _: '<style data-teach-freeform="style">\n' + css + "\n</style></head>",
        source,
        count=1,
        flags=re.I,
    )
    safe_js = re.sub(r"</script", r"<\\/script", js, flags=re.I)
    return re.sub(
        r"</body\s*>",
        lambda _: '<script data-teach-freeform="script">\n' + safe_js + "\n</script></body>",
        source,
        count=1,
        flags=re.I,
    )


def main():
    ap = argparse.ArgumentParser(
        description="기존 디자인을 보존하고 HTML 편집·저장 도구를 연결합니다."
    )
    ap.add_argument("input", type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--kind", required=True, choices=["worksheet", "slides"])
    ap.add_argument("--overwrite", action="store_true", help="지정한 출력 파일의 교체를 허용")
    ap.add_argument(
        "--refresh-editor",
        action="store_true",
        help="본문과 디자인은 보존하고 연결된 편집기만 갱신",
    )
    args = ap.parse_args()
    if args.output.exists() and not args.overwrite:
        ap.error("출력 파일이 있습니다. 새 이름을 쓰거나 --overwrite로 교체를 명시하세요.")
    assets = Path(__file__).resolve().parents[1] / "assets" / "freeform"
    try:
        result = attach(
            args.input.read_text(encoding="utf-8-sig"),
            (assets / "editor.css").read_text(encoding="utf-8"),
            (assets / "editor.js").read_text(encoding="utf-8"),
            args.kind,
            args.output.name,
            refresh=args.refresh_editor,
        )
    except (OSError, ValueError) as exc:
        ap.error(str(exc))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(result, encoding="utf-8")
    print(f"편집 가능한 HTML을 저장했습니다: {args.output}")


if __name__ == "__main__":
    main()
