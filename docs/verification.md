# Verification

Run from this repository root:

```sh
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python -m pytest tests -q
```

Tests use HTTP, not file URLs. They check every included example for text editing, table or slide structure changes, undo, HTML download, reopening, PDF page count, and browser JavaScript errors. Set CRAFT_BROWSER to an existing Chrome or Edge executable to use that browser instead.

The HTML examples contain the editor. No Python installation is required to open and edit them. Python is used when creating new HTML files and running these development checks.

The gallery screenshots show actual example HTML. Editor screenshots show temporary edits and selections made for demonstration. Screenshots of the artwork hide editor controls; the downloaded examples retain those controls.
## v0.2.0 baseline, checked on 2026-09-20

Windows 11, Python 3.14.2, Chrome. All 3 examples passed browser editing, save/reopen, undo, no external resource requests, and PDF page checks. Worksheets printed as one A4 page each; slide examples printed as three 16:9 pages each. Formula/graph tests verify fraction markup, source preservation and three calculated points. Shared editor integration tests: 9 passed.

Claude upload ZIP: one skill root, SKILL.md, relative references, bundled Python helper and MIT license. The helper was executed after extracting each ZIP to an isolated directory. Packaging follows the linked official Claude documentation. Actual generation inside Claude or Claude Code has not been tested in this release. Browser-dependent checks in a Claude environment remain conditional on available tools.

## v0.3.0 gallery expansion, checked on 2026-09-20

Two new examples in this repository passed browser edit, structure change, undo, HTML download/reopen, no external resource requests and PDF page checks. New worksheets print as one A4 page each; new slide examples print as three pages each. Previously published examples are unchanged and were not retested in this update. Both updated Claude ZIP helpers passed isolated extraction/execution checks.

## v0.4.0 reference gallery, checked on 2026-09-20

Six new examples in this repository were verified in Chrome over HTTP for editing, structure change, undo, saving/reopening, no external resource requests and PDF page counts. Across the two repositories, 12 targeted tests passed (11 prior examples deselected). The Cobalt Grid worksheet also checks formula source and calculated points. The Notebook Tabs worksheet checks navigation to the third activity; its final stage-label presentation was rechecked after the visual adjustment. Worksheets produce one A4 page each; slide decks produce three 16:9 pages each. Prior examples were preserved without rerunning the old engine suite. Claude ZIP extraction and bundled helper execution were verified.

## v0.4.1 shared editor correction, checked on 2026-09-21

The empty editable-field fallback now has zero selector specificity so authored minimum heights are preserved. Shared editor integration tests: 10 passed, including empty-region edit/preview preservation and scaled slide interactions. No slide design or lesson content changed.

## Offline KaTeX editing, checked on 2026-09-21

The editor includes KaTeX 0.18.7, embedded WOFF2 fonts, a LaTeX editor with live preview, templates, apply/cancel, inline insertion and block equations. The bundle preserves KaTeX MIT notices and does not require a CDN, npm or Node in generated documents.

Validation: 13 focused development integration tests passed, covering existing editing behaviour plus invalid-input cancellation, undo/redo, copy, inline insertion, supported math variants, blocked external resources, editor refresh and offline saved-file editing. Four existing math lesson/deck examples passed real-browser edit/save/print tests after KaTeX conversion. The shipped formula demo passed its own offline browser test in each public repository (2 tests). Screenshots and a one-page PDF containing nine rendered math examples were visually inspected. Cobalt Grid header specificity was corrected while checking the converted worksheet so the approved title-table typography is retained.

The demo test is tests/test_math_editor.py. Prior non-math layout variants were not exhaustively retested in this update. The installation ZIPs were extracted and their bundled Python attachment helper executed. Generation inside the Claude service itself remains untested.
