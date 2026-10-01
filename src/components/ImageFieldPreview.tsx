import { useState } from 'react';

/**
 * Whether a browser could even attempt to fetch `value` as an image.
 *
 * This is deliberately **not** a client-side copy of `isSafeImageUrl`
 * (`src/lib/images.ts`). That policy — the `/api/uploads/<hash>.<ext>` shape (32-hex or 64-hex),
 * the `IMAGE_URL_ALLOWLIST`, the SSRF host blocks — is enforced server-side on
 * save, and part of it reads server-only env, so a copy shipped to the browser
 * would answer differently and become a second, weaker gate. Whatever passes
 * here still has to clear the real check before it is stored or rendered into a
 * deck.
 *
 * All this does is keep a half-typed field or a scheme that is not a plain
 * fetch (`data:`, `blob:`, `javascript:`) out of an `<img src>`.
 */
function isPreviewable(value: string): boolean {
  // Same-origin path, e.g. `/api/uploads/<hash>.jpg`. `//host/x` is
  // protocol-relative — cross-origin, not a path — so it is not one of these.
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The box is a fixed size in both states, so swapping the image for the
 * failure note — or loading a portrait photo after a landscape one — never
 * reflows the form around it.
 */
function Thumbnail({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-background/50">
      {failed ? (
        <p className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] leading-tight text-muted-foreground">
          Couldn&apos;t load this image
        </p>
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          // `contain`, not `cover`: the operator is checking *which* picture
          // landed, so the whole frame has to be visible.
          className="h-full w-full object-contain"
        />
      )}
    </div>
  );
}

/**
 * Display-only thumbnail for an image-URL form field. Renders nothing at all
 * when the field is empty or not yet a fetchable URL — no empty frame, no
 * broken-image glyph.
 */
export function ImageFieldPreview({ url, alt }: { url: string; alt: string }) {
  const src = url.trim();
  if (!isPreviewable(src)) return null;

  // Keyed on `src` so a new URL mounts a fresh Thumbnail: a previous load
  // failure is cleared and correcting a typo retries the load.
  return <Thumbnail key={src} src={src} alt={alt} />;
}
