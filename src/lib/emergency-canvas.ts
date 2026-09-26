/**
 * Pure functions and data structures for Emergency Visual Canvas Editing.
 *
 * Implements hydrated ArtifactInstance seeding, multi-element mutation
 * (text, image, geometry, background), canonical body preservation,
 * and monotonic patch construction for Stage & Projector emergency local edits (SPEC-85-05).
 */

import {
  ARTIFACT_RUNTIME_VERSION,
  type ArtifactInstance,
  type ResolvedElement,
  type ResolvedStyle,
} from '@/lib/artifacts/runtime-contract';
import type { SlidePlanItem } from '@/lib/slide-plan';
import type { EmergencyPatchRecord } from '@/lib/offline/service-snapshot';

/**
 * Guarantees a fully resolved, valid hydrated ArtifactInstance is present for any slide.
 * If the slide already carries a valid artifact matching ARTIFACT_RUNTIME_VERSION with
 * non-empty elements, returns a deep clone.
 * Otherwise, synthesizes a concrete hydrated artifact from slide properties.
 */
export function ensureArtifactInstance(slide?: SlidePlanItem | null): ArtifactInstance {
  if (
    slide?.artifact &&
    slide.artifact.runtimeVersion === ARTIFACT_RUNTIME_VERSION &&
    slide.artifact.layout &&
    Array.isArray(slide.artifact.layout.elements) &&
    slide.artifact.layout.elements.length > 0
  ) {
    return JSON.parse(JSON.stringify(slide.artifact));
  }

  const textContent = slide?.body || slide?.lines?.join('\n') || slide?.title || '';
  const lines = textContent ? textContent.split('\n') : [];

  return {
    runtimeVersion: ARTIFACT_RUNTIME_VERSION,
    instanceId: slide?.id || `slide-${Date.now()}`,
    templateId: 'tpl-emergency',
    label: slide?.title || 'Slide',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      backgroundImage: slide?.imageUrl,
      elements: [
        {
          id: 'text-main',
          type: 'text',
          x: 10,
          y: 20,
          w: 80,
          h: 60,
          zIndex: 1,
          text: textContent,
          wrapLines: lines,
          style: {
            fontFamily: 'Geist Sans',
            fontSize: 32,
            fontColor: '#FFFFFF',
            textAlign: 'center',
            verticalAlign: 'middle',
          },
        },
      ],
    },
  };
}

/**
 * Identifies the canonical body / lyrics text element of an artifact.
 * Prevents non-body element edits (e.g. title, subtitle, image) from
 * corrupting the slide's primary body and lines metadata upon apply.
 */
export function findCanonicalBodyElement(
  artifact?: ArtifactInstance | null,
  preferredElementId?: string
): ResolvedElement | null {
  if (!artifact?.layout?.elements) return null;
  const elements = artifact.layout.elements;

  // 1. If explicit preferredElementId given and is a text element, use it
  if (preferredElementId) {
    const matched = elements.find((el) => el.id === preferredElementId && el.type === 'text');
    if (matched) return matched;
  }

  // 2. Look for semantic body/lyrics/verse/content placeholders
  const byPlaceholder = elements.find(
    (el) =>
      el.type === 'text' &&
      (el.placeholderKey === 'lyrics' ||
        el.placeholderKey === 'body' ||
        el.placeholderKey === 'verse' ||
        el.placeholderKey === 'content')
  );
  if (byPlaceholder) return byPlaceholder;

  // 3. Fallback: first text element
  return elements.find((el) => el.type === 'text') || null;
}

/**
 * Updates text content and auto-calculates soft wrapLines for a target element.
 */
export function updateElementText(
  artifact: ArtifactInstance,
  elementId: string,
  newText: string
): ArtifactInstance {
  const cloned: ArtifactInstance = JSON.parse(JSON.stringify(artifact));
  if (!cloned.layout?.elements) return cloned;

  cloned.layout.elements = cloned.layout.elements.map((el) => {
    if (el.id === elementId) {
      return {
        ...el,
        text: newText,
        wrapLines: newText.split('\n'),
      };
    }
    return el;
  });

  return cloned;
}

/**
 * Updates typography and visual styles for a target element.
 */
export function updateElementStyle(
  artifact: ArtifactInstance,
  elementId: string,
  stylePatch: Partial<ResolvedStyle>
): ArtifactInstance {
  const cloned: ArtifactInstance = JSON.parse(JSON.stringify(artifact));
  if (!cloned.layout?.elements) return cloned;

  cloned.layout.elements = cloned.layout.elements.map((el) => {
    if (el.id === elementId) {
      return {
        ...el,
        style: {
          ...el.style,
          ...stylePatch,
        },
      };
    }
    return el;
  });

  return cloned;
}

/**
 * Updates bounding box geometry (x, y, w, h percentages) for a target element with finite validation.
 */
export function updateElementGeometry(
  artifact: ArtifactInstance,
  elementId: string,
  geo: { x?: number; y?: number; w?: number; h?: number }
): ArtifactInstance {
  const cloned: ArtifactInstance = JSON.parse(JSON.stringify(artifact));
  if (!cloned.layout?.elements) return cloned;

  cloned.layout.elements = cloned.layout.elements.map((el) => {
    if (el.id === elementId) {
      const x = typeof geo.x === 'number' && Number.isFinite(geo.x) ? geo.x : el.x;
      const y = typeof geo.y === 'number' && Number.isFinite(geo.y) ? geo.y : el.y;
      const w = typeof geo.w === 'number' && Number.isFinite(geo.w) && geo.w > 0 ? geo.w : el.w;
      const h = typeof geo.h === 'number' && Number.isFinite(geo.h) && geo.h > 0 ? geo.h : el.h;
      return {
        ...el,
        x,
        y,
        w,
        h,
      };
    }
    return el;
  });

  return cloned;
}

/**
 * Updates image source URL and object-fit sizing mode for an image element.
 */
export function updateElementImage(
  artifact: ArtifactInstance,
  elementId: string,
  imageUrl: string,
  objectFit?: 'contain' | 'cover' | 'fill'
): ArtifactInstance {
  const cloned: ArtifactInstance = JSON.parse(JSON.stringify(artifact));
  if (!cloned.layout?.elements) return cloned;

  cloned.layout.elements = cloned.layout.elements.map((el) => {
    if (el.id === elementId) {
      return {
        ...el,
        imageUrl,
        style: {
          ...el.style,
          ...(objectFit ? { objectFit } : {}),
        },
      };
    }
    return el;
  });

  return cloned;
}

/**
 * Updates slide background color and/or background image override.
 */
export function updateArtifactBackground(
  artifact: ArtifactInstance,
  bg: { color?: string; image?: string | null }
): ArtifactInstance {
  const cloned: ArtifactInstance = JSON.parse(JSON.stringify(artifact));
  if (!cloned.layout) return cloned;

  if (typeof bg.color === 'string') {
    cloned.layout.backgroundColor = bg.color;
  }
  if (bg.image !== undefined) {
    cloned.layout.backgroundImage = bg.image || undefined;
  }

  return cloned;
}

/**
 * Builds an EmergencyPatchRecord for IndexedDB persistence and outbox delivery.
 */
export function createEmergencyPatchRecord({
  serviceId,
  clientOpId,
  basePlanIdentity,
  patchRevision,
  slideIndex,
  originalText,
  originalArtifact,
  updatedArtifact,
  updatedText,
}: {
  serviceId: string;
  clientOpId?: string;
  basePlanIdentity: string;
  patchRevision: number;
  slideIndex: number;
  originalText: string;
  originalArtifact?: ArtifactInstance;
  updatedArtifact: ArtifactInstance;
  updatedText: string;
}): EmergencyPatchRecord {
  return {
    serviceId,
    clientOpId,
    basePlanIdentity,
    patchRevision,
    patchTimestamp: Date.now(),
    slideIndex,
    originalText,
    originalArtifact,
    updatedText,
    patchedArtifact: updatedArtifact,
  };
}

/**
 * Pure helper applying a patched artifact onto a slide list in presenter state.
 */
export function applyEmergencyPatchToSlides(
  slides: SlidePlanItem[],
  slideIndex: number,
  patchedArtifact: ArtifactInstance,
  updatedText?: string
): SlidePlanItem[] {
  if (slideIndex < 0 || slideIndex >= slides.length) return slides;

  const current = slides[slideIndex];
  const effectiveText = updatedText ?? current.body ?? '';
  const lines = effectiveText ? effectiveText.split('\n') : current.lines;

  const updated: SlidePlanItem = {
    ...current,
    artifact: patchedArtifact,
    body: effectiveText,
    lines,
  };

  const next = [...slides];
  next[slideIndex] = updated;
  return next;
}

/**
 * Validates whether an incoming slide-patch message meets all projector safety guards:
 * 1. Matches active service base plan identity.
 * 2. Has strictly higher monotonic patchRevision than current applied revision.
 * 3. Enforces valid integer index and structured artifact layout.
 */
export function validateProjectorSlidePatchAdmission({
  msg,
  activePlanIdentity,
  lastRevision,
}: {
  msg: any;
  activePlanIdentity: string;
  lastRevision: number;
}): { admit: boolean; reason?: string } {
  if (!msg || typeof msg !== 'object') {
    return { admit: false, reason: 'Invalid message object' };
  }
  if (msg.type !== 'slide-patch') {
    return { admit: false, reason: 'Not a slide-patch message' };
  }
  if (typeof msg.planIdentity !== 'string' || msg.planIdentity !== activePlanIdentity) {
    return {
      admit: false,
      reason: `Plan identity mismatch: received ${msg.planIdentity}, active ${activePlanIdentity}`,
    };
  }
  if (typeof msg.index !== 'number' || !Number.isInteger(msg.index) || msg.index < 0) {
    return { admit: false, reason: `Invalid slide index: ${msg.index}` };
  }
  if (
    typeof msg.patchRevision !== 'number' ||
    !Number.isFinite(msg.patchRevision) ||
    !Number.isInteger(msg.patchRevision) ||
    msg.patchRevision <= 0
  ) {
    return { admit: false, reason: `Invalid patch revision: ${msg.patchRevision}` };
  }
  if (msg.patchRevision <= lastRevision) {
    return {
      admit: false,
      reason: `Monotonic revision violation: received ${msg.patchRevision} <= last applied ${lastRevision}`,
    };
  }
  if (
    !msg.artifact ||
    typeof msg.artifact !== 'object' ||
    !msg.artifact.layout ||
    typeof msg.artifact.layout !== 'object' ||
    !Array.isArray(msg.artifact.layout.elements)
  ) {
    return { admit: false, reason: 'Missing or malformed artifact layout in slide patch' };
  }
  return { admit: true };
}
