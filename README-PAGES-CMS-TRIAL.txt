# Aladdin Moore — Pages CMS Phase 2 Trial

## What this package adds
- `.pages.yml`: keeps the existing raw HTML test file and adds a separate structured article test collection.
- `cms-content/posts/cms-preview-test.yml`: a disposable test article.
- `cms-preview.html`: a local side-by-side editing/preview helper with rich-text and HTML-source modes.

## Safety boundaries
- Intended for the `cms-test` branch only.
- Does not modify production HTML pages, `functions/`, guestbook, D1 schema, Turnstile, admin API, or secrets.
- The preview helper does not connect to GitHub and does not save changes. Pages CMS remains the GitHub commit mechanism.
- Do not merge to `main` until separately reviewed and tested.

## Apply
Copy these package files into the repository root on branch `cms-test`, preserving all existing files. Replace `.pages.yml` with the included version. Commit as:
`Add structured Pages CMS article trial and preview helper`

## Test
1. In Pages CMS, open the `cms-test` branch.
2. Open `CMS 结构化文章测试` and edit the sample article.
3. Test the rich-text Editor/Source switch, save, and confirm only the test YAML and uploaded test media changed.
4. Open `cms-preview.html` locally in a browser. It is a helper for previewing HTML; paste the article body HTML into its editor/source pane. It is not embedded in Pages CMS and does not auto-sync with the CMS form.
5. Confirm the generated preview looks acceptable before any migration work.

## Important limitation
The right-hand preview is a separate local helper, not a native Pages CMS live preview. It provides an accurate preview of the intended Aladdin Moore article shell, but content must be pasted into it for preview. A later phase can automate preview builds/actions if desired.
