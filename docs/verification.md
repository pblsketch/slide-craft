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
