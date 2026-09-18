/**
 * Renderer-neutral runtime contract for hydrated Artifact instances.
 *
 * The registry (`src/lib/registry/*`) owns authoring-time templates. This module
 * owns the *runtime* projection: what the planner hands to PPTX, the web
 * slideshow, the presenter and Live Preview. Consumers never look up templates,
 * resolve placeholders or reshape content — they draw what is already resolved.
 *
 * Everything here is JSON-serializable: server pages pass instances straight to
 * client components.
 */
import type { ArtifactBaseType, CanvasElementType } from '@/lib/registry/types';

/** Bumped when the shape below changes incompatibly. */
export const ARTIFACT_RUNTIME_VERSION = 1;

/**
 * Coordinates are percentages of this fixed 16:9 canvas; `style.fontSize` is px
 * on the same reference. Renderers convert to native units without clamping —
 * out-of-range values are deliberate clipping inherited from the source deck.
 */
export const REFERENCE_CANVAS = { width: 960, height: 540 } as const;

export type ArtifactLayoutKey = 'default' | 'title' | 'lyric' | 'verse' | 'reff';

export const ARTIFACT_LAYOUT_KEYS: readonly ArtifactLayoutKey[] = [
  'default',
  'title',
  'lyric',
  'verse',
  'reff',
];

/** Flat union of every supported style field (text + image + shape). */
export type ResolvedStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  objectFit?: 'contain' | 'cover' | 'fill';
  fillColor?: string;
  opacity?: number;
  lineHeight?: number;
  textShadow?: boolean;
  textShadowBlur?: number;
  letterSpacing?: number;
  pptxTypeface?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

export type ResolvedElement = {
  id: string;
  type: CanvasElementType;
  /** Percent of the reference canvas; may be negative or > 100. */
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex: number;
  /** Resolved text for `text` elements (fixed content or placeholder value). */
  text?: string;
  /**
   * SPEC-22: Persisted soft-wrap line snapshot from Canvas (Fabric Textbox.textLines),
   * establishing Canvas as line-break authority across all export renderers.
   */
  wrapLines?: string[];
  /** SPEC-23: Longest word width in reference canvas pixels */
  longestWordPx?: number;
  /** SPEC-23: Metrics environment element was measured against */
  measuredWith?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
  };
  /** Resolved image reference for `image` / `image-placeholder` elements. */
  imageUrl?: string;
  /**
   * Placeholder this element was bound to, kept so downstream projections can
   * address resolved values by meaning instead of by element id.
   */
  placeholderKey?: string;
  /** SPEC-43: Optional 2D planar rotation in degrees [0, 360) */
  rotation?: number;
  style: ResolvedStyle;
};

export type ResolvedLayout = {
  aspectRatio: '16:9';
  backgroundColor: string;
  backgroundImage?: string;
  /** Pre-sorted by `zIndex`, ties broken by template source order. */
  elements: ResolvedElement[];
};

/** Back-reference from a grouped child (SongSet or AnnouncementSet) to its parent group. */
export type ArtifactGroupRef = {
  id: string;
  label: string;
  role: 'title' | 'lyric' | 'announcement';
  roleLabel?: string;
};

export type ArtifactInstance = {
  runtimeVersion: number;
  /** Unique within one plan; equals the legacy slide id. */
  instanceId: string;
  templateId: string;
  label: string;
  baseType: ArtifactBaseType;
  layoutKey: ArtifactLayoutKey;
  layout: ResolvedLayout;
  group?: ArtifactGroupRef;
};

export type ArtifactLeafNode = {
  kind: 'artifact';
  instance: ArtifactInstance;
};

export type ArtifactGroupNode = {
  kind: 'group';
  id: string;
  label: string;
  children: ArtifactLeafNode[];
};

export type ArtifactNode = ArtifactLeafNode | ArtifactGroupNode;

export type ArtifactHydrationErrorDetails = {
  instanceId?: string;
  templateId?: string;
  placeholderKey?: string;
  elementId?: string;
  layoutKey?: string;
};

/** Hydration failures are always visible and attributable. */
export class ArtifactHydrationError extends Error {
  readonly instanceId?: string;
  readonly templateId?: string;
  readonly placeholderKey?: string;
  readonly elementId?: string;
  readonly layoutKey?: string;

  constructor(message: string, details: ArtifactHydrationErrorDetails = {}) {
    const scope = [
      details.instanceId ? `instance=${details.instanceId}` : null,
      details.templateId ? `template=${details.templateId}` : null,
      details.layoutKey ? `layout=${details.layoutKey}` : null,
      details.elementId ? `element=${details.elementId}` : null,
      details.placeholderKey ? `placeholder=${details.placeholderKey}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    super(scope ? `${message} (${scope})` : message);
    this.name = 'ArtifactHydrationError';
    this.instanceId = details.instanceId;
    this.templateId = details.templateId;
    this.placeholderKey = details.placeholderKey;
    this.elementId = details.elementId;
    this.layoutKey = details.layoutKey;
  }
}

export function isArtifactGroupNode(node: ArtifactNode): node is ArtifactGroupNode {
  return node.kind === 'group';
}

/** Renderable leaves in presentation order; group nodes contribute their children. */
export function flattenArtifactPlan(nodes: ArtifactNode[]): ArtifactInstance[] {
  const out: ArtifactInstance[] = [];
  for (const node of nodes) {
    if (node.kind === 'group') {
      for (const child of node.children) out.push(child.instance);
    } else {
      out.push(node.instance);
    }
  }
  return out;
}

/** Guard for consumers that receive instances across a serialization boundary. */
export function assertRuntimeVersion(instance: ArtifactInstance): void {
  if (instance.runtimeVersion !== ARTIFACT_RUNTIME_VERSION) {
    throw new ArtifactHydrationError(
      `Unsupported artifact runtime version ${instance.runtimeVersion} (expected ${ARTIFACT_RUNTIME_VERSION})`,
      { instanceId: instance.instanceId, templateId: instance.templateId }
    );
  }
}

/** First resolved text of the element bound to `placeholderKey`, if any. */
export function findResolvedText(
  instance: ArtifactInstance,
  placeholderKey: string
): string | undefined {
  return instance.layout.elements.find(
    (el) => el.placeholderKey === placeholderKey && typeof el.text === 'string'
  )?.text;
}

/** Every fixed/resolved text of the instance, in render order. */
export function collectResolvedText(instance: ArtifactInstance): string[] {
  return instance.layout.elements
    .filter((el) => el.type === 'text' && typeof el.text === 'string')
    .map((el) => el.text as string);
}
