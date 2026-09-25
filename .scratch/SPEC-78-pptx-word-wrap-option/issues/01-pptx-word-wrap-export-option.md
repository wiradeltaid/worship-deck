# 01: PPTX Text Box Word Wrap Option on Export (WSD-W1)

**What to build:** In `src/lib/pptx-draw.ts`, decouple DrawingML shape text wrapping from canvas line-partitioning. Update `generatePptxFromPlan(serviceDate, plan, transition, fontManifest, options)` to accept an options object containing `wordWrap?: boolean` (defaulting to `true`). In `renderTextElement`, set `wrap: options?.wordWrap !== undefined ? options.wordWrap : true` so that generated PowerPoint text boxes enable native word wrapping (`wrap="square"`) while preserving explicit soft breaks and line breaks (`<a:br/>`). In `workers/pptx/draw.mjs`, parse `body.wordWrap` from stdin and forward to `generatePptxFromPlan`. In `internal/httpapi/server.go`, parse the `wrap` query parameter from `GET /api/services/{id}/pptx?wrap=true|false` (defaulting to `true`, disabled only when `wrap == "false"` or `wrap == "0"`), and pass `wordWrap` in the JSON payload to `pptx.Draw`. In `spa/src/pages/RunSheetPage.tsx`, enhance the Download PPTX action to support native word wrap by default and expose the wrap mode toggle. Author `tests/pptx-word-wrap-option.test.mjs` verifying default `wrap: true`, explicit `wrap: false`, DrawingML XML structure, query parameter handling, and wire additively into `package.json` preserving `--test-concurrency=1`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/lib/pptx-draw.ts`, `workers/pptx/draw.mjs`, and `internal/httpapi/server.go` first.
- [ ] In `src/lib/pptx-draw.ts`:
      - Accept `options?: { wordWrap?: boolean }` in `generatePptxFromPlan`.
      - In `renderTextElement`, resolve `const wrap = options?.wordWrap !== undefined ? options.wordWrap : true;` and pass `wrap` to `slide.addText(...)`.
      - Verify intentional line breaks (`<a:br/>`) and paragraphs (`<a:p>`) remain preserved when `wrap: true`.
- [ ] In `workers/pptx/draw.mjs`:
      - Read `wordWrap` from parsed stdin payload: `const wordWrap = typeof body.wordWrap === 'boolean' ? body.wordWrap : true;`.
      - Pass `options = { wordWrap }` to `generatePptxFromPlan`.
- [ ] In `internal/httpapi/server.go`:
      - In `getPptx`, check query parameter `wrap := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("wrap")))`.
      - Default `wordWrap := true`; set `wordWrap = false` if `wrap == "false" || wrap == "0"`.
      - Include `"wordWrap": wordWrap` in the worker JSON payload.
- [ ] In `spa/src/pages/RunSheetPage.tsx`:
      - Provide a clean Download PPTX control with Word Wrap default enabled (`/api/services/{id}/pptx`).
- [ ] Author `tests/pptx-word-wrap-option.test.mjs`:
      - Verify default PPTX generation produces DrawingML text boxes with `wrap="square"` (or omits `wrap="none"`).
      - Verify explicit `wordWrap: false` produces legacy `wrap="none"`.
      - Verify multi-line text with soft breaks preserves line count and break tags in both modes.
      - Verify Go API server accepts `?wrap=true` and `?wrap=false` query parameters.
- [ ] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/pptx-word-wrap-option.test.mjs` additively into `package.json` preserving `--test-concurrency=1`.
- [ ] Run test suite and `npm run typecheck` to verify 100% green execution.
