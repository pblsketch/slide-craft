"""Verify example editing, saving, reopening and printing in a real browser."""

from __future__ import annotations

import json
import math
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
    if not slides:
        # Includes subject/lesson, the title table and the short instruction.
        assert (
            page.locator(".sheet > header").evaluate("e=>e.getBoundingClientRect().height")
            <= 45 * 96 / 25.4
        )
        assert page.locator(".sheet, .sheet *").evaluate_all(
            "els=>els.every(e=>{const c=getComputedStyle(e).backgroundColor;return ['rgb(255, 255, 255)','rgba(0, 0, 0, 0)'].includes(c)||(e.matches('thead th')&&!e.closest('.title-table')&&c==='rgb(237, 244, 245)')})"
        )
        assert page.locator(".subject-line").evaluate(
            "e=>!e.closest('table')&&e.getBoundingClientRect().bottom<=e.nextElementSibling.getBoundingClientRect().top"
        )
        assert (
            page.locator(".title-table h1").evaluate("e=>getComputedStyle(e).textAlign") == "center"
        )
        assert page.locator(".title-table tr").count() == 2
        bottom_blank = page.locator(".sheet").evaluate(
            "e=>297-(e.querySelector('footer').getBoundingClientRect().bottom-e.getBoundingClientRect().top)*25.4/96"
        )
        assert 10 <= bottom_blank <= 17
    title = page.locator("h1[data-edit],h2[data-edit]").first
    title.click()
    title.fill("Edited lesson title")
    if path.stem == "layout-basic-sequential":
        page.locator(".subject-line [data-edit]").last.fill("차시 · 2차시")
        page.locator(".title-table tr").nth(1).locator("td").last.fill("편집 확인")
        title.click()
        size = page.locator('[data-prop="font-size"]')
        size.fill("16")
        size.press("Tab")
        assert title.evaluate("e=>parseFloat(getComputedStyle(e).fontSize)") == pytest.approx(
            16 * 96 / 72, abs=0.1
        )
        size.fill("18")
        size.press("Tab")
    if slides:
        page.locator("[data-cmd=copy-slide]").click()
        assert page.locator("[data-slide]").count() == slides + 1
        page.locator("[data-cmd=undo]").click()
        assert page.locator("[data-slide]").count() == slides
    elif page.locator(".sheet table:not(.title-table) td[data-edit]").count():
        cell = page.locator(".sheet table:not(.title-table) td[data-edit]").first
        cell.click()
        cell.fill("Edited")
        page.locator("[data-cmd=row]").click()
        page.locator("[data-cmd=undo]").click()
        assert cell.inner_text() == "Edited"
    else:
        response = page.locator("[data-answer-space][data-edit]").first
        response.click()
        response.fill("Edited")
        page.locator("[data-cmd=copy]").click()
        page.locator("[data-cmd=undo]").click()
        assert response.inner_text() == "Edited"
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
    if path.stem == "stem-data-lab":
        data = json.loads(page.locator("script.experiment-data").text_content())
        points = page.locator("circle[data-temperature]").evaluate_all(
            "els=>els.map(e=>({series:e.dataset.series,t:+e.dataset.time,v:+e.dataset.temperature,x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}))"
        )
        assert len(points) == 10
        for point in points:
            assert point["v"] == data["series"][point["series"]][data["times"].index(point["t"])]
            assert point["x"] == 65 + point["t"] * 62.5
            assert point["y"] == 222 - (point["v"] - 28) * 13
    if path.stem == "stem-geometry-inquiry":
        vertices = [
            tuple(map(float, pair.split(",")))
            for pair in page.locator("[data-triangle]").get_attribute("data-vertices").split()
        ]
        angles = []
        for i, vertex in enumerate(vertices):
            a, b = vertices[(i + 1) % 3], vertices[(i + 2) % 3]
            u, v = (a[0] - vertex[0], a[1] - vertex[1]), (b[0] - vertex[0], b[1] - vertex[1])
            angles.append(
                math.degrees(
                    math.acos((u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v)))
                )
            )
        assert angles == pytest.approx([40, 75, 65], abs=0.01)
    if path.stem == "stem-statistics-inquiry":
        rows = page.locator(".sheet table:not(.title-table)").first.locator("tbody tr")
        values = [
            [int(x) for x in rows.nth(i).locator("td").all_text_contents()[1:]] for i in range(2)
        ]
        assert [sum(row) / len(row) for row in values] == [30, 60]
        assert [sorted(row)[3] for row in values] == [30, 30]
    if path.stem == "layout-basic-sequential":
        assert page.locator(".subject-line [data-edit]").last.inner_text() == "차시 · 2차시"
        assert page.locator(".title-table tr").nth(1).locator("td").last.inner_text() == "편집 확인"
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
