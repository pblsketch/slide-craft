# Verification

Run from this repository root:

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python -m pytest tests/test_examples.py -q
```

Tests use HTTP, not file URLs. They check every included example for text editing, table or slide structure changes, undo, HTML download, reopening, PDF page count, and browser JavaScript errors. Set CRAFT_BROWSER to an existing Chrome or Edge executable to use that browser instead.

The HTML examples contain the editor. No Python installation is required to open and edit them. Python is used when creating new HTML files and running these development checks.

The gallery screenshots show actual example HTML. Editor screenshots show temporary edits and selections made for demonstration. Screenshots of the artwork hide editor controls; the downloaded examples retain those controls.
## Checked on 2026-09-20

Windows 11, Python 3.14.2, Chrome. All 3 examples passed browser editing, save/reopen, undo, no external resource requests, and PDF page checks. Worksheets printed as one A4 page each; slide examples printed as three 16:9 pages each. Formula/graph tests verify fraction markup, source preservation and three calculated points. Shared editor integration tests: 9 passed.

Claude upload ZIP: one skill root, SKILL.md, relative references, bundled Python helper and MIT license. The helper was executed after extracting each ZIP to an isolated directory. Packaging follows the linked official Claude documentation. Actual generation inside Claude or Claude Code has not been tested in this release. Browser-dependent checks in a Claude environment remain conditional on available tools.
