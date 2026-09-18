/**
 * The single placeholder-resolution point.
 *
 * Turns an authored `ArtifactTemplate` plus weekly values into a fully resolved
 * `ArtifactInstance`. Nothing downstream of this module resolves placeholders,
 * applies defaults or reorders elements.
 */
import type {
  ArtifactLayout,
  ArtifactTemplate,
  CanvasElement,
  PlaceholderDefinition,
} from '@/lib/registry/types';
import {
  ARTIFACT_RUNTIME_VERSION,
  ArtifactHydrationError,
  type ArtifactGroupRef,
  type ArtifactInstance,
  type ArtifactLayoutKey,
  type ResolvedElement,
  type ResolvedLayout,
  type ResolvedStyle,
} from './runtime-contract';
import { requireTemplate, type RegistrySnapshot } from './registry-snapshot';
import { extractInlineTokens, INLINE_TOKEN_REGEX } from '@/lib/registry/placeholder-catalog';

export type PlaceholderValue = string | string[] | null | undefined;

export type PlaceholderValues = Readonly<Record<string, PlaceholderValue>>;

export type ArtifactHydrationRequest = {
  instanceId: string;
  templateId: string;
  layoutKey?: ArtifactLayoutKey;
  values?: PlaceholderValues;
  group?: ArtifactGroupRef;
};

export type HydrateOptions = {
  instanceId: string;
  layoutKey?: ArtifactLayoutKey;
  values?: PlaceholderValues;
  group?: ArtifactGroupRef;
};

type Resolution = { present: true; value: string } | { present: false };

const ABSENT: Resolution = { present: false };

function firstImageRef(entries: readonly string[]): Resolution {
  for (const entry of entries) {
    if (typeof entry === 'string' && entry.trim()) return { present: true, value: entry };
  }
  return ABSENT;
}

/**
 * `text` → string, `text[]` → newline join, `image` / `image[]` → first URL.
 * Empty string counts as a supplied text value; empty array / blank URL do not.
 */
function resolvePlaceholderValue(
  definition: PlaceholderDefinition,
  raw: PlaceholderValue
): Resolution {
  const candidate = raw ?? definition.defaultValue;
  if (candidate === undefined || candidate === null) return ABSENT;

  const isImage = definition.type === 'image' || definition.type === 'image[]';

  if (Array.isArray(candidate)) {
    if (candidate.length === 0) return ABSENT;
    if (isImage) return firstImageRef(candidate);
    return { present: true, value: candidate.join('\n') };
  }

  if (isImage) {
    return candidate.trim() ? { present: true, value: candidate } : ABSENT;
  }

  return { present: true, value: candidate };
}

function sortElements(elements: readonly CanvasElement[]): CanvasElement[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => a.element.zIndex - b.element.zIndex || a.index - b.index)
    .map((entry) => entry.element);
}

function toResolvedStyle(element: CanvasElement): ResolvedStyle {
  return { ...(element.style ?? {}) };
}

function baseResolvedElement(element: CanvasElement): ResolvedElement {
  return {
    id: element.id,
    type: element.type,
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    zIndex: element.zIndex,
    style: toResolvedStyle(element),
    ...(Array.isArray(element.wrapLines) && element.wrapLines.length > 0
      ? { wrapLines: [...element.wrapLines] }
      : {}),
    ...(element.longestWordPx !== undefined && element.measuredWith !== undefined
      ? {
          longestWordPx: element.longestWordPx,
          measuredWith: { ...element.measuredWith },
        }
      : {}),
    ...(typeof element.rotation === 'number'
      ? { rotation: ((Math.round(element.rotation) % 360) + 360) % 360 }
      : {}),
  };
}

function substituteTokens(content: string, values: PlaceholderValues): string {
  return content.replace(INLINE_TOKEN_REGEX, (_match, token) => {
    const v = values[token];
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return v.join('\n');
    return String(v);
  });
}

function resolveLayout(
  template: ArtifactTemplate,
  layout: ArtifactLayout,
  layoutKey: ArtifactLayoutKey,
  instanceId: string,
  values: PlaceholderValues
): ResolvedLayout {
  const definitions = new Map(template.placeholders.map((p) => [p.key, p]));
  const effectiveValues: Record<string, PlaceholderValue> = { ...values };
  for (const p of template.placeholders) {
    if (effectiveValues[p.key] === undefined && p.defaultValue !== undefined) {
      effectiveValues[p.key] = p.defaultValue;
    }
  }

  const elements: ResolvedElement[] = [];

  for (const element of sortElements(layout.elements)) {
    const resolved = baseResolvedElement(element);

    if (!element.placeholderKey) {
      if (element.type === 'text') {
        if (typeof element.content === 'string') {
          const tokens = extractInlineTokens(element.content);
          const substituted = substituteTokens(element.content, effectiveValues);
          if (tokens.length > 0) {
            // Check if the whole content was just token(s) and rendered completely empty
            const isSolelyToken = tokens.length === 1 && element.content.trim() === `{${tokens[0]}}`;
            if (isSolelyToken && substituted.trim() === '') {
              if (element.required) {
                throw new ArtifactHydrationError('Missing required placeholder value', {
                  instanceId,
                  templateId: template.id,
                  layoutKey,
                  elementId: element.id,
                  placeholderKey: tokens[0],
                });
              }
              // Optional token rendered empty -> omit element
              continue;
            }
            resolved.text = substituted;
            if (isSolelyToken) {
              resolved.placeholderKey = tokens[0];
              // SPEC-23-05: Substituted placeholder text has no authoring-time wrapLines or longestWordPx
              delete resolved.wrapLines;
              delete resolved.longestWordPx;
              delete resolved.measuredWith;
            }
          } else {
            resolved.text = element.content;
          }
        }
      } else if (element.type === 'image' || element.type === 'image-placeholder') {
        if (typeof element.imageRef === 'string') resolved.imageUrl = element.imageRef;
      }
      elements.push(resolved);
      continue;
    }

    const definition = definitions.get(element.placeholderKey);
    if (!definition) {
      throw new ArtifactHydrationError('Element references an undeclared placeholder', {
        instanceId,
        templateId: template.id,
        layoutKey,
        elementId: element.id,
        placeholderKey: element.placeholderKey,
      });
    }

    const value = resolvePlaceholderValue(definition, effectiveValues[definition.key]);
    if (!value.present) {
      // The layout — not the placeholder declaration — decides whether a slot may
      // stay empty: a required element must have content, everything else is
      // simply dropped so optional weekly data (photos, lyric labels, sermon
      // titles) can be absent without failing the whole plan.
      if (element.required) {
        throw new ArtifactHydrationError('Missing required placeholder value', {
          instanceId,
          templateId: template.id,
          layoutKey,
          elementId: element.id,
          placeholderKey: definition.key,
        });
      }
      continue;
    }

    resolved.placeholderKey = definition.key;
    // SPEC-23-05: Substituted placeholder text has no authoring-time wrapLines or longestWordPx
    delete resolved.wrapLines;
    delete resolved.longestWordPx;
    delete resolved.measuredWith;
    if (element.type === 'text') {
      resolved.text = value.value;
    } else if (element.type === 'image' || element.type === 'image-placeholder') {
      resolved.imageUrl = value.value;
    }
    elements.push(resolved);
  }

  return {
    aspectRatio: layout.aspectRatio,
    backgroundColor: layout.backgroundColor,
    ...(layout.backgroundImage ? { backgroundImage: layout.backgroundImage } : {}),
    elements,
  };
}

export function hydrateArtifact(
  template: ArtifactTemplate,
  options: HydrateOptions
): ArtifactInstance {
  const layoutKey: ArtifactLayoutKey = options.layoutKey ?? 'default';
  const layout = template.layouts[layoutKey];
  if (!layout) {
    throw new ArtifactHydrationError('Unknown layout key for template', {
      instanceId: options.instanceId,
      templateId: template.id,
      layoutKey,
    });
  }

  return {
    runtimeVersion: ARTIFACT_RUNTIME_VERSION,
    instanceId: options.instanceId,
    templateId: template.id,
    label: template.label,
    baseType: template.baseType,
    layoutKey,
    layout: resolveLayout(
      template,
      layout,
      layoutKey,
      options.instanceId,
      options.values ?? {}
    ),
    ...(options.group ? { group: options.group } : {}),
  };
}

export function hydrateArtifactFromSnapshot(
  snapshot: RegistrySnapshot,
  request: ArtifactHydrationRequest
): ArtifactInstance {
  const template = requireTemplate(snapshot, request.templateId, request.instanceId);
  return hydrateArtifact(template, {
    instanceId: request.instanceId,
    layoutKey: request.layoutKey,
    values: request.values,
    group: request.group,
  });
}
