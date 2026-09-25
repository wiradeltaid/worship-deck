# 02: Integrate Crop into Service Forms and Predefined Fields (WSD-W2)

**What to build:** In `src/components/ImageUploadField.tsx`, integrate `ImageCropDialog` into the file selection flow for all service form image fields (including predefined fields such as Sermon Graphic, Family of the Week, Youth of the Week, and Announcement flyers). Define an explicit `cropConfig?: CropConfig` prop on `ImageUploadField` rather than relying on presentation label regexes. In `src/operator/DynamicFormBody.tsx`, supply explicit `cropConfig={{ defaultAspect: 1, defaultResize: '800px' }}` for `family_of_the_week` and `youth_of_the_week`, and `cropConfig={{ defaultAspect: null, defaultResize: '1080p' }}` for sermon graphic and general image fields. When an operator selects a file via `<input type="file">`, intercept the immediate upload: read the file into an object URL and open `ImageCropDialog`. When the operator confirms "Crop & Upload" or "Skip Crop", dispatch the resulting `File` through the existing `POST /api/upload` pipeline without changing backend contracts. Author `tests/service-image-crop-integration.test.mjs` verifying explicit `cropConfig` prop handling, modal triggering, and raw file bypass on "Skip Crop", and wire additively into `package.json` preserving `--test-concurrency=1`.

**Blocked by:** `SPEC-77-01` (Client-Side Image Crop Dialog and Canvas Helper).

**Status:** open

- [ ] Read `src/components/ImageUploadField.tsx` and the ImageCropDialog component first.
- [ ] In `src/components/ImageUploadField.tsx`:
      - Accept explicit `cropConfig?: { defaultAspect?: number | null; defaultResize?: 'original' | '1080p' | '800px' }` prop.
      - Intercept file input change: store the chosen `File` in state (`cropTargetFile`) and generate object URL instead of uploading immediately.
      - Render `ImageCropDialog` modal when `cropTargetFile` is present, passing `cropConfig` defaults.
      - On crop complete (or skip crop): send resulting `File` to `/api/upload` via `FormData`, set returned URL via `onChange(url)`, and close the dialog.
      - On cancel: reset picker and clear crop target file.
- [ ] In `src/operator/DynamicFormBody.tsx`:
      - For Family of the Week and Youth of the Week predefined fields, pass `cropConfig={{ defaultAspect: 1, defaultResize: '800px' }}`.
      - For Sermon Graphic and Announcement flyer fields, pass `cropConfig={{ defaultAspect: null, defaultResize: '1080p' }}`.
- [ ] Author `tests/service-image-crop-integration.test.mjs`:
      - Verify `ImageUploadField.tsx` accepts and passes `cropConfig` prop.
      - Verify explicit aspect ratio configuration for Family/Youth (1:1) vs general image fields.
      - Verify "Skip Crop" passes original uncropped file directly to upload handler.
- [ ] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/service-image-crop-integration.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [ ] Run test suite and `npm run typecheck` to verify 100% green execution.
