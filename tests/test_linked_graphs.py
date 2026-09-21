"""Verify the shipped linked graphs and their offline saved-file editing."""

import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def test_shipped_linked_graphs_offline(tmp_path):
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
            page = browser.new_page(viewport={"width": 1400, "height": 1100}, accept_downloads=True)
            origin = f"http://127.0.0.1:{server.server_port}"
            errors, external = [], []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on(
                "request",
                lambda r: (
                    external.append(r.url)
                    if not r.url.startswith((origin, "data:", "blob:"))
                    else None
                ),
            )
            page.goto(origin + "/demos/linked-graphs.html")
            old = page.locator("main [data-function-curve]").get_attribute("d")
            page.locator("#live-formula").click()
            page.locator("[data-math-source]").fill("y=(x-2)^2+1")
            page.locator("[data-math-action=apply]").click()
            assert page.locator("main [data-function-curve]").get_attribute("d") != old
            cell = page.locator("[data-chart-table] tbody tr").first.locator("td").nth(1)
            cell.fill("18")
            expect(page.locator('main [data-chart-value="18"]')).to_have_count(1)
            with page.expect_download() as download:
                page.locator("[data-cmd=save]").click()
            saved = tmp_path / "saved.html"
            download.value.save_as(saved)
            page.route(
                origin + "/saved.html", lambda r: r.fulfill(path=saved, content_type="text/html")
            )
            page.context.set_offline(True)
            page.goto(origin + "/saved.html")
            assert page.locator("#live-formula").get_attribute("data-latex") == "y=(x-2)^2+1"
            expect(page.locator('main [data-chart-value="18"]')).to_have_count(1)
            cell = page.locator("[data-chart-table] tbody tr").first.locator("td").nth(1)
            cell.fill("21")
            expect(page.locator('main [data-chart-value="21"]')).to_have_count(1)
            cell.click()
            page.locator("[data-prop=chart-type]").select_option("line")
            expect(page.locator("main [data-series]")).to_have_count(1)
            page.locator("#live-formula").click()
            page.locator("[data-math-source]").fill("y=-x+2")
            page.locator("[data-math-action=apply]").click()
            assert page.locator("#live-formula").get_attribute("data-latex") == "y=-x+2"
            assert not errors and not external
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
