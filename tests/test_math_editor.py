"""Verify the shipped formula demo, including an offline saved-file edit."""

import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import fitz
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def test_shipped_math_editor_offline(tmp_path):
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            opts = {"headless": True}
            if os.environ.get("CRAFT_BROWSER"):
                opts["executable_path"] = os.environ["CRAFT_BROWSER"]
            browser = p.chromium.launch(**opts)
            page = browser.new_page(viewport={"width": 1280, "height": 1000}, accept_downloads=True)
            origin = f"http://127.0.0.1:{server.server_port}"
            external, errors = [], []
            page.on(
                "request",
                lambda r: (
                    external.append(r.url)
                    if not r.url.startswith((origin, "data:", "blob:"))
                    else None
                ),
            )
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(origin + "/demos/math-editor.html")
            page.evaluate("document.fonts.ready")
            assert page.locator("[data-math] .katex").count() == 9
            original = page.locator("#formula-0").get_attribute("data-latex")
            page.locator("#formula-0").click()
            page.locator("[data-math-source]").fill(r"\frac{1}{")
            expect(page.locator("[data-math-action=apply]")).to_be_disabled()
            assert page.locator("#formula-0").get_attribute("data-latex") == original
            page.keyboard.press("Escape")
            page.locator("#formula-0").click()
            page.locator("[data-math-source]").fill(r"\sqrt{x+1}")
            expect(page.locator("[data-math-action=apply]")).to_be_enabled()
            page.locator("[data-math-action=apply]").click()
            page.locator("[data-cmd=undo]").click()
            assert page.locator("#formula-0").get_attribute("data-latex") == original
            page.locator("[data-cmd=redo]").click()
            with page.expect_download() as download:
                page.locator("[data-cmd=save]").click()
            saved = tmp_path / "saved.html"
            download.value.save_as(saved)
            page.route(
                origin + "/saved.html", lambda r: r.fulfill(path=saved, content_type="text/html")
            )
            page.context.set_offline(True)
            page.goto(origin + "/saved.html")
            page.evaluate("document.fonts.ready")
            assert page.locator("#formula-0").get_attribute("data-latex") == r"\sqrt{x+1}"
            page.locator("#formula-0").click()
            page.locator("[data-math-source]").fill(r"\frac{3}{4}")
            page.keyboard.press("Control+Enter")
            expect(page.locator("[data-teach-math-ui]")).not_to_be_visible()
            assert page.locator("#formula-0").get_attribute("data-latex") == r"\frac{3}{4}"
            with fitz.open(
                stream=page.pdf(prefer_css_page_size=True, print_background=True), filetype="pdf"
            ) as pdf:
                assert len(pdf) == 1
                assert "수업자료 편집" not in pdf[0].get_text()
                assert "LaTeX 수식" not in pdf[0].get_text()
            assert not external and not errors
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
