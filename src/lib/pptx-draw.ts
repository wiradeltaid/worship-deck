import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { isLocalUploadRef, resolveLocalUploadFsPath } from './uploads';
import { isSafeImageUrl } from './images';
import {
  fetchRemoteImage,
  IMAGE_MIME_BY_EXT,
  MAX_IMAGE_BYTES,
} from './remote-image';
import { slideTransitionXml, type SlideTransition } from './transitions';
import { embedPresentationFonts } from './fonts/embed-fonts';
import { isBundledAssetRef } from '@/lib/registry/asset-safety';
import {
  assertRuntimeVersion,
  type ArtifactInstance,
  type ResolvedElement,
} from '@/lib/artifacts/runtime-contract';
import {
  PPTX_SLIDE_HEIGHT_IN,
  PPTX_SLIDE_WIDTH_IN,
  TEXT_LINE_HEIGHT,
  estimateTextFitScale,
  resolveBold,
  resolveElementImage,
  resolveElementText,
  resolveElementTextForPptx,
  resolveTextRunsForPptx,
  resolveFontFamily,
  resolveItalic,
  resolveUnderline,
  resolveObjectFit,
  resolveTextAlign,
  resolveVerticalAlign,
  toPptxColor,
  toPptxGeometry,
  toPptxTransparency,
} from '@/lib/artifacts/render-model';

/**
 * Image reference (exactly as it appears in the plan) -> `data:` URI ready for
 * pptxgenjs. A reference that is absent from the map could not be embedded and
 * must degrade to the "Image unavailable" box.
 */
/** One finished slide the worker draws. Fade defaults to true. */
export type DrawPlanItem = {
  artifact: ArtifactInstance;
  fade?: boolean;
};

type EmbeddedImages = ReadonlyMap<string, string>;

type SlideCtx = {
  pres: PptxGenJS;
  images: EmbeddedImages;
  /** 1-based slide numbers that opted in to the deck's transition. */
  transitionIndexes: Set<number>;
  count: number;
};

type PptxSlide = PptxGenJS.Slide;

type PptxBox = { x: number; y: number; w: number; h: number };

const FULL_BLEED: PptxBox = {
  x: 0,
  y: 0,
  w: PPTX_SLIDE_WIDTH_IN,
  h: PPTX_SLIDE_HEIGHT_IN,
};

// `fade` is the plan's own per-slide opt-out flag (`SlidePlanItem.fade`); a
// slide that opts out carries no transition whatever style is configured.
function addSlide(ctx: SlideCtx, fade = true): PptxSlide {
  const slide = ctx.pres.addSlide();
  ctx.count += 1;
  if (fade) ctx.transitionIndexes.add(ctx.count);
  return slide;
}

const PUBLIC_ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');

const IMAGE_RESOLVE_CONCURRENCY = 4;

function toDataUri(bytes: Buffer, extension: string): string | null {
  const mime = IMAGE_MIME_BY_EXT[extension.toLowerCase()];
  if (!mime) return null;
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

/** Read a file from disk into a `data:` URI, or null if it cannot be embedded. */
function readLocalImage(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return null;
    return toDataUri(fs.readFileSync(filePath), path.extname(filePath));
  } catch {
    return null;
  }
}

/**
 * Fetch a remote image and embed it as bytes.
 *
 * Remote references are *embedded at render time*, never handed to pptxgenjs as
 * a URL: pptxgenjs resolves media lazily inside `write()` with a bare
 * `https.get`, which rejects the whole presentation on a non-TLS URL, a
 * redirect or any transport error. Fetching here means every failure mode
 * (timeout, oversize body, non-image content type, redirect, 4xx/5xx) collapses
 * into `null` and degrades to a single "Image unavailable" box instead of a
 * failed download.
 *
 * The gate itself lives in `@/lib/remote-image`, shared with the
 * fetch-a-link-into-an-upload route: same `isSafeImageUrl` re-check, same
 * refusal to follow a redirect, same streaming cap. The deck does not care
 * *which* refusal it got — every one of them degrades to the same box.
 */
async function embedRemoteImage(url: string): Promise<string | null> {
  const result = await fetchRemoteImage(url);
  return result.ok ? toDataUri(result.bytes, result.extension) : null;
}

/**
 * Resolve one plan image reference to embeddable bytes.
 *
 * The accepted set is exactly what the registry/announcement gates already
 * allow — hub-local uploads, bundled `/assets/*` art, and http(s) URLs that
 * pass `isSafeImageUrl`. Nothing new is admitted here; the http(s) branch is in
 * fact *stricter* than before, because it now re-runs `isSafeImageUrl` before
 * any network call.
 */
async function resolveImageData(imageRef: string): Promise<string | null> {
  const ref = imageRef.trim();

  if (isLocalUploadRef(ref)) {
    const filePath = resolveLocalUploadFsPath(ref);
    return filePath ? readLocalImage(filePath) : null;
  }

  // Registry templates reference bundled art as the public URL `/assets/<file>`.
  if (ref.startsWith('/assets/')) {
    if (!isBundledAssetRef(ref)) return null;
    return readLocalImage(
      path.join(PUBLIC_ASSETS_DIR, ref.slice('/assets/'.length))
    );
  }

  if (/^https?:\/\//i.test(ref)) {
    if (!isSafeImageUrl(ref)) return null;
    return embedRemoteImage(ref);
  }

  return null;
}

/** Every distinct image reference the plan draws, backgrounds included. */
function collectImageRefs(plan: DrawPlanItem[]): string[] {
  const refs = new Set<string>();
  for (const item of plan) {
    const { layout } = item.artifact;
    if (layout.backgroundImage?.trim()) refs.add(layout.backgroundImage.trim());
    for (const element of layout.elements ?? []) {
      const url = resolveElementImage(element);
      if (url) refs.add(url.trim());
    }
  }
  return [...refs];
}

/**
 * Embed every referenced image up front, once per distinct reference.
 *
 * Doing this before a single slide is drawn is what makes the fallback real:
 * `addImage` never sees a path or a URL, so `pres.write()` has no media left to
 * resolve and cannot reject over one bad file.
 */
async function embedPlanImages(plan: DrawPlanItem[]): Promise<EmbeddedImages> {
  const refs = collectImageRefs(plan);
  const embedded = new Map<string, string>();
  let cursor = 0;

  const worker = async () => {
    while (cursor < refs.length) {
      const ref = refs[cursor];
      cursor += 1;
      let data: string | null = null;
      try {
        data = await resolveImageData(ref);
      } catch {
        data = null;
      }
      if (data) {
        embedded.set(ref, data);
      } else {
        console.error(
          `[pptx] image could not be embedded, rendering fallback box: ${ref}`
        );
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(IMAGE_RESOLVE_CONCURRENCY, refs.length) },
      worker
    )
  );
  return embedded;
}

/** Same visible fallback the per-kind renderer used, scoped to the element box. */
function addImageUnavailable(slide: PptxSlide, box: PptxBox): void {
  slide.addText('Image unavailable', {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    margin: 0, // SPEC-22: zero margin for cross-renderer content-box parity
    align: 'center',
    valign: 'middle',
    fontSize: 28,
    color: 'AAAAAA',
    fontFace: 'Arial',
  });
}

function renderTextElement(slide: PptxSlide, element: ResolvedElement): void {
  const fallbackText = resolveElementTextForPptx(element);
  if (fallbackText === undefined) return;
  const textRuns = resolveTextRunsForPptx(element) ?? fallbackText;

  const geometry = toPptxGeometry(element);
  const style = element.style;

  /**
   * Shared shrink-to-fit policy, so the deck and the browser agree.
   *
   * Two halves, because `fit: 'shrink'` alone is not enough: pptxgenjs emits a
   * bare `<a:normAutofit/>`, and PowerPoint only computes a font scale for it
   * when the shape is next edited or resized — a freshly generated deck would
   * still open with the text spilling. So the estimated scale is baked into the
   * font size here, and `fit` is left on so PowerPoint can refine it further
   * (under SPEC-22, the estimate accounts for Canvas soft-wrapping via `resolveWrapLineCount`
   * while `fit` covers remaining metric drift) instead of overriding it.
   *
   * The estimate is a total pure function and the guard below re-checks its
   * result: a fit failure degrades to the authored size, never to a failed
   * download on Sabbath morning.
   */
  const scale = estimateTextFitScale(element);
  const fontSize =
    Number.isFinite(scale) && scale > 0 && scale < 1
      ? Math.round(geometry.fontSize * scale * 100) / 100
      : geometry.fontSize;

  slide.addText(textRuns as any, {
    x: geometry.x,
    y: geometry.y,
    w: geometry.w,
    h: geometry.h,
    margin: 0, // SPEC-22: eliminate PowerPoint 0.2" default insets for Canvas/Presenter wrap width parity
    fontSize,
    fit: 'shrink',
    fontFace: resolveFontFamily(style),
    color: toPptxColor(style.fontColor) ?? 'FFFFFF',
    bold: resolveBold(style),
    italic: resolveItalic(style),
    underline: resolveUnderline(style) ? { style: 'sng' } : undefined,
    align: resolveTextAlign(style),
    valign: resolveVerticalAlign(style),
    lineSpacingMultiple:
      (typeof style?.lineHeight === 'number' && style.lineHeight > 0
        ? style.lineHeight
        : TEXT_LINE_HEIGHT) / 1.2,
    shadow: style?.textShadow
      ? {
          type: 'outer',
          color: '000000',
          blur: typeof style.textShadowBlur === 'number' ? style.textShadowBlur : 4,
          offset: 2,
          angle: 45,
          opacity: 0.8,
        }
      : undefined,
  });
}

function renderImageElement(
  slide: PptxSlide,
  element: ResolvedElement,
  images: EmbeddedImages
): void {
  const imageUrl = resolveElementImage(element);
  // An unfilled `image-placeholder` simply draws nothing.
  if (imageUrl === undefined) return;

  const geometry = toPptxGeometry(element);
  const box: PptxBox = {
    x: geometry.x,
    y: geometry.y,
    w: geometry.w,
    h: geometry.h,
  };

  const data = images.get(imageUrl.trim());
  if (!data) {
    addImageUnavailable(slide, box);
    return;
  }

  try {
    slide.addImage({
      data,
      ...box,
      sizing: { type: resolveObjectFit(element.style), w: box.w, h: box.h },
    });
  } catch {
    addImageUnavailable(slide, box);
  }
}

function renderShapeElement(slide: PptxSlide, element: ResolvedElement): void {
  const geometry = toPptxGeometry(element);
  const color = toPptxColor(element.style.fillColor);

  slide.addShape('rect', {
    x: geometry.x,
    y: geometry.y,
    w: geometry.w,
    h: geometry.h,
    fill: color
      ? { color, transparency: toPptxTransparency(element.style) }
      : { type: 'none' },
  });
}

/**
 * Draws a hydrated artifact. There is deliberately no per-`SlideKind` branch:
 * layout, colours and geometry come from the registry via the runtime contract.
 */
function renderArtifactSlide(
  ctx: SlideCtx,
  instance: ArtifactInstance,
  fade = true
): void {
  assertRuntimeVersion(instance);

  const { layout } = instance;
  const slide = addSlide(ctx, fade);
  slide.background = { color: toPptxColor(layout.backgroundColor) ?? '000000' };

  if (layout.backgroundImage) {
    // Unreadable background: the background colour already stands in for it.
    const data = ctx.images.get(layout.backgroundImage.trim());
    if (data) {
      try {
        slide.addImage({
          data,
          ...FULL_BLEED,
          sizing: { type: 'cover', w: FULL_BLEED.w, h: FULL_BLEED.h },
        });
      } catch {
        // Background is decorative — never fail the deck over it.
      }
    }
  }

  // `layout.elements` is already sorted by zIndex, ties in template order.
  for (const element of layout.elements ?? []) {
    switch (element.type) {
      case 'text':
        renderTextElement(slide, element);
        break;
      case 'image':
      case 'image-placeholder':
        renderImageElement(slide, element, ctx.images);
        break;
      case 'shape':
        renderShapeElement(slide, element);
        break;
      default: {
        const unsupported: never = element.type;
        throw new Error(
          `Unsupported artifact element type "${String(unsupported)}" on ${instance.instanceId}`
        );
      }
    }
  }
}

/**
 * Collapse byte-identical `ppt/media/*` entries onto one canonical file.
 *
 * Every slide carries its registry background image and pptxgenjs embeds each
 * `addImage` separately, so a ~53-slide deck ships the same few JPEGs dozens of
 * times (~39 MB). Hashing the bytes and repointing the rels keeps the offline
 * PPTX path small enough to stay inside the regeneration budget.
 *
 * Only exact duplicates *with the same extension* collapse, so the set of
 * distinct extensions in the archive never shrinks and `[Content_Types].xml`
 * defaults stay valid — it is deliberately left untouched.
 *
 * Duplicates are computed before anything is mutated, so a failure while
 * scanning leaves the archive exactly as it was.
 */
async function collapseDuplicateMedia(zip: JSZip): Promise<void> {
  const mediaNames = Object.keys(zip.files)
    .filter((name) => name.startsWith('ppt/media/') && !zip.files[name].dir)
    .sort();

  // hash+extension -> first (canonical) archive entry carrying those bytes
  const canonicalByHash = new Map<string, string>();
  // removed archive entry -> canonical archive entry
  const duplicates = new Map<string, string>();

  for (const name of mediaNames) {
    const file = zip.file(name);
    if (!file) continue;
    const bytes = await file.async('nodebuffer');
    const extension = path.posix.extname(name).toLowerCase();
    const key = `${crypto.createHash('sha256').update(bytes).digest('hex')}${extension}`;

    const canonical = canonicalByHash.get(key);
    if (!canonical) {
      canonicalByHash.set(key, name);
      continue;
    }
    duplicates.set(name, canonical);
  }

  if (duplicates.size === 0) return;

  // removed base file name -> canonical base file name
  const rewrites = new Map<string, string>();
  for (const [name, canonical] of duplicates) {
    rewrites.set(path.posix.basename(name), path.posix.basename(canonical));
    zip.remove(name);
  }

  // Every relationship part may reference media (slides, layouts, masters).
  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith('.rels') || zip.files[name].dir) continue;
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    if (!xml.includes('media/')) continue;

    let next = xml;
    for (const [from, to] of rewrites) {
      // Match the closing quote so `image1.jpg` never eats `image10.jpg`.
      next = next.split(`media/${from}"`).join(`media/${to}"`);
    }
    if (next !== xml) zip.file(name, next);
  }
}

/**
 * Splice the configured `<p:transition>` into every slide that opted in.
 *
 * The element itself comes from the shared transition table, so the deck and
 * the browser cannot drift apart. `none` writes nothing at all, and a slide
 * that already carries a transition is left exactly as it is.
 */
async function injectSlideTransitions(
  zip: JSZip,
  slideIndexes: Set<number>,
  transition: SlideTransition
): Promise<void> {
  const transitionXml = slideTransitionXml(transition);
  if (!transitionXml) return;

  for (const index of slideIndexes) {
    const name = `ppt/slides/slide${index}.xml`;
    const file = zip.file(name);
    if (!file) continue;
    let xml = await file.async('string');
    if (xml.includes('<p:transition')) continue;
    if (xml.includes('</p:cSld>')) {
      xml = xml.replace('</p:cSld>', `</p:cSld>${transitionXml}`);
    } else if (xml.includes('</p:sld>')) {
      xml = xml.replace('</p:sld>', `${transitionXml}</p:sld>`);
    } else {
      continue;
    }
    zip.file(name, xml);
  }
}

/**
 * SPEC-23-04: Enforce explicit fontScale on <a:normAutofit/>.
 * Replaces bare <a:normAutofit/> or <a:normAutofit .../> with <a:normAutofit fontScale="100000"/>.
 * Because renderTextElement bakes the estimated fit scale into run font sizes directly,
 * fontScale="100000" (per-mille = 100%) instructs PowerPoint and LibreOffice that text fits
 * and prevents readers from computing divergent autofit scales of their own at layout time.
 */
async function patchAutofitFontScale(zip: JSZip): Promise<void> {
  const slideFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name)
  );

  for (const name of slideFiles) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async('string');
    if (!xml.includes('normAutofit')) continue;

    // Replace bare <a:normAutofit/> or any <a:normAutofit .../> with explicit fontScale="100000"
    const patched = xml.replace(/<a:normAutofit(\s+[^>]*)?\/>/g, '<a:normAutofit fontScale="100000"/>');
    if (patched !== xml) {
      zip.file(name, patched);
    }
  }
}

/**
 * Single post-processing pass over the written archive.
 *
 * Dedup, transition injection, and autofit patch share one JSZip instance and one re-emit. The
 * re-emit uses DEFLATE — pptxgenjs writes with the JSZip default (STORE), so
 * every previous round-trip shipped the archive uncompressed.
 *
 * Every stage is defensive: a failure anywhere returns the buffer we already
 * have rather than failing the download.
 */
async function postProcessArchive(
  buffer: Buffer,
  slideIndexes: Set<number>,
  transition: SlideTransition,
  usedFonts?: Set<string>
): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    try {
      await collapseDuplicateMedia(zip);
    } catch (error) {
      // Size is an optimization; never fail a deck over it.
      console.error('[pptx] media deduplication skipped:', error);
    }

    try {
      await injectSlideTransitions(zip, slideIndexes, transition);
    } catch (error) {
      console.error('[pptx] slide transition injection skipped:', error);
    }

    try {
      await patchAutofitFontScale(zip);
    } catch (error) {
      console.error('[pptx] autofit fontScale patch skipped:', error);
    }

    if (usedFonts && usedFonts.size > 0) {
      try {
        await embedPresentationFonts(zip, usedFonts);
      } catch (error) {
        console.error('[pptx] font embedding skipped:', error);
      }
    }

    const out = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    return Buffer.from(out);
  } catch (error) {
    console.error('[pptx] post-processing skipped, shipping raw archive:', error);
    return buffer;
  }
}

export async function generatePptxFromPlan(
  serviceDate: string,
  plan: DrawPlanItem[],
  transition: SlideTransition
): Promise<Buffer> {
  const style = transition;
  const embedded = await embedPlanImages(plan);

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';
  pres.title = `BIC Worship — ${serviceDate}`;
  pres.author = 'BIC PPTX Workflow';

  const ctx: SlideCtx = {
    pres,
    images: embedded,
    transitionIndexes: new Set<number>(),
    count: 0,
  };

  const usedFonts = new Set<string>();
  for (const item of plan) {
    renderArtifactSlide(ctx, item.artifact, item.fade !== false);
    for (const el of item.artifact.layout.elements) {
      if (el.type === 'text' && el.style?.fontFamily) {
        usedFonts.add(el.style.fontFamily);
      }
    }
  }

  const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
  return postProcessArchive(buffer, ctx.transitionIndexes, style, usedFonts);
}
