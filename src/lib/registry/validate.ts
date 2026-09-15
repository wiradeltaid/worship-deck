import {
  ARTIFACT_ENTRY_KEYS,
  type ArtifactBaseType,
  type ArtifactLayout,
  type ArtifactTemplate,
  type CanvasElement,
  type PlaceholderDefinition,
  type PlaceholderType,
} from './types';
import { isRegistryImageRef } from './asset-safety';
import {
  catalogEntry,
  isCatalogPlaceholderKey,
  extractInlineTokens,
  findUnknownPredefinedFieldTokens,
} from './placeholder-catalog';
import { validateWrapLines } from '@/lib/artifacts/render-model';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
export const KEBAB_ID = /^[a-z][a-z0-9-]*$/;

const ALLOWED_TEMPLATE_KEYS = new Set([
  'schemaVersion',
  'id',
  'label',
  'baseType',
  'placeholders',
  'layouts',
]);

const ALLOWED_PLACEHOLDER_KEYS = new Set([
  'key',
  'type',
  'required',
  'defaultValue',
]);

const ALLOWED_LAYOUT_KEYS = new Set([
  'aspectRatio',
  'backgroundColor',
  'backgroundImage',
  'elements',
]);

const ALLOWED_ELEMENT_KEYS = new Set([
  'id',
  'type',
  'required',
  'x',
  'y',
  'w',
  'h',
  'zIndex',
  'content',
  'wrapLines',
  'longestWordPx',
  'measuredWith',
  'placeholderKey',
  'imageRef',
  'style',
]);

const ALLOWED_MEASURED_WITH_KEYS = new Set([
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
]);

const ALLOWED_STYLE_KEYS = new Set([
  'fontFamily',
  'fontSize',
  'fontColor',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'textAlign',
  'verticalAlign',
  'objectFit',
  'fillColor',
  'opacity',
  'lineHeight',
  'textShadow',
  'textShadowBlur',
  'letterSpacing',
  'pptxTypeface',
  'fontStatus',
]);

export class RegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryValidationError';
  }
}

function assertPlainObject(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RegistryValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  label: string
) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new RegistryValidationError(`Unknown field: ${label}.${key}`);
    }
  }
}

function parseFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RegistryValidationError(`${label} must be a finite number`);
  }
  return value;
}

function parsePositiveNumber(value: unknown, label: string): number {
  const n = parseFiniteNumber(value, label);
  if (n <= 0) {
    throw new RegistryValidationError(`${label} must be positive`);
  }
  return n;
}

function parseNonNegativeInt(value: unknown, label: string): number {
  const n = parseFiniteNumber(value, label);
  if (!Number.isInteger(n) || n < 0) {
    throw new RegistryValidationError(`${label} must be a non-negative integer`);
  }
  return n;
}

function parsePlaceholderType(value: unknown, label: string): PlaceholderType {
  if (
    value !== 'text' &&
    value !== 'text[]' &&
    value !== 'image' &&
    value !== 'image[]'
  ) {
    throw new RegistryValidationError(`${label} has invalid placeholder type`);
  }
  return value;
}

function parseStyle(value: unknown, label: string) {
  if (value === undefined) return undefined;
  const obj = assertPlainObject(value, label);
  rejectUnknownKeys(obj, ALLOWED_STYLE_KEYS, label);
  const style: Record<string, unknown> = {};
  if (obj.fontFamily !== undefined) {
    if (typeof obj.fontFamily !== 'string' || !obj.fontFamily.trim()) {
      throw new RegistryValidationError(`${label}.fontFamily is invalid`);
    }
    style.fontFamily = obj.fontFamily;
  }
  if (obj.fontSize !== undefined) {
    style.fontSize = parsePositiveNumber(obj.fontSize, `${label}.fontSize`);
  }
  if (obj.fontColor !== undefined) {
    if (typeof obj.fontColor !== 'string' || !HEX_COLOR.test(obj.fontColor)) {
      throw new RegistryValidationError(`${label}.fontColor is invalid`);
    }
    style.fontColor = obj.fontColor;
  }
  if (obj.fontWeight !== undefined) {
    let weightStr = String(obj.fontWeight).trim().toLowerCase();
    const validWeights = new Set([
      'normal',
      'bold',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
    ]);
    if (!validWeights.has(weightStr)) {
      throw new RegistryValidationError(`${label}.fontWeight is invalid`);
    }
    style.fontWeight = weightStr;
  }
  if (obj.fontStyle !== undefined) {
    if (
      obj.fontStyle !== 'normal' &&
      obj.fontStyle !== 'italic' &&
      obj.fontStyle !== 'oblique'
    ) {
      throw new RegistryValidationError(`${label}.fontStyle is invalid`);
    }
    style.fontStyle = obj.fontStyle;
  }
  if (obj.textDecoration !== undefined) {
    if (obj.textDecoration !== 'none' && obj.textDecoration !== 'underline') {
      throw new RegistryValidationError(`${label}.textDecoration is invalid`);
    }
    style.textDecoration = obj.textDecoration;
  }
  if (obj.textAlign !== undefined) {
    if (
      obj.textAlign !== 'left' &&
      obj.textAlign !== 'center' &&
      obj.textAlign !== 'right'
    ) {
      throw new RegistryValidationError(`${label}.textAlign is invalid`);
    }
    style.textAlign = obj.textAlign;
  }
  if (obj.verticalAlign !== undefined) {
    if (
      obj.verticalAlign !== 'top' &&
      obj.verticalAlign !== 'middle' &&
      obj.verticalAlign !== 'bottom'
    ) {
      throw new RegistryValidationError(`${label}.verticalAlign is invalid`);
    }
    style.verticalAlign = obj.verticalAlign;
  }
  if (obj.objectFit !== undefined) {
    if (obj.objectFit !== 'contain' && obj.objectFit !== 'cover') {
      throw new RegistryValidationError(`${label}.objectFit is invalid`);
    }
    style.objectFit = obj.objectFit;
  }
  if (obj.fillColor !== undefined) {
    if (typeof obj.fillColor !== 'string' || !HEX_COLOR.test(obj.fillColor)) {
      throw new RegistryValidationError(`${label}.fillColor is invalid`);
    }
    style.fillColor = obj.fillColor;
  }
  if (obj.opacity !== undefined) {
    const opacity = parseFiniteNumber(obj.opacity, `${label}.opacity`);
    if (opacity < 0 || opacity > 1) {
      throw new RegistryValidationError(`${label}.opacity must be 0..1`);
    }
    style.opacity = opacity;
  }
  if (obj.lineHeight !== undefined) {
    const lh = parseFiniteNumber(obj.lineHeight, `${label}.lineHeight`);
    if (lh <= 0) {
      throw new RegistryValidationError(`${label}.lineHeight must be positive`);
    }
    style.lineHeight = lh;
  }
  if (obj.textShadow !== undefined) {
    if (typeof obj.textShadow !== 'boolean') {
      throw new RegistryValidationError(`${label}.textShadow must be a boolean`);
    }
    style.textShadow = obj.textShadow;
  }
  if (obj.textShadowBlur !== undefined) {
    const blur = parseFiniteNumber(obj.textShadowBlur, `${label}.textShadowBlur`);
    if (blur < 0 || blur > 20) {
      throw new RegistryValidationError(`${label}.textShadowBlur must be 0..20`);
    }
    style.textShadowBlur = Math.round(blur);
  }
  if (obj.letterSpacing !== undefined) {
    style.letterSpacing = parseFiniteNumber(obj.letterSpacing, `${label}.letterSpacing`);
  }
  if (obj.pptxTypeface !== undefined) {
    if (typeof obj.pptxTypeface !== 'string' || !obj.pptxTypeface.trim()) {
      throw new RegistryValidationError(`${label}.pptxTypeface is invalid`);
    }
    style.pptxTypeface = obj.pptxTypeface.trim();
  }
  if (obj.fontStatus !== undefined) {
    if (
      obj.fontStatus !== 'system' &&
      obj.fontStatus !== 'catalog' &&
      obj.fontStatus !== 'embedded' &&
      obj.fontStatus !== 'uploaded' &&
      obj.fontStatus !== 'unresolved'
    ) {
      throw new RegistryValidationError(`${label}.fontStatus is invalid`);
    }
    style.fontStatus = obj.fontStatus;
  }
  return style;
}

function parseElement(raw: unknown, label: string): CanvasElement {
  const obj = assertPlainObject(raw, label);
  rejectUnknownKeys(obj, ALLOWED_ELEMENT_KEYS, label);

  const type = obj.type;
  if (
    type !== 'text' &&
    type !== 'image' &&
    type !== 'image-placeholder' &&
    type !== 'shape'
  ) {
    throw new RegistryValidationError(`${label}.type is invalid`);
  }

  const id = obj.id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new RegistryValidationError(`${label}.id is required`);
  }

  const element: CanvasElement = {
    id,
    type,
    required: obj.required === undefined ? false : Boolean(obj.required),
    x: parseFiniteNumber(obj.x, `${label}.x`),
    y: parseFiniteNumber(obj.y, `${label}.y`),
    w: parsePositiveNumber(obj.w, `${label}.w`),
    h: parsePositiveNumber(obj.h, `${label}.h`),
    zIndex: parseNonNegativeInt(obj.zIndex, `${label}.zIndex`),
  };

  if (obj.content !== undefined) {
    if (typeof obj.content !== 'string') {
      throw new RegistryValidationError(`${label}.content must be a string`);
    }
    element.content = obj.content;
  }
  if (obj.wrapLines !== undefined) {
    if (
      !Array.isArray(obj.wrapLines) ||
      obj.wrapLines.some((line) => typeof line !== 'string')
    ) {
      throw new RegistryValidationError(`${label}.wrapLines must be an array of strings`);
    }
    const isPlaceholder =
      Boolean(obj.placeholderKey) ||
      (typeof obj.content === 'string' && /\{[a-zA-Z0-9_]+\}/.test(obj.content));
    if (!isPlaceholder && typeof obj.content === 'string' && obj.content.trim() !== '') {
      const valid = validateWrapLines(obj.content, obj.wrapLines);
      if (valid === null) {
        throw new RegistryValidationError(
          `${label}.wrapLines must be a valid whole-word wrap partition of content`
        );
      }
      element.wrapLines = valid;
    } else if (obj.wrapLines.length > 0) {
      element.wrapLines = [...obj.wrapLines];
    }
  }
  const hasLongestWordPx = obj.longestWordPx !== undefined;
  const hasMeasuredWith = obj.measuredWith !== undefined;
  if (hasLongestWordPx !== hasMeasuredWith) {
    throw new RegistryValidationError(
      `${label}: longestWordPx and measuredWith must be provided together`
    );
  }
  if (hasLongestWordPx && hasMeasuredWith) {
    const lwp = parsePositiveNumber(obj.longestWordPx, `${label}.longestWordPx`);
    const mwRaw = assertPlainObject(obj.measuredWith, `${label}.measuredWith`);
    rejectUnknownKeys(mwRaw, ALLOWED_MEASURED_WITH_KEYS, `${label}.measuredWith`);
    if (typeof mwRaw.fontFamily !== 'string' || !mwRaw.fontFamily.trim()) {
      throw new RegistryValidationError(`${label}.measuredWith.fontFamily is invalid`);
    }
    const mwFontSize = parsePositiveNumber(mwRaw.fontSize, `${label}.measuredWith.fontSize`);
    if (typeof mwRaw.fontWeight !== 'string') {
      throw new RegistryValidationError(`${label}.measuredWith.fontWeight must be a string`);
    }
    if (typeof mwRaw.fontStyle !== 'string') {
      throw new RegistryValidationError(`${label}.measuredWith.fontStyle must be a string`);
    }
    element.longestWordPx = lwp;
    element.measuredWith = {
      fontFamily: mwRaw.fontFamily,
      fontSize: mwFontSize,
      fontWeight: mwRaw.fontWeight,
      fontStyle: mwRaw.fontStyle,
    };
  }
  if (obj.placeholderKey !== undefined) {
    if (typeof obj.placeholderKey !== 'string' || !obj.placeholderKey.trim()) {
      throw new RegistryValidationError(`${label}.placeholderKey is invalid`);
    }
    element.placeholderKey = obj.placeholderKey;
  }
  if (obj.imageRef !== undefined) {
    if (typeof obj.imageRef !== 'string' || !isRegistryImageRef(obj.imageRef)) {
      throw new RegistryValidationError(`${label}.imageRef is unsafe or invalid`);
    }
    element.imageRef = obj.imageRef;
  }
  const style = parseStyle(obj.style, `${label}.style`);
  if (style && Object.keys(style).length > 0) {
    element.style = style;
  }
  return element;
}

function parseLayout(raw: unknown, label: string): ArtifactLayout {
  const obj = assertPlainObject(raw, label);
  rejectUnknownKeys(obj, ALLOWED_LAYOUT_KEYS, label);

  if (obj.aspectRatio !== '16:9') {
    throw new RegistryValidationError(`${label}.aspectRatio must be 16:9`);
  }
  if (typeof obj.backgroundColor !== 'string' || !HEX_COLOR.test(obj.backgroundColor)) {
    throw new RegistryValidationError(`${label}.backgroundColor is invalid`);
  }

  const layout: ArtifactLayout = {
    aspectRatio: '16:9',
    backgroundColor: obj.backgroundColor,
    elements: [],
  };

  if (obj.backgroundImage !== undefined) {
    if (
      typeof obj.backgroundImage !== 'string' ||
      !isRegistryImageRef(obj.backgroundImage)
    ) {
      throw new RegistryValidationError(`${label}.backgroundImage is unsafe or invalid`);
    }
    layout.backgroundImage = obj.backgroundImage;
  }

  if (!Array.isArray(obj.elements)) {
    throw new RegistryValidationError(`${label}.elements must be an array`);
  }
  layout.elements = obj.elements.map((el, i) =>
    parseElement(el, `${label}.elements[${i}]`)
  );
  return layout;
}

function parsePlaceholder(raw: unknown, label: string): PlaceholderDefinition {
  const obj = assertPlainObject(raw, label);
  rejectUnknownKeys(obj, ALLOWED_PLACEHOLDER_KEYS, label);

  const key = obj.key;
  if (typeof key !== 'string' || !key.trim()) {
    throw new RegistryValidationError(`${label}.key is required`);
  }

  const type = parsePlaceholderType(obj.type, label);
  const placeholder: PlaceholderDefinition = {
    key,
    type,
    required: obj.required === undefined ? false : Boolean(obj.required),
  };

  if (obj.defaultValue !== undefined) {
    if (type === 'text' || type === 'image') {
      if (typeof obj.defaultValue !== 'string') {
        throw new RegistryValidationError(`${label}.defaultValue must be a string`);
      }
      placeholder.defaultValue = obj.defaultValue;
    } else if (type === 'text[]' || type === 'image[]') {
      if (!Array.isArray(obj.defaultValue)) {
        throw new RegistryValidationError(`${label}.defaultValue must be an array`);
      }
      if (!obj.defaultValue.every((v) => typeof v === 'string')) {
        throw new RegistryValidationError(`${label}.defaultValue items must be strings`);
      }
      placeholder.defaultValue = obj.defaultValue;
    }
  }
  return placeholder;
}

function validateLayoutElements(
  layout: ArtifactLayout,
  placeholders: PlaceholderDefinition[],
  label: string
) {
  const placeholderKeys = new Set(placeholders.map((p) => p.key));
  const elementIds = new Set<string>();

  for (const element of layout.elements) {
    if (elementIds.has(element.id)) {
      throw new RegistryValidationError(`Duplicate element id in ${label}: ${element.id}`);
    }
    elementIds.add(element.id);

    if (element.placeholderKey && !placeholderKeys.has(element.placeholderKey)) {
      throw new RegistryValidationError(
        `${label} references unknown placeholderKey: ${element.placeholderKey}`
      );
    }
  }
}

function enforceBaseTypeRules(template: ArtifactTemplate) {
  const { baseType, placeholders, layouts } = template;
  const hasText = placeholders.some(
    (p) => p.type === 'text' || p.type === 'text[]'
  );

  switch (baseType) {
    case 'general':
      if (!layouts.default) {
        throw new RegistryValidationError('General templates require layouts.default');
      }
      validateLayoutElements(layouts.default, placeholders, 'layouts.default');
      break;
    case 'song-set':
      if (!layouts.title || !layouts.lyric) {
        throw new RegistryValidationError('SongSet requires layouts.title and layouts.lyric');
      }
      if (!hasText) {
        throw new RegistryValidationError('SongSet requires text placeholders');
      }
      validateLayoutElements(layouts.title, placeholders, 'layouts.title');
      validateLayoutElements(layouts.lyric, placeholders, 'layouts.lyric');
      break;
    case 'announcement':
      if (!layouts.default) {
        throw new RegistryValidationError('Announcement requires layouts.default');
      }
      if (
        placeholders.length !== 1 ||
        placeholders[0].type !== 'image[]' ||
        !placeholders[0].required
      ) {
        throw new RegistryValidationError(
          'Announcement requires one required image[] placeholder'
        );
      }
      validateLayoutElements(layouts.default, placeholders, 'layouts.default');
      break;
    default:
      throw new RegistryValidationError(`Unknown base type: ${baseType}`);
  }
}

export function validateArtifactTemplate(raw: unknown): ArtifactTemplate {
  const obj = assertPlainObject(raw, 'template');
  rejectUnknownKeys(obj, ALLOWED_TEMPLATE_KEYS, 'template');

  if (obj.schemaVersion !== 1) {
    throw new RegistryValidationError('schemaVersion must be 1');
  }

  const id = obj.id;
  if (typeof id !== 'string' || !KEBAB_ID.test(id)) {
    throw new RegistryValidationError('template.id must be kebab-case');
  }

  const label = obj.label;
  if (typeof label !== 'string' || !label.trim()) {
    throw new RegistryValidationError('template.label is required');
  }

  const baseType = obj.baseType;
  if (
    typeof baseType !== 'string' ||
    !(ARTIFACT_ENTRY_KEYS as readonly string[]).includes(baseType)
  ) {
    throw new RegistryValidationError('template.baseType is invalid');
  }

  if (!Array.isArray(obj.placeholders)) {
    throw new RegistryValidationError('template.placeholders must be an array');
  }
  const placeholders = obj.placeholders.map((p, i) =>
    parsePlaceholder(p, `placeholders[${i}]`)
  );
  const placeholderKeys = new Set<string>();
  for (const p of placeholders) {
    if (placeholderKeys.has(p.key)) {
      throw new RegistryValidationError(`Duplicate placeholder key: ${p.key}`);
    }
    placeholderKeys.add(p.key);
  }

  const layoutsRaw = assertPlainObject(obj.layouts ?? {}, 'layouts');
  const layoutKeys = new Set(['default', 'title', 'lyric', 'verse', 'reff']);
  for (const key of Object.keys(layoutsRaw)) {
    if (!layoutKeys.has(key)) {
      throw new RegistryValidationError(`Unknown layouts field: ${key}`);
    }
  }

  const layouts: ArtifactTemplate['layouts'] = {};
  if (layoutsRaw.default !== undefined) {
    layouts.default = parseLayout(layoutsRaw.default, 'layouts.default');
  }
  if (layoutsRaw.title !== undefined) {
    layouts.title = parseLayout(layoutsRaw.title, 'layouts.title');
  }
  if (layoutsRaw.lyric !== undefined) {
    layouts.lyric = parseLayout(layoutsRaw.lyric, 'layouts.lyric');
  }
  if (layoutsRaw.verse !== undefined) {
    layouts.verse = parseLayout(layoutsRaw.verse, 'layouts.verse');
  }
  if (layoutsRaw.reff !== undefined) {
    layouts.reff = parseLayout(layoutsRaw.reff, 'layouts.reff');
  }

  const template: ArtifactTemplate = {
    schemaVersion: 1,
    id,
    label,
    baseType: baseType as ArtifactBaseType,
    placeholders,
    layouts,
  };

  enforceBaseTypeRules(template);
  if (template.baseType === 'general') {
    for (const placeholder of template.placeholders) {
      if (!isCatalogPlaceholderKey(placeholder.key)) {
        throw new RegistryValidationError(
          `placeholder key is not in the catalog: ${placeholder.key}`
        );
      }
      const entry = catalogEntry(placeholder.key);
      if (entry && placeholder.type !== entry.type) {
        throw new RegistryValidationError(
          `placeholder ${placeholder.key} must be type ${entry.type}`
        );
      }
    }
  }
  return template;
}

export function validateSongSetLayout(
  raw: unknown,
  role: 'title' | 'verse' | 'reff'
): ArtifactLayout {
  const label = `layouts.${role}`;
  const obj = assertPlainObject(raw, label);
  if (role === 'verse' || role === 'reff') {
    if (obj.backgroundImage !== undefined) {
      throw new RegistryValidationError(
        `${label} must not set a background image`
      );
    }
    if (Array.isArray(obj.elements)) {
      obj.elements.forEach((el, i) => {
        if (el && typeof el === 'object') {
          const elObj = el as Record<string, unknown>;
          if (
            elObj.imageRef !== undefined ||
            elObj.type === 'image' ||
            elObj.type === 'image-placeholder'
          ) {
            throw new RegistryValidationError(
              `${label}.elements[${i}] must not set a background image`
            );
          }
        }
      });
    }
  }
  return parseLayout(raw, label);
}

export function validateArtifactTemplateList(raw: unknown): ArtifactTemplate[] {
  if (!Array.isArray(raw)) {
    throw new RegistryValidationError('Seed must be an array of templates');
  }
  const templates = raw.map((t, i) => {
    try {
      return validateArtifactTemplate(t);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new RegistryValidationError(`templates[${i}]: ${msg}`);
    }
  });
  const ids = new Set<string>();
  for (const t of templates) {
    if (ids.has(t.id)) {
      throw new RegistryValidationError(`Duplicate template id: ${t.id}`);
    }
    ids.add(t.id);
  }
  return templates;
}

export { extractInlineTokens, findUnknownPredefinedFieldTokens };
