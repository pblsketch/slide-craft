"""Verify example editing, saving, reopening and printing in a real browser."""

from __future__ import annotations

import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import fitz
import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def runtime():
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with sync_playwright() as p:
            options = {"headless": True}
            if os.environ.get("CRAFT_BROWSER"):
                options["executable_path"] = os.environ["CRAFT_BROWSER"]
            browser = p.chromium.launch(**options)
            yield browser, f"http://127.0.0.1:{server.server_port}"
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.mark.parametrize("path", sorted((ROOT / "examples").glob("*.html")), ids=lambda p: p.stem)
def test_example_edit_save_print(runtime, path, tmp_path):
    browser, origin = runtime
    page = browser.new_page(viewport={"width": 1360, "height": 980}, accept_downloads=True)
    errors = []
    external = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on(
        "request",
        lambda r: (
            external.append(r.url) if not r.url.startswith((origin, "data:", "blob:")) else None
        ),
    )
    page.goto(f"{origin}/examples/{path.name}")
    page.evaluate("document.fonts.ready")
    slides = page.locator("[data-slide]").count()
    title = page.locator("h1[data-edit],h2[data-edit]").first
    title.click()
    title.fill("Edited lesson title")
    if slides:
        page.locator("[data-cmd=copy-slide]").click()
        assert page.locator("[data-slide]").count() == slides + 1
        page.locator("[data-cmd=undo]").click()
        assert page.locator("[data-slide]").count() == slides
    else:
        page.locator("td[data-edit]").first.click()
        page.locator("td[data-edit]").first.fill("Edited response")
        page.locator("[data-cmd=row]").click()
        page.locator("[data-cmd=undo]").click()
        assert page.locator("td[data-edit]").first.inner_text() == "Edited response"
    with page.expect_download() as download:
        page.locator("[data-cmd=save]").click()
    saved = tmp_path / "saved.html"
    download.value.save_as(saved)
    # Serve the downloaded bytes through the same HTTP browser origin.
    page.route(
        f"{origin}/saved.html", lambda route: route.fulfill(path=saved, content_type="text/html")
    )
    page.goto(f"{origin}/saved.html")
    assert page.locator("h1[data-edit],h2[data-edit]").first.inner_text() == "Edited lesson title"
    assert page.locator("[data-teach-controls]").count() == 1
    if path.stem in {"graph-paper", "cobalt-grid"} and not slides:
        assert page.locator("math mfrac").count() == 1
        points = page.locator("svg circle[data-x]").evaluate_all(
            "els=>els.map(e=>({x:+e.dataset.x,y:+e.dataset.y,cx:+e.getAttribute('cx'),cy:+e.getAttribute('cy')}))"
        )
        assert len(points) == 3
        for point in points:
            assert point["y"] == 0.5 * point["x"] + 1
            assert point["cx"] == 220 + 40 * point["x"]
            assert point["cy"] == 220 - 40 * point["y"]
        assert (
            page.locator("[data-formula-source]").get_attribute("data-formula-source")
            == "y=0.5*x+1"
        )
    if path.stem == "notebook-tabs" and not slides:
        page.locator("[data-cmd=mode]").click()
        page.locator('.page-tabs a[href="#tab-3"]').click()
        assert page.url.endswith("#tab-3")
        page.locator("[data-cmd=mode]").click()
    if slides:
        page.locator("[data-cmd=present]").click()
        page.locator("[data-cmd=next]").click()
        assert page.locator("[data-slide]:visible").count() == 1
    pdf = page.pdf(prefer_css_page_size=True, print_background=True)
    with fitz.open(stream=pdf, filetype="pdf") as document:
        assert len(document) == (slides or 1)
        assert "HTML 저장" not in "".join(p.get_text() for p in document)
    assert not errors
    assert not external
    page.close()
