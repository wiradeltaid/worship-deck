import { toast } from 'sonner';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  BringToFront,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Italic,
  Minus,
  MoveVertical,
  Plus,
  Redo2,
  SendToBack,
  Square,
  SquareDashed,
  Trash2,
  Type,
  Underline,
  Undo2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArtifactSlide from '@/components/artifacts/ArtifactSlide';
import type { ArtifactInstance } from '@/lib/artifacts/runtime-contract';
import type {
  ArtifactLayout,
  ArtifactTemplateSummary,
  CanvasElement,
  ImageStyle,
  PlaceholderDefinition,
  ShapeStyle,
  StoredArtifactTemplate,
  TextStyle,
} from '@/lib/registry/types';
import { isCanvasAuthorable, kindChipLabel } from '@/lib/registry/types';
import {
  PLACEHOLDER_CATALOG,
  catalogEntry,
  findUnknownPredefinedFieldTokens,
} from '@/lib/registry/placeholder-catalog';
import {
  beforeUnloadGuard,
  CANVAS_MUTATION_EVENTS,
  DISCARD_ON_SWITCH_CONFIRMATION,
  mayDiscard,
  nextDirtyState,
  UNSAVED_INDICATOR_LABEL,
} from '@/lib/canvas-dirty-guard';
import { useNavigationBlocker } from '@/components/navigation-blocker';
import { useT } from '@/lib/i18n/operator';
import type { I18nKey } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FONT_CATALOG,
  FONT_CATEGORY_LABELS,
  FontCategory,
  getFontDefinition,
  isFontExportReady,
  getFontStack,
  resolveCatalogFontFamily,
  registerDynamicFontFace,
  hydrateImportedFonts,
  ImportedFontFace,
} from '@/lib/registry/font-catalog';
import {
  computeRangeSelection,
  moveSelectedBlock,
  reconcileSlideSelection,
  resolveMultiSelectClick,
  resolveNextActiveSlide,
  runBulkDelete,
  selectAllSlides,
} from '@/lib/registry/slide-selection';

const FONT_ITEMS_MAP: Record<string, string> = Object.fromEntries(
  FONT_CATALOG.map((f) => [f.family, f.label])
);

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  FabricTextLike,
  calculateImageFit,
  INSERT_CASCADE_PX,
  INSERT_CASCADE_STEPS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  NEW_SHAPE_FILL,
  NEW_SHAPE_SIZE_PX,
  NEW_TEXT_CONTENT,
  NEW_TEXT_SIZE_PX,
  clampFontSize,
  commitFontSizeFromDraft,
  computeContextMenuCoords,
  computeMinTextHeightRefPx,
  measureScale1ContentHeightPx,
  computeAutoExpandedHeight,
  elementToFabricObject,
  filterOutBackgroundElements,
  getElementId,
  handleContextMenuTrigger,
  healTemplate,
  isElementUnmeasured,
  isBackgroundElement,
  isFabricTextObject,
  isUserAuthoredId,
  nextElementId,
  normalizeFontSize,
  pctToPx,
  pxToPct,
  resolveInitialSelectedId,
  serializeCanvas,
  serializeTextStyle,
  shouldPreserveSelectionOnContextMenu,
  syncImageClipOnMove,
  syncImageClipOnScale,
  syncTextClipOnMove,
  syncTextClipOnScale,
  applyFabricTextFit,
  TEXT_LINE_HEIGHT,
  toStrictHexColor,
  updateImageElementFit,
} from '@/lib/registry/canvas-utils';

function placeholderLabelKey(key: string): I18nKey {
  return `admin.artifacts.placeholder.${key}` as I18nKey;
}

type FabricModule = typeof import('fabric');

type EditorStatus =
  | 'idle'
  | 'loading'
  | 'saving'
  | 'creating'
  | 'renaming'
  | 'resetting'
  | 'deleting'
  | 'reordering'
  | 'success'
  | 'error'
  | 'conflict';

function getEditableLayout(template: StoredArtifactTemplate): ArtifactLayout | null {
  if (!isCanvasAuthorable(template.baseType)) return null;
  return template.layouts.default ?? null;
}

/**
 * SPEC-25-01: elementToFabricObject construction logic is extracted to canvas-utils.ts
 * so that both ArtifactEditor and healTemplate share the exact same styling and geometry.
 *
 * Preserves source invariants for SPEC-12, SPEC-18, and SPEC-21:
 * - calculateImageFit(
 * - width: initial.width
 * - height: initial.height
 * - style?.textDecoration === 'underline' ? { underline: true } : {}
 * - blur: typeof style.textShadowBlur === 'number' ? style.textShadowBlur : 4
 * - splitByGrapheme: false
 * - fontFamily: getFontStack(style?.fontFamily)
 * - lineHeight: style?.lineHeight ?? TEXT_LINE_HEIGHT
 */

import {
  ArtifactEditorAdapter,
  CopiedSlide,
  fetchAvailableAnnouncementSets,
  fetchAvailableSongSets,
  fetchBackgroundLibrary,
  mainSpineAdapter,
  uploadImageFile,
} from '@/lib/registry/canvas-adapters';

export {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_FONT_COLOR,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_TEXT_ALIGN,
  computeMinTextHeightRefPx,
  measureScale1ContentHeightPx,
  elementToFabricObject,
  serializeCanvas,
  serializeTextStyle,
};

export type CanvasHistorySnapshot = {
  elements: CanvasElement[];
  addedElements: Map<string, CanvasElement>;
  addedPlaceholders: Map<string, PlaceholderDefinition>;
  backgroundColor: string;
  backgroundImage?: string;
  isDirty: boolean;
};

interface ArtifactEditorProps {
  adapter?: ArtifactEditorAdapter;
  initialSelectedId?: string | null;
  copiedSlidePayload?: CopiedSlide | null;
  onCopySlidePayloadChange?: (slide: CopiedSlide | null) => void;
  hideList?: boolean;
  allowImages?: boolean;
  allowRename?: boolean;
  bannerNote?: React.ReactNode;
  prefixListSlot?: React.ReactNode;
}

export default function ArtifactEditor({
  adapter = mainSpineAdapter,
  initialSelectedId = null,
  copiedSlidePayload: externalCopiedSlidePayload,
  onCopySlidePayloadChange,
  hideList = false,
  allowImages = true,
  allowRename = true,
  bannerNote = null,
  prefixListSlot = null,
}: ArtifactEditorProps = {}) {
  const { t, locale } = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<import('fabric').Canvas | null>(null);
  const [templates, setTemplates] = useState<ArtifactTemplateSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialSelectedId ? [initialSelectedId] : [])
  );
  const [anchorId, setAnchorId] = useState<string | null>(initialSelectedId ?? null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [template, setTemplate] = useState<StoredArtifactTemplate | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [fontPopoverOpen, setFontPopoverOpen] = useState(false);
  const fontSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [fontColor, setFontColor] = useState(DEFAULT_FONT_COLOR);
  /** Committed font size: always finite and positive, safe for the server. */
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  /** Raw input text, so the admin can clear the field without writing a 0. */
  const [fontSizeInput, setFontSizeInput] = useState(String(DEFAULT_FONT_SIZE));
  const fontSizeInputRef = useRef<HTMLInputElement | null>(null);
  const [fontWeight, setFontWeight] = useState<'normal' | 'bold'>('normal');
  const [fontStyle, setFontStyle] = useState<'normal' | 'italic'>('normal');
  const [underline, setUnderline] = useState(false);
  const [letterSpacing, setLetterSpacing] = useState<number | undefined>(undefined);
  const [letterSpacingInput, setLetterSpacingInput] = useState<string>('0');
  const [lineHeight, setLineHeight] = useState<number>(TEXT_LINE_HEIGHT);
  const [textShadow, setTextShadow] = useState(false);
  const [shadowBlur, setShadowBlur] = useState<number>(4);
  const [shapeFill, setShapeFill] = useState('#5C2E16');
  const [strokeColor, setStrokeColor] = useState('#FFFFFF');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementIdsRef = useRef<string[]>(selectedElementIds);
  selectedElementIdsRef.current = selectedElementIds;
  const [selectedTextCount, setSelectedTextCount] = useState(0);
  const [selectedLineCount, setSelectedLineCount] = useState(0);
  const [selectedOutlineShapeCount, setSelectedOutlineShapeCount] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [fontUploading, setFontUploading] = useState(false);
  const fontImportInputRef = useRef<HTMLInputElement | null>(null);
  /** Elements authored in this session, not yet persisted. */
  const addedElementsRef = useRef<Map<string, CanvasElement>>(new Map());
  const addedPlaceholdersRef = useRef<Map<string, PlaceholderDefinition>>(
    new Map()
  );
  const insertCounterRef = useRef(0);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showBgDialog, setShowBgDialog] = useState(false);
  const [bgLibrary, setBgLibrary] = useState<Array<{ id: number; url: string }>>([]);
  const [availableSongSets, setAvailableSongSets] = useState<Array<{ variableName: string; title: string }>>([]);
  const [availableAnnSets, setAvailableAnnSets] = useState<Array<{ id: number; label: string }>>([]);
  const [newSlideType, setNewSlideType] = useState('general');
  const [drawingTool, setDrawingTool] = useState<'text' | 'rect' | 'line' | 'rect-outline' | null>(null);
  const drawingToolRef = useRef<'text' | 'rect' | 'line' | 'rect-outline' | null>(null);
  const previewShapeRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dragSourceIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const saveSequenceRef = useRef(0);
  const [liveElements, setLiveElements] = useState<CanvasElement[]>([]);
  const liveElementsRef = useRef(liveElements);
  liveElementsRef.current = liveElements;
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  const liveInstance: ArtifactInstance | null = useMemo(() => {
    if (!template) return null;
    const layout = getEditableLayout(template);
    if (!layout) return null;
    return {
      runtimeVersion: 1,
      instanceId: `editor-${template.id}`,
      templateId: template.id,
      label: template.label,
      baseType: template.baseType,
      layoutKey: 'default',
      layout: {
        aspectRatio: '16:9',
        backgroundColor: layout.backgroundColor || '#000000',
        backgroundImage: layout.backgroundImage,
        elements: liveElements.map((el) => ({
          id: el.id,
          type: el.type,
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          zIndex: el.zIndex,
          text: el.content ?? (el.placeholderKey ? `{${el.placeholderKey}}` : ''),
          wrapLines: el.wrapLines,
          longestWordPx: el.longestWordPx,
          measuredWith: el.measuredWith,
          imageUrl: el.imageRef,
          placeholderKey: el.placeholderKey,
          style: el.style ?? {},
        })),
      },
    };
  }, [template, liveElements]);

  const fitCanvasToShell = useCallback(() => {
    const shell = canvasShellRef.current;
    const canvas = fabricCanvasRef.current;
    if (!shell) return;
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    if (width <= 0 || height <= 0) return;
    const scale = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
    const stageW = Math.round(CANVAS_WIDTH * scale);
    const stageH = Math.round(CANVAS_HEIGHT * scale);
    setStageDimensions({ width: stageW, height: stageH });
    if (!canvas) return;
    // One scaling mechanism only: keep the logical canvas at 960×540 and let
    // Fabric's zoom scale the paint. Resize the wrapper element (the
    // `.canvas-container` Fabric auto-generates) so the visible stage fills
    // the shell — `cssOnly` setDimensions doubly scales content and leaves
    // the wrapper at 960×540, which is what produced the tiny-corner preview.
    canvas.setZoom(scale);
    const wrapper = canvas.wrapperEl;
    if (wrapper) {
      wrapper.style.width = `${stageW}px`;
      wrapper.style.height = `${stageH}px`;
      wrapper.style.position = 'absolute';
      wrapper.style.inset = '0';
    }
    canvas.calcOffset();
    canvas.requestRenderAll();
  }, []);
  const [insertPlaceholderKey, setInsertPlaceholderKey] = useState(
    PLACEHOLDER_CATALOG[0]?.key ?? 'date'
  );
  /**
   * Whether the mounted canvas carries authoring the server has not seen.
   *
   * In memory and nowhere else, per `AD-24`, which names this story as its live
   * instance: a layout parked in `localStorage` would escape the whole registry
   * write contract. This is a warning mechanism, not a recovery one.
   */
  const [isDirty, setIsDirty] = useState(false);
  const isHealingOnlyRef = useRef(false);
  const { setIsBlocked } = useNavigationBlocker();

  const [undoStack, setUndoStack] = useState<CanvasHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<CanvasHistorySnapshot[]>([]);
  const undoStackRef = useRef<CanvasHistorySnapshot[]>([]);
  undoStackRef.current = undoStack;
  const redoStackRef = useRef<CanvasHistorySnapshot[]>([]);
  redoStackRef.current = redoStack;
  const [isRestoringHistory, setIsRestoringHistory] = useState(false);
  const isRestoringHistoryRef = useRef(false);
  const pendingBaselineSnapshotRef = useRef<CanvasHistorySnapshot | null>(null);
  const pendingTextBaselineRef = useRef<CanvasHistorySnapshot | null>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const busy =
    status === 'loading' ||
    status === 'saving' ||
    status === 'creating' ||
    status === 'renaming' ||
    status === 'resetting' ||
    status === 'deleting' ||
    status === 'reordering';

  /** SPEC-24-02: Atomic user mutation guard: transition form to dirty and reset healing flag */
  const markUserDirty = useCallback(() => {
    if (isRestoringHistoryRef.current) return;
    isHealingOnlyRef.current = false;
    setIsDirty((current) => nextDirtyState(current, 'mutated'));
  }, []);

  const markDirty = markUserDirty;

  /** Mirrors Fabric's active selection into React (uncontrolled canvas stays the source). */
  const syncSelection = useCallback((canvas: import('fabric').Canvas) => {
    const active = canvas.getActiveObjects();
    setSelectedElementIds(
      active
        .map(getElementId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const texts: FabricTextLike[] = active.filter(isFabricTextObject);
    setSelectedTextCount(texts.length);
    const selectedText = texts[0];
    // The content field edits one box at a time; anything else clears it.
    setTextContent(texts.length === 1 && selectedText ? (selectedText.text ?? '') : '');
    if (selectedText) {
      const selectedId = getElementId(selectedText);
      const liveEl = liveElementsRef.current.find((e) => e.id === selectedId);
      const effectiveStyle = liveEl?.style ?? (selectedText as any).data?.style;

      setFontFamily(resolveCatalogFontFamily(selectedText.fontFamily || DEFAULT_FONT_FAMILY));
      setFontColor(
        effectiveStyle?.fontColor ??
          toStrictHexColor((selectedText as any).data?.style?.fontColor, DEFAULT_FONT_COLOR) ??
          DEFAULT_FONT_COLOR
      );
      const size = normalizeFontSize(selectedText.fontSize ?? effectiveStyle?.fontSize);
      setFontSize(size);
      if (!fontSizeInputRef.current || document.activeElement !== fontSizeInputRef.current) {
        setFontSizeInput(String(size));
      }
      setFontWeight((selectedText.fontWeight || effectiveStyle?.fontWeight) === 'bold' ? 'bold' : 'normal');
      setFontStyle((selectedText.fontStyle || effectiveStyle?.fontStyle) === 'italic' ? 'italic' : 'normal');
      setUnderline(Boolean((selectedText as any).underline ?? (effectiveStyle?.textDecoration === 'underline')));
      setLineHeight(
        typeof (selectedText as any).lineHeight === 'number'
          ? (selectedText as any).lineHeight
          : typeof effectiveStyle?.lineHeight === 'number'
            ? effectiveStyle.lineHeight
            : TEXT_LINE_HEIGHT
      );
      setTextShadow(Boolean(effectiveStyle?.textShadow));
      if (effectiveStyle?.textShadow && typeof effectiveStyle.textShadowBlur === 'number') {
        setShadowBlur(effectiveStyle.textShadowBlur);
      } else {
        setShadowBlur(4);
      }
      if (typeof effectiveStyle?.letterSpacing === 'number' && Number.isFinite(effectiveStyle.letterSpacing)) {
        setLetterSpacing(effectiveStyle.letterSpacing);
        setLetterSpacingInput(String(effectiveStyle.letterSpacing));
      } else {
        setLetterSpacing(undefined);
        setLetterSpacingInput('0');
      }
    }
    const lines = active.filter((obj) => (obj as any).type === 'line' || (obj as any).data?.isLine);
    setSelectedLineCount(lines.length);
    if (lines.length > 0) {
      const lineObj = lines[0] as any;
      const elId = getElementId(lineObj);
      const liveEl = liveElementsRef.current.find((e) => e.id === elId);
      const stroke = lineObj.stroke || liveEl?.style?.strokeColor || '#FFFFFF';
      const sw = typeof lineObj.strokeWidth === 'number' ? lineObj.strokeWidth : liveEl?.style?.strokeWidth ?? 2;
      setStrokeColor(toStrictHexColor(stroke, '#FFFFFF') ?? '#FFFFFF');
      setStrokeWidth(sw);
    }

    const shapes = active.filter((obj) => (obj as any).type === 'rect' && !(obj as any).data?.imageRef);
    const outlineShapes = shapes.filter((obj) => {
      const elId = getElementId(obj);
      const liveEl = liveElementsRef.current.find((e) => e.id === elId);
      return (obj as any).fill === 'transparent' || liveEl?.style?.fillColor === 'transparent';
    });
    setSelectedOutlineShapeCount(outlineShapes.length);
    if (outlineShapes.length > 0) {
      const shapeObj = outlineShapes[0] as any;
      const elId = getElementId(shapeObj);
      const liveEl = liveElementsRef.current.find((e) => e.id === elId);
      const stroke = shapeObj.stroke || liveEl?.style?.strokeColor || '#FFFFFF';
      const sw = typeof shapeObj.strokeWidth === 'number' ? shapeObj.strokeWidth : liveEl?.style?.strokeWidth ?? 2;
      setStrokeColor(toStrictHexColor(stroke, '#FFFFFF') ?? '#FFFFFF');
      setStrokeWidth(sw);
    } else if (shapes.length > 0) {
      setShapeFill(toStrictHexColor((shapes[0] as any).fill, '#5C2E16') ?? '#5C2E16');
    }
  }, []);

  const isEditable = template ? isCanvasAuthorable(template.baseType) : false;

  const takeSnapshot = useCallback((): CanvasHistorySnapshot | null => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !template) return null;
    const layout = getEditableLayout(template);
    if (!layout) return null;
    const serialized = serializeCanvas(
      canvas,
      layout,
      addedElementsRef.current,
      { isHealingSave: false }
    );
    return {
      elements: JSON.parse(JSON.stringify(serialized)),
      addedElements: new Map(addedElementsRef.current),
      addedPlaceholders: new Map(addedPlaceholdersRef.current),
      backgroundColor: layout.backgroundColor || '#000000',
      backgroundImage: layout.backgroundImage,
      isDirty: isDirtyRef.current,
    };
  }, [template]);

  const pushUndoSnapshot = useCallback((snapshot: CanvasHistorySnapshot) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > 50) next.shift();
      undoStackRef.current = next;
      return next;
    });
    setRedoStack([]);
    redoStackRef.current = [];
  }, []);

  const recordUndo = useCallback(() => {
    if (isRestoringHistoryRef.current) return;
    const snapshot = takeSnapshot();
    if (snapshot) {
      pushUndoSnapshot(snapshot);
    }
  }, [takeSnapshot, pushUndoSnapshot]);

  const restoreSnapshot = useCallback(
    async (snapshot: CanvasHistorySnapshot) => {
      isRestoringHistoryRef.current = true;
      const canvas = fabricCanvasRef.current;
      if (!canvas || !template) return;
      const layout = getEditableLayout(template);
      if (!layout) return;
      const fabric = await import('fabric');

      try {
        canvas.discardActiveObject();
        const objects = canvas.getObjects();
        for (const obj of objects) {
          canvas.remove(obj);
        }

        addedElementsRef.current = new Map(snapshot.addedElements);
        addedPlaceholdersRef.current = new Map(snapshot.addedPlaceholders);

        layout.elements = JSON.parse(JSON.stringify(snapshot.elements));
        layout.backgroundColor = snapshot.backgroundColor;
        if (snapshot.backgroundImage) {
          layout.backgroundImage = snapshot.backgroundImage;
        } else {
          delete layout.backgroundImage;
        }

        const painted = [...snapshot.elements]
          .map((element, index) => ({ element, index }))
          .sort((a, b) => a.element.zIndex - b.element.zIndex || a.index - b.index);

        for (const { element } of painted) {
          canvas.add(elementToFabricObject(fabric, element, true, { transparentProxy: true }));
        }

        setLiveElements(snapshot.elements);
        setIsDirty(snapshot.isDirty);
        syncSelection(canvas);
        canvas.requestRenderAll();
      } finally {
        setTimeout(() => {
          isRestoringHistoryRef.current = false;
        }, 0);
      }
    },
    [template, syncSelection]
  );

  const handleUndo = useCallback(async () => {
    if (busy || !isEditable || isRestoringHistoryRef.current) return;
    const currentUndo = undoStackRef.current;
    if (currentUndo.length === 0) return;

    const currentSnapshot = takeSnapshot();
    if (!currentSnapshot) return;

    isRestoringHistoryRef.current = true;
    setIsRestoringHistory(true);

    try {
      const targetSnapshot = currentUndo[currentUndo.length - 1];
      const nextUndo = currentUndo.slice(0, -1);
      const nextRedo = [...redoStackRef.current, currentSnapshot];

      undoStackRef.current = nextUndo;
      redoStackRef.current = nextRedo;
      setUndoStack(nextUndo);
      setRedoStack(nextRedo);

      await restoreSnapshot(targetSnapshot);
    } finally {
      isRestoringHistoryRef.current = false;
      setIsRestoringHistory(false);
    }
  }, [busy, isEditable, takeSnapshot, restoreSnapshot]);

  const handleRedo = useCallback(async () => {
    if (busy || !isEditable || isRestoringHistoryRef.current) return;
    const currentRedo = redoStackRef.current;
    if (currentRedo.length === 0) return;

    const currentSnapshot = takeSnapshot();
    if (!currentSnapshot) return;

    isRestoringHistoryRef.current = true;
    setIsRestoringHistory(true);

    try {
      const targetSnapshot = currentRedo[currentRedo.length - 1];
      const nextRedo = currentRedo.slice(0, -1);
      const nextUndo = [...undoStackRef.current, currentSnapshot];

      undoStackRef.current = nextUndo;
      redoStackRef.current = nextRedo;
      setUndoStack(nextUndo);
      setRedoStack(nextRedo);

      await restoreSnapshot(targetSnapshot);
    } finally {
      isRestoringHistoryRef.current = false;
      setIsRestoringHistory(false);
    }
  }, [busy, isEditable, takeSnapshot, restoreSnapshot]);

  const loadList = useCallback(async () => {
    const summaries = await adapter.list();
    setTemplates(summaries);
    return summaries;
  }, [adapter]);

  const loadTemplate = useCallback(async (id: string) => {
    setStatus('loading');
    setMessage(null);
    const data = await adapter.getOne(id);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
    pendingBaselineSnapshotRef.current = null;
    pendingTextBaselineRef.current = null;
    setTemplate(data);
    setDraftLabel(typeof data.label === 'string' ? data.label : '');
    // A new server copy remounts the canvas, and a freshly mounted canvas is
    // never dirty. This is the one place every remount comes through — the
    // first load, a template switch, and the reload behind a 409 — so it clears
    // here rather than in the mount effect. It is also the more accurate spot:
    // a *failed* load leaves the previous canvas mounted with its unsaved work
    // still on it, and that flag must survive.
    setIsDirty((current) => nextDirtyState(current, 'template-changed'));
    setStatus('idle');
  }, [adapter]);

  useEffect(() => {
    loadList()
      .then((summaries) => {
        setSelectedId((current) => resolveInitialSelectedId(current, initialSelectedId, summaries));
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('admin.artifacts.loadFailed'));
      });
    void fetchAvailableSongSets().then(setAvailableSongSets);
    void fetchAvailableAnnouncementSets().then(setAvailableAnnSets);
    void fetchBackgroundLibrary().then(setBgLibrary);
    void hydrateImportedFonts();
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [loadList, t]);

  useEffect(() => {
    drawingToolRef.current = drawingTool;
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      if (drawingTool) {
        canvas.discardActiveObject();
        canvas.skipTargetFind = true;
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
      } else {
        if (previewShapeRef.current) {
          canvas.remove(previewShapeRef.current);
          previewShapeRef.current = null;
        }
        canvas.skipTargetFind = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
      }
      canvas.requestRenderAll();
    }
    return () => {
      if (canvas) {
        if (previewShapeRef.current) {
          canvas.remove(previewShapeRef.current);
          previewShapeRef.current = null;
        }
        canvas.skipTargetFind = false;
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.hoverCursor = 'move';
      }
    };
  }, [drawingTool]);

  useEffect(() => {
    if (initialSelectedId && selectedId !== initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  useEffect(() => {
    if (selectedId) {
      setSelectedIds((current) => {
        if (!current.has(selectedId)) {
          return new Set([...current, selectedId]);
        }
        return current;
      });
      setAnchorId((current) => current ?? selectedId);
    } else if (templates.length === 0) {
      setSelectedIds(new Set());
      setAnchorId(null);
    }
  }, [selectedId, templates.length]);

  useEffect(() => {
    if (!selectedId) {
      setStatus((current) => (current === 'loading' ? 'idle' : current));
      return;
    }
    loadTemplate(selectedId).catch((err) => {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.loadOneFailed'));
    });
  }, [selectedId, loadTemplate, t]);

  useEffect(() => {
    let disposed = false;
    let removeCanvasListeners: (() => void) | undefined;

    async function mountCanvas() {
      if (!canvasRef.current || !template) return;
      // A fresh canvas means a fresh authoring session: anything added before is
      // either persisted (and back in layout.elements) or discarded.
      addedElementsRef.current = new Map();
      addedPlaceholdersRef.current = new Map();
      const layout = getEditableLayout(template);
      if (!layout) {
        fabricCanvasRef.current?.dispose();
        fabricCanvasRef.current = null;
        return;
      }

      const fabric = await import('fabric');
      if (disposed) return;

      fabricCanvasRef.current?.dispose();
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        selection: true,
        fireRightClick: true,
        stopContextMenu: true,
        backgroundColor: 'transparent',
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;
      // SPEC-37-01: Reconcile element fontStatus away from 'unresolved' if font is already acquired
      setLiveElements(
        layout.elements.map((el) => {
          if (el.type === 'text' && el.style?.fontFamily) {
            const fam = el.style.fontFamily;
            const isAcquired = isFontExportReady(fam) || Boolean(getFontDefinition(fam));
            if (isAcquired && el.style.fontStatus === 'unresolved') {
              return {
                ...el,
                style: {
                  ...el.style,
                  fontStatus: 'uploaded',
                },
              };
            }
          }
          return { ...el };
        })
      );

      const disposeCanvasIfAborted = () => {
        if (!disposed) return false;
        removeCanvasListeners?.();
        removeCanvasListeners = undefined;
        if (fabricCanvasRef.current === canvas) {
          canvas.dispose();
          fabricCanvasRef.current = null;
        }
        return true;
      };

      // SPEC-27 / SPEC-28 (Option A): Background image is rendered by ArtifactSlide (Visual Layer)
      // at the bottom of the stack. Fabric canvas is strictly a transparent interaction overlay
      // and must NOT set canvas.backgroundImage, which would paint over ArtifactSlide's text elements.
      canvas.backgroundImage = undefined;

      // SPEC-23-03: Await document.fonts.ready before constructing Fabric text objects
      // so layout and text measurements are never computed against fallback fonts.
      if (typeof document !== 'undefined' && 'fonts' in document && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // Degrade gracefully if font readiness promise rejects
        }
      }

      if (disposeCanvasIfAborted()) return;

      // The PPTX exporter and the web slideshow both paint in `zIndex` order,
      // so the canvas must stack the same way or the admin edits an overlap
      // that does not match the real output. Source order breaks ties.
      const painted = layout.elements
        .map((element, index) => ({ element, index }))
        .sort((a, b) => a.element.zIndex - b.element.zIndex || a.index - b.index);
      for (const { element } of painted) {
        canvas.add(elementToFabricObject(fabric, element, true, { transparentProxy: true }));
      }

      const onSelectionChange = () => {
        syncSelection(canvas);
      };
      canvas.on('selection:created', onSelectionChange);
      canvas.on('selection:updated', onSelectionChange);
      canvas.on('selection:cleared', onSelectionChange);

      const onBeforeTransform = () => {
        if (!isRestoringHistoryRef.current && !pendingBaselineSnapshotRef.current) {
          pendingBaselineSnapshotRef.current = takeSnapshot();
        }
      };
      canvas.on('before:transform' as any, onBeforeTransform);

      let dragStart: { x: number; y: number } | null = null;
      const onMouseDown = (opt: any) => {
        if (!drawingToolRef.current && !isRestoringHistoryRef.current && !pendingBaselineSnapshotRef.current) {
          const target = canvas.findTarget?.(opt.e) || canvas.getActiveObject();
          if (target) {
            pendingBaselineSnapshotRef.current = takeSnapshot();
          }
        }
        const tool = drawingToolRef.current;
        if (!tool) return;
        const pointer = canvas.getScenePoint(opt.e);
        dragStart = { x: pointer.x, y: pointer.y };

        if (previewShapeRef.current) {
          canvas.remove(previewShapeRef.current);
          previewShapeRef.current = null;
        }

        const preview =
          tool === 'line'
            ? new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                stroke: strokeColor || '#FFFFFF',
                strokeWidth: strokeWidth || 2,
                selectable: false,
                evented: false,
              })
            : tool === 'rect-outline'
              ? new fabric.Rect({
                  left: pointer.x,
                  top: pointer.y,
                  width: 0,
                  height: 0,
                  fill: 'transparent',
                  stroke: strokeColor || '#FFFFFF',
                  strokeWidth: strokeWidth || 2,
                  strokeDashArray: [4, 4],
                  selectable: false,
                  evented: false,
                })
              : tool === 'rect'
                ? new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: 'rgba(92, 46, 22, 0.25)',
                    stroke: '#5C2E16',
                    strokeWidth: 1.5,
                    strokeDashArray: [4, 4],
                    selectable: false,
                    evented: false,
                  })
                : new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 0,
                    height: 0,
                    fill: 'rgba(37, 99, 235, 0.15)',
                    stroke: '#2563EB',
                    strokeWidth: 1.5,
                    strokeDashArray: [4, 4],
                    selectable: false,
                    evented: false,
                  });
        previewShapeRef.current = preview;
        canvas.add(preview);
        canvas.requestRenderAll();
      };
      const onMouseMove = (opt: any) => {
        const tool = drawingToolRef.current;
        if (!tool || !dragStart || !previewShapeRef.current) return;
        const pointer = canvas.getScenePoint(opt.e);
        if (tool === 'line') {
          previewShapeRef.current.set({ x2: pointer.x, y2: pointer.y });
        } else {
          const left = Math.min(dragStart.x, pointer.x);
          const top = Math.min(dragStart.y, pointer.y);
          const width = Math.abs(pointer.x - dragStart.x);
          const height = Math.abs(pointer.y - dragStart.y);
          previewShapeRef.current.set({ left, top, width, height });
        }
        canvas.requestRenderAll();
      };
      const onMouseUp = (opt: any) => {
        if (!isRestoringHistoryRef.current && pendingBaselineSnapshotRef.current) {
          setTimeout(() => {
            pendingBaselineSnapshotRef.current = null;
          }, 50);
        }
        const tool = drawingToolRef.current;
        if (previewShapeRef.current) {
          canvas.remove(previewShapeRef.current);
          previewShapeRef.current = null;
        }
        if (!tool || !dragStart) return;
        const pointer = canvas.getScenePoint(opt.e);
        const start = dragStart;
        dragStart = null;
        if (tool === 'line') {
          const dx = Math.abs(pointer.x - start.x);
          const dy = Math.abs(pointer.y - start.y);
          const x = Math.min(start.x, pointer.x);
          const y = Math.min(start.y, pointer.y);
          let w = dx;
          let h = dy;
          if (dx < 10 && dy < 10) {
            w = 400;
            h = 0;
          }
          void insertDrawnElement('line', x, y, w, h);
        } else if (tool === 'rect-outline') {
          const dx = Math.abs(pointer.x - start.x);
          const dy = Math.abs(pointer.y - start.y);
          let x = Math.min(start.x, pointer.x);
          let y = Math.min(start.y, pointer.y);
          let w = dx;
          let h = dy;
          if (dx < 10 && dy < 10) {
            const def = NEW_SHAPE_SIZE_PX;
            w = def.w;
            h = def.h;
          }
          void insertDrawnElement('shape', x, y, w, h, { isOutline: true });
        } else {
          const dx = Math.abs(pointer.x - start.x);
          const dy = Math.abs(pointer.y - start.y);
          let x = Math.min(start.x, pointer.x);
          let y = Math.min(start.y, pointer.y);
          let w = dx;
          let h = dy;
          if (dx < 10 && dy < 10) {
            const def = tool === 'text' ? NEW_TEXT_SIZE_PX : NEW_SHAPE_SIZE_PX;
            w = def.w;
            h = def.h;
          }
          void insertDrawnElement(tool === 'rect' ? 'shape' : 'text', x, y, w, h);
        }
        setDrawingTool(null);
      };
      canvas.on('mouse:down', onMouseDown);
      canvas.on('mouse:move', onMouseMove);
      canvas.on('mouse:up', onMouseUp);

      // Native DOM listener on upperCanvasEl: Fabric wraps canvas in an upper-canvas DOM layer
      // that receives pointer events. Handling contextmenu here guarantees reliable execution.
      const upperCanvasEl = canvas.upperCanvasEl;
      const onNativeContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        const shell = canvasShellRef.current;
        const rect = shell ? shell.getBoundingClientRect() : null;
        handleContextMenuTrigger(
          e,
          canvas,
          rect,
          syncSelection,
          setContextMenu
        );
      };
      upperCanvasEl?.addEventListener('contextmenu', onNativeContextMenu);

      // SPEC-14-01 / SPEC-26-02 / SPEC-27-02: On active object moving, synchronize clipPath coordinates & live elements
      const onObjectMoving = (opt: any) => {
        if (isRestoringHistoryRef.current) return;
        markUserDirty();
        const target = opt.target;
        if (target) {
          const targetData = ((target as any).data = (target as any).data || {});
          targetData.userMoved = true;
          if (syncImageClipOnMove(target) || syncTextClipOnMove(target)) {
            canvas.requestRenderAll();
          }
          const id = getElementId(target);
          if (id) {
            const left = target.left ?? 0;
            const top = target.top ?? 0;
            setLiveElements((prev) =>
              prev.map((el) =>
                el.id === id
                  ? {
                      ...el,
                      x: pxToPct(left, CANVAS_WIDTH),
                      y: pxToPct(top, CANVAS_HEIGHT),
                    }
                  : el
              )
            );
          }
        }
      };
      canvas.on('object:moving', onObjectMoving);

      // SPEC-15-01 / SPEC-26-02 / SPEC-27-02 / SPEC-28-03: On active object scaling, synchronize clipPath coordinates, dimensions & live elements
      const onObjectScaling = (opt: any) => {
        if (isRestoringHistoryRef.current) return;
        markUserDirty();
        const target = opt.target;
        if (target) {
          const targetData = ((target as any).data = (target as any).data || {});
          const corner = opt.transform?.corner;
          const isVert =
            corner === 'mt' ||
            corner === 'mb' ||
            corner === 'tl' ||
            corner === 'tr' ||
            corner === 'bl' ||
            corner === 'br';
          const isHoriz =
            corner === 'ml' ||
            corner === 'mr' ||
            corner === 'tl' ||
            corner === 'tr' ||
            corner === 'bl' ||
            corner === 'br';

          const isGroup = target.type === 'activeSelection' && Array.isArray((target as any)._objects);
          const memberObjects = isGroup ? (target as any)._objects : [target];

          for (const member of memberObjects) {
            const mData = ((member as any).data = (member as any).data || {});
            if (isHoriz) {
              mData.userResizedWidth = true;
            }
            if (isVert) {
              mData.userResizedHeight = true;
              mData.heightChange = 'user-resize';
            }
          }

          // SPEC-28-03: Enforce minimum height floor clamp on text objects in reference pixels
          const textObjects = isGroup
            ? memberObjects.filter(isFabricTextObject)
            : isFabricTextObject(target)
              ? [target]
              : [];

          for (const textObj of textObjects) {
            const id = getElementId(textObj);
            const liveEl = liveElementsRef.current.find((e) => e.id === id);
            const fSize = normalizeFontSize(textObj.fontSize ?? liveEl?.style?.fontSize);
            const lHeight =
              typeof textObj.lineHeight === 'number'
                ? textObj.lineHeight
                : typeof liveEl?.style?.lineHeight === 'number'
                  ? liveEl.style.lineHeight
                  : TEXT_LINE_HEIGHT;
            const minH = computeMinTextHeightRefPx(fSize, lHeight);
            const groupScaleY = isGroup ? Math.abs(target.scaleY ?? 1) : 1;
            const memberScaleY = Math.abs(textObj.scaleY ?? 1);
            const effH = (textObj.height ?? 0) * memberScaleY * groupScaleY;
            if (effH < minH && textObj.height && textObj.height > 0) {
              if (isGroup && target.height && target.height > 0) {
                const requiredGroupScaleY = minH / ((textObj.height ?? 0) * memberScaleY);
                if (Math.abs(target.scaleY ?? 1) < requiredGroupScaleY) {
                  target.scaleY = (target.scaleY ?? 1) < 0 ? -requiredGroupScaleY : requiredGroupScaleY;
                }
              } else {
                const neededScaleY = minH / textObj.height;
                textObj.scaleY = (textObj.scaleY ?? 1) < 0 ? -neededScaleY : neededScaleY;
              }
            }
          }

          if (syncImageClipOnScale(target) || syncTextClipOnScale(target)) {
            canvas.requestRenderAll();
          }

          for (const member of memberObjects) {
            const id = getElementId(member);
            if (id) {
              const scaleX = Math.abs((member.scaleX ?? 1) * (isGroup ? target.scaleX ?? 1 : 1));
              const scaleY = Math.abs((member.scaleY ?? 1) * (isGroup ? target.scaleY ?? 1 : 1));
              const w = (member.width ?? 100) * scaleX;
              const h = (member.height ?? 50) * scaleY;
              const left = member.left ?? 0;
              const top = member.top ?? 0;
              setLiveElements((prev) =>
                prev.map((el) =>
                  el.id === id
                    ? {
                        ...el,
                        x: pxToPct(left, CANVAS_WIDTH),
                        y: pxToPct(top, CANVAS_HEIGHT),
                        w: pxToPct(w, CANVAS_WIDTH),
                        h: pxToPct(h, CANVAS_HEIGHT),
                      }
                    : el
                )
              );
            }
          }
        }
      };
      canvas.on('object:scaling', onObjectScaling);
      canvas.on('object:resizing', markUserDirty);

      // SPEC-13-03 / SPEC-26-02 / SPEC-27-02 / SPEC-28-03: On object scaling/modification, recalculate fit & sync live elements
      const onObjectModified = (opt: any) => {
        if (isRestoringHistoryRef.current) return;
        if (pendingBaselineSnapshotRef.current) {
          pushUndoSnapshot(pendingBaselineSnapshotRef.current);
          pendingBaselineSnapshotRef.current = null;
        }
        markUserDirty();
        const target = opt.target;
        const action = opt?.action || opt?.transform?.action;
        if (target) {
          const isGroup = target.type === 'activeSelection' && Array.isArray((target as any)._objects);
          const memberObjects = isGroup ? (target as any)._objects : [target];

          for (const member of memberObjects) {
            const scaleX = Math.abs(member.scaleX ?? 1);
            const scaleY = Math.abs(member.scaleY ?? 1);
            if (scaleX !== 1 || scaleY !== 1) {
              member.set({
                width: (member.width ?? 100) * scaleX,
                height: (member.height ?? 50) * scaleY,
                scaleX: 1,
                scaleY: 1,
              });
              member.setCoords?.();
            }
            const id = getElementId(member);
            const mData = member ? ((member as any).data = (member as any).data || {}) : null;
            if (id) {
              const w = member.width ?? 100;
              const h = member.height ?? 50;
              const left = member.left ?? 0;
              const top = member.top ?? 0;
              setLiveElements((prev) =>
                prev.map((el) =>
                  el.id === id
                    ? {
                        ...el,
                        x: pxToPct(left, CANVAS_WIDTH),
                        y: pxToPct(top, CANVAS_HEIGHT),
                        w: pxToPct(w, CANVAS_WIDTH),
                        h: pxToPct(h, CANVAS_HEIGHT),
                      }
                    : el
                )
              );
              if (mData) {
                mData.authoredWidth = w;
                mData.authoredHeight = h;
              }
            }
          }

          if (action === 'drag' || action === 'move') {
            for (const member of memberObjects) {
              const mData = member ? ((member as any).data = (member as any).data || {}) : null;
              if (mData) mData.userMoved = true;
              syncImageClipOnMove(member);
              syncTextClipOnMove(member);
            }
            return;
          }
          if (target && target.data?.imageRef) {
            if (updateImageElementFit(target, fabric)) {
              canvas.requestRenderAll();
            }
          }
          if (syncImageClipOnScale(target) || syncTextClipOnScale(target)) {
            canvas.requestRenderAll();
          }
          syncSelection(canvas);
        }
      };
      canvas.on('object:modified', onObjectModified);

      const onTextChanged = (opt: any) => {
        if (isRestoringHistoryRef.current) return;
        markUserDirty();
        const target = opt.target;
        const targetData = target ? ((target as any).data = (target as any).data || {}) : null;
        if (target && isFabricTextObject(target) && targetData) {
          targetData.userEditedText = true;
          const id = getElementId(target);
          const newText = target.text ?? '';
          if (id) {
            const liveEl = liveElementsRef.current.find((e) => e.id === id);
            const fSize = normalizeFontSize(target.fontSize ?? liveEl?.style?.fontSize);
            const lHeight =
              typeof target.lineHeight === 'number'
                ? target.lineHeight
                : typeof liveEl?.style?.lineHeight === 'number'
                  ? liveEl.style.lineHeight
                  : TEXT_LINE_HEIGHT;
            const currentW =
              typeof targetData.authoredWidth === 'number' && targetData.authoredWidth > 0
                ? targetData.authoredWidth
                : typeof liveEl?.w === 'number'
                  ? pctToPx(liveEl.w, CANVAS_WIDTH)
                  : (target.width ?? 100) * Math.abs(target.scaleX ?? 1);
            const currentH =
              typeof targetData.authoredHeight === 'number' && targetData.authoredHeight > 0
                ? targetData.authoredHeight
                : typeof liveEl?.h === 'number'
                  ? pctToPx(liveEl.h, CANVAS_HEIGHT)
                  : (target.height ?? 50) * Math.abs(target.scaleY ?? 1);
            const currentTopPx =
              typeof target.top === 'number'
                ? target.top
                : liveEl?.y
                  ? pctToPx(liveEl.y, CANVAS_HEIGHT)
                  : 0;

            const { boundedRequiredHeight, shouldExpand } = computeAutoExpandedHeight({
              textContent: newText,
              authoredWidthPx: currentW,
              authoredHeightPx: currentH,
              fontSizePx: fSize,
              lineHeight: lHeight,
              fontFamily: liveEl?.style?.fontFamily || target.fontFamily,
              fontWeight: String(liveEl?.style?.fontWeight || target.fontWeight || 'normal'),
              fontStyle: String(liveEl?.style?.fontStyle || target.fontStyle || 'normal'),
              topPx: currentTopPx,
            });

            if (shouldExpand) {
              target.set({ height: boundedRequiredHeight, scaleY: 1 });
              target.setCoords?.();
              targetData.authoredHeight = boundedRequiredHeight;
              targetData.heightChange = 'font-size-auto';
              syncTextClipOnScale(target);
              setLiveElements((prev) =>
                prev.map((el) =>
                  el.id === id
                    ? {
                        ...el,
                        content: newText,
                        h: pxToPct(boundedRequiredHeight, CANVAS_HEIGHT),
                      }
                    : el
                )
              );
            } else {
              setLiveElements((prev) =>
                prev.map((el) => (el.id === id ? { ...el, content: newText } : el))
              );
            }
          }
          // SPEC-28-01: Transparent proxies must not be mutated by applyFabricTextFit
          if (!targetData.isTransparentProxy) {
            const boxW = targetData.authoredWidth ?? target.width ?? 100;
            const boxH = targetData.authoredHeight ?? target.height ?? 100;
            const elementStub: CanvasElement = {
              id: targetData.elementId ?? 'text',
              type: 'text',
              required: false,
              x: pxToPct(target.left ?? 0, CANVAS_WIDTH),
              y: pxToPct(target.top ?? 0, CANVAS_HEIGHT),
              w: pxToPct(boxW, CANVAS_WIDTH),
              h: pxToPct(boxH, CANVAS_HEIGHT),
              zIndex: 0,
              content: target.text ?? '',
              style: {
                fontSize: typeof target.fontSize === 'number' ? target.fontSize : undefined,
                lineHeight: typeof (target as any).lineHeight === 'number' ? (target as any).lineHeight : undefined,
                fontFamily: target.fontFamily,
                fontWeight: target.fontWeight !== undefined ? String(target.fontWeight) : undefined,
                fontStyle: target.fontStyle,
              },
            };
            applyFabricTextFit(target, elementStub, fabric);
          } else {
            target.set({ fill: 'transparent', stroke: 'transparent', shadow: null });
          }
          canvas.requestRenderAll();
        }
      };
      canvas.on('text:changed', onTextChanged);

      const onTextEditingEntered = () => {
        if (!isRestoringHistoryRef.current && !pendingTextBaselineRef.current) {
          pendingTextBaselineRef.current = takeSnapshot();
        }
      };
      const onTextEditingExited = () => {
        if (!isRestoringHistoryRef.current && pendingTextBaselineRef.current) {
          pushUndoSnapshot(pendingTextBaselineRef.current);
          pendingTextBaselineRef.current = null;
        }
      };
      canvas.on('text:editing:entered' as any, onTextEditingEntered);
      canvas.on('text:editing:exited' as any, onTextEditingExited);

      // Registered here and not one line earlier: the paint loop above calls
      // `canvas.add()` for every seed element, and `canvas.add()` fires
      // `object:added`. Attached any sooner, a fresh mount would mark itself
      // dirty and the guard would fire on a canvas nobody has touched.
      for (const event of CANVAS_MUTATION_EVENTS) {
        canvas.on(event, markDirty);
      }
      removeCanvasListeners = () => {
        canvas.off('selection:created', onSelectionChange);
        canvas.off('selection:updated', onSelectionChange);
        canvas.off('selection:cleared', onSelectionChange);
        canvas.off('before:transform' as any, onBeforeTransform);
        canvas.off('mouse:down', onMouseDown);
        canvas.off('mouse:move', onMouseMove);
        canvas.off('mouse:up', onMouseUp);
        canvas.off('object:moving', onObjectMoving);
        canvas.off('object:scaling', onObjectScaling);
        canvas.off('object:resizing', markUserDirty);
        canvas.off('object:modified', onObjectModified);
        canvas.off('text:changed', onTextChanged);
        canvas.off('text:editing:entered' as any, onTextEditingEntered);
        canvas.off('text:editing:exited' as any, onTextEditingExited);
        upperCanvasEl?.removeEventListener('contextmenu', onNativeContextMenu);
        for (const event of CANVAS_MUTATION_EVENTS) {
          canvas.off(event, markDirty);
        }
      };

      if (disposeCanvasIfAborted()) return;

      // SPEC-24-01: Decouple background healing from navigation dirty-state guard.
      // An unmeasured template does NOT call markDirty() on mount, preserving clean navigation.
      isHealingOnlyRef.current = false;

      canvas.requestRenderAll();
      fitCanvasToShell();
      // `aspect-video` may not have a computed height on the first frame, so
      // retry once on the next tick. Without this, the shell stays at
      // height=0 → scale=0 and the canvas collapses to a thread of pixels.
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => fitCanvasToShell());
      }
    }

    mountCanvas().catch((err) => {
      if (disposed) return;
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.canvasFailed'));
    });

    return () => {
      disposed = true;
      if (previewShapeRef.current) {
        fabricCanvasRef.current?.remove(previewShapeRef.current);
        previewShapeRef.current = null;
      }
      // Before `dispose()`, which is the existing order and now load-bearing
      // twice over: a mutation listener still attached while the canvas tears
      // itself down would mark the outgoing template dirty on its way out.
      removeCanvasListeners?.();
      removeCanvasListeners = undefined;
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
  }, [template, syncSelection, markDirty, fitCanvasToShell]);

  const insertDrawnElement = useCallback(
    async (
      kind: 'text' | 'shape' | 'line',
      xPx: number,
      yPx: number,
      wPx: number,
      hPx: number,
      options?: { isOutline?: boolean }
    ) => {
      const canvas = fabricCanvasRef.current;
      const layout = template ? getEditableLayout(template) : null;
      if (!canvas || !layout) return;

      recordUndo();

      const usedIds = new Set<string>([
        ...layout.elements.map((e) => e.id),
        ...addedElementsRef.current.keys(),
        ...canvas
          .getObjects()
          .map(getElementId)
          .filter((id): id is string => typeof id === 'string'),
      ]);
      insertCounterRef.current += 1;
      const id = nextElementId(usedIds, insertCounterRef.current);
      const maxZ = [
        ...layout.elements,
        ...addedElementsRef.current.values(),
      ].reduce((acc, e) => Math.max(acc, e.zIndex), -1);

      const isLine = kind === 'line';
      const isOutline = options?.isOutline;

      const element: CanvasElement = {
        id,
        type: kind,
        required: false,
        x: pxToPct(xPx, CANVAS_WIDTH),
        y: pxToPct(yPx, CANVAS_HEIGHT),
        w: pxToPct(wPx, CANVAS_WIDTH),
        h: pxToPct(hPx, CANVAS_HEIGHT),
        zIndex: maxZ + 1,
        ...(isLine
          ? {
              style: {
                strokeColor: strokeColor || '#FFFFFF',
                strokeWidth: strokeWidth || 2,
              },
            }
          : isOutline
            ? {
                style: {
                  fillColor: 'transparent',
                  strokeColor: strokeColor || '#FFFFFF',
                  strokeWidth: strokeWidth || 2,
                  opacity: 1,
                },
              }
            : kind === 'text'
              ? {
                  content: NEW_TEXT_CONTENT,
                  style: {
                    fontFamily: fontFamily || DEFAULT_FONT_FAMILY,
                    fontSize,
                    fontColor,
                    fontWeight: 'normal',
                    textAlign: 'left' as const,
                  },
                }
              : { style: { fillColor: NEW_SHAPE_FILL, opacity: 1 } }),
      };

      const fabric = await import('fabric');
      if (fabricCanvasRef.current !== canvas) return;

      addedElementsRef.current.set(id, element);
      setLiveElements((prev) => [...prev, element]);
      const obj = elementToFabricObject(fabric, element, true, { transparentProxy: true });
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      syncSelection(canvas);
      markDirty();
      setStatus('idle');
      setMessage(null);
    },
    [template, fontFamily, fontColor, fontSize, strokeColor, strokeWidth, syncSelection, markDirty, recordUndo]
  );

  const handleChangeBackgroundUrl = useCallback(
    async (url: string | null) => {
      const canvas = fabricCanvasRef.current;
      const layout = template ? getEditableLayout(template) : null;
      if (!canvas || !layout) return;

      const fabric = await import('fabric');
      if (fabricCanvasRef.current !== canvas) return;

      if (url) {
        try {
          const bg = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
          if (fabricCanvasRef.current !== canvas) return;
          if (!bg || !bg.width) {
            toast.error('Failed to load background: invalid image');
            return;
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to load background');
          return;
        }
      }

      recordUndo();

      // In Option A, ArtifactSlide (Visual Layer) renders the background image.
      // Fabric canvas overlay remains completely transparent.
      canvas.backgroundImage = undefined;
      if (url) {
        layout.backgroundImage = url;
      } else {
        delete layout.backgroundImage;
      }

      // SPEC-13-09 / DEC-014: Replace existing background element instead of stacking extra layers
      const bgElements = (layout.elements ?? []).filter(isBackgroundElement);
      for (const bgEl of bgElements) {
        addedElementsRef.current.delete(bgEl.id);
        const obj = canvas.getObjects().find((o) => getElementId(o) === bgEl.id);
        if (obj) canvas.remove(obj);
      }
      layout.elements = filterOutBackgroundElements(layout.elements ?? []);

      setTemplate((prev) => (prev ? { ...prev } : prev));
      canvas.requestRenderAll();
      syncSelection(canvas);
      markDirty();
      setShowBgDialog(false);
    },
    [template, syncSelection, markDirty]
  );

  const handleUploadBackgroundFile = useCallback(
    async (file: File) => {
      try {
        const { url } = await uploadImageFile(file);
        await handleChangeBackgroundUrl(url);
        toast.success(t('admin.artifacts.saved'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload background');
      }
    },
    [handleChangeBackgroundUrl, t]
  );

  const insertElement = useCallback(
    async (kind: 'text' | 'shape' | 'line' | 'rect-outline') => {
      const canvas = fabricCanvasRef.current;
      const layout = template ? getEditableLayout(template) : null;
      if (!canvas || !layout) return;

      recordUndo();

      const usedIds = new Set<string>([
        ...layout.elements.map((e) => e.id),
        ...addedElementsRef.current.keys(),
        ...canvas
          .getObjects()
          .map(getElementId)
          .filter((id): id is string => typeof id === 'string'),
      ]);
      const id = nextElementId(usedIds, insertCounterRef.current);
      const step = insertCounterRef.current % INSERT_CASCADE_STEPS;
      insertCounterRef.current += 1;

      const isLine = kind === 'line';
      const isOutline = kind === 'rect-outline';
      const size = isLine
        ? { w: 400, h: 2 }
        : kind === 'text'
          ? NEW_TEXT_SIZE_PX
          : NEW_SHAPE_SIZE_PX;
      const offset = step * INSERT_CASCADE_PX;
      const leftPx = (CANVAS_WIDTH - size.w) / 2 + offset;
      const topPx = (CANVAS_HEIGHT - size.h) / 2 + offset;
      const maxZ = [
        ...layout.elements,
        ...addedElementsRef.current.values(),
      ].reduce((acc, e) => Math.max(acc, e.zIndex), -1);

      const element: CanvasElement = {
        id,
        type: isLine ? 'line' : isOutline ? 'shape' : kind,
        required: false,
        x: pxToPct(leftPx, CANVAS_WIDTH),
        y: pxToPct(topPx, CANVAS_HEIGHT),
        w: pxToPct(size.w, CANVAS_WIDTH),
        h: pxToPct(size.h, CANVAS_HEIGHT),
        zIndex: maxZ + 1,
        ...(isLine
          ? {
              style: {
                strokeColor: strokeColor || '#FFFFFF',
                strokeWidth: strokeWidth || 2,
              },
            }
          : isOutline
            ? {
                style: {
                  fillColor: 'transparent',
                  strokeColor: strokeColor || '#FFFFFF',
                  strokeWidth: strokeWidth || 2,
                  opacity: 1,
                },
              }
            : kind === 'text'
              ? {
                  content: NEW_TEXT_CONTENT,
                  style: {
                    fontFamily: fontFamily || DEFAULT_FONT_FAMILY,
                    fontSize,
                    fontColor,
                    fontWeight: 'normal',
                    textAlign: 'left' as const,
                  },
                }
              : { style: { fillColor: NEW_SHAPE_FILL, opacity: 1 } }),
      };

      const fabric = await import('fabric');
      if (fabricCanvasRef.current !== canvas) return;

      addedElementsRef.current.set(id, element);
      setLiveElements((prev) => [...prev, element]);
      const obj = elementToFabricObject(fabric, element, true, { transparentProxy: true });
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      syncSelection(canvas);
      // Redundant on paper — `canvas.add` above fires `object:added`, which the
      // mutation listener already turns into this same call — and kept on
      // purpose. `markDirty` is idempotent, and the four explicit-edit handlers
      // are required to raise the flag themselves rather than inherit it from a
      // listener registered elsewhere in the file: two of the four
      // (`applyTextStyle`, `handleTextContentChange`) raise no Fabric event at
      // all, so the set only reads consistently if all four are explicit. Not
      // dead code; deleting it makes this handler depend on a registration two
      // hundred lines away.
      markDirty();
      setStatus('idle');
      setMessage(null);
    },
    [template, fontFamily, fontColor, fontSize, strokeColor, strokeWidth, syncSelection, markDirty, recordUndo]
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const insertImage = useCallback(
    async (file: File) => {
      const canvas = fabricCanvasRef.current;
      const layout = template ? getEditableLayout(template) : null;
      if (!canvas || !layout) return;

      setStatus('saving');
      setMessage(null);
      let url = '';
      try {
        const uploaded = await uploadImageFile(file);
        url = uploaded.url;
      } catch (err: unknown) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : t('admin.artifacts.uploadImageFailed'));
        toast(err instanceof Error ? err.message : t('admin.artifacts.uploadImageFailed'));
        return;
      }

      recordUndo();

      const usedIds = new Set<string>([
        ...layout.elements.map((e) => e.id),
        ...addedElementsRef.current.keys(),
        ...canvas
          .getObjects()
          .map(getElementId)
          .filter((id): id is string => typeof id === 'string'),
      ]);
      const id = nextElementId(usedIds, insertCounterRef.current);
      const step = insertCounterRef.current % INSERT_CASCADE_STEPS;
      insertCounterRef.current += 1;

      const size = NEW_SHAPE_SIZE_PX;
      const offset = step * INSERT_CASCADE_PX;
      const leftPx = (CANVAS_WIDTH - size.w) / 2 + offset;
      const topPx = (CANVAS_HEIGHT - size.h) / 2 + offset;
      const maxZ = [
        ...layout.elements,
        ...addedElementsRef.current.values(),
      ].reduce((acc, e) => Math.max(acc, e.zIndex), -1);

      const element: CanvasElement = {
        id,
        type: 'image',
        required: false,
        x: pxToPct(leftPx, CANVAS_WIDTH),
        y: pxToPct(topPx, CANVAS_HEIGHT),
        w: pxToPct(size.w, CANVAS_WIDTH),
        h: pxToPct(size.h, CANVAS_HEIGHT),
        zIndex: maxZ + 1,
        imageRef: url,
      };

      const fabric = await import('fabric');
      if (fabricCanvasRef.current !== canvas) {
        setStatus('idle');
        return;
      }

      addedElementsRef.current.set(id, element);
      setLiveElements((prev) => [...prev, element]);
      const obj = elementToFabricObject(fabric, element, true, { transparentProxy: true });
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      syncSelection(canvas);
      markDirty();
      setStatus('idle');
      setMessage(null);
    },
    [template, syncSelection, markDirty, t]
  );

  const handleReorderLayer = useCallback(
    (action: 'forward' | 'backward' | 'front' | 'back') => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObjects();
      if (active.length === 0) return;

      // Sort objects: top-down for forward/front, bottom-up for backward/back
      const objects = canvas.getObjects();
      const sorted = [...active].sort((a, b) => {
        const idxA = objects.indexOf(a);
        const idxB = objects.indexOf(b);
        return action === 'forward' || action === 'front' ? idxB - idxA : idxA - idxB;
      });

      recordUndo();
      let changed = false;
      for (const obj of sorted) {
        if (action === 'forward') {
          if (canvas.bringObjectForward(obj)) changed = true;
        } else if (action === 'backward') {
          if (canvas.sendObjectBackwards(obj)) changed = true;
        } else if (action === 'front') {
          if (canvas.bringObjectToFront(obj)) changed = true;
        } else if (action === 'back') {
          if (canvas.sendObjectToBack(obj)) changed = true;
        }
      }

      if (changed) {
        canvas.requestRenderAll();
        syncSelection(canvas);
        markDirty();
      }
    },
    [syncSelection, markDirty]
  );

  const insertPlaceholder = useCallback(
    async (key: string) => {
      const canvas = fabricCanvasRef.current;
      const layout = template ? getEditableLayout(template) : null;
      const entry = catalogEntry(key);
      if (!template || !canvas || !layout || !entry) return;

      const alreadyDeclared =
        template.placeholders.some((placeholder) => placeholder.key === key) ||
        addedPlaceholdersRef.current.has(key);
      recordUndo();
      if (!alreadyDeclared) {
        addedPlaceholdersRef.current.set(key, {
          key: entry.key,
          type: entry.type,
          required: false,
        });
      }

      const usedIds = new Set<string>([
        ...layout.elements.map((element) => element.id),
        ...addedElementsRef.current.keys(),
        ...canvas
          .getObjects()
          .map(getElementId)
          .filter((id): id is string => typeof id === 'string'),
      ]);
      const id = nextElementId(usedIds, insertCounterRef.current);
      const step = insertCounterRef.current % INSERT_CASCADE_STEPS;
      insertCounterRef.current += 1;

      const size =
        entry.type === 'image' ? NEW_SHAPE_SIZE_PX : NEW_TEXT_SIZE_PX;
      const offset = step * INSERT_CASCADE_PX;
      const leftPx = (CANVAS_WIDTH - size.w) / 2 + offset;
      const topPx = (CANVAS_HEIGHT - size.h) / 2 + offset;
      const maxZ = [
        ...layout.elements,
        ...addedElementsRef.current.values(),
      ].reduce((acc, element) => Math.max(acc, element.zIndex), -1);

      const element: CanvasElement = {
        id,
        type: entry.type === 'image' ? 'image-placeholder' : 'text',
        required: false,
        x: pxToPct(leftPx, CANVAS_WIDTH),
        y: pxToPct(topPx, CANVAS_HEIGHT),
        w: pxToPct(size.w, CANVAS_WIDTH),
        h: pxToPct(size.h, CANVAS_HEIGHT),
        zIndex: maxZ + 1,
        ...(entry.type === 'image'
          ? { placeholderKey: entry.key }
          : {
              content: `{${entry.key}}`,
              style: {
                fontFamily: fontFamily || DEFAULT_FONT_FAMILY,
                fontSize,
                fontColor,
                fontWeight: 'normal',
                textAlign: 'left' as const,
              },
            }),
      };

      const fabric = await import('fabric');
      if (fabricCanvasRef.current !== canvas) return;

      addedElementsRef.current.set(id, element);
      setLiveElements((prev) => [...prev, element]);
      const obj = elementToFabricObject(fabric, element, true, { transparentProxy: true });
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      syncSelection(canvas);
      markDirty();
      setStatus('idle');
      setMessage(null);
    },
    [template, fontFamily, fontColor, fontSize, syncSelection, markDirty]
  );

  const handleDeleteSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const layout = template ? getEditableLayout(template) : null;
    if (!canvas || !layout) return;

    const byId = new Map<string, CanvasElement>([
      ...addedElementsRef.current,
      ...layout.elements.map((e) => [e.id, e] as const),
    ]);
    const active = canvas.getActiveObjects();
    if (active.length === 0) {
      setStatus('error');
      setMessage(t('admin.artifacts.selectElementFirst'));
      return;
    }

    const removable: import('fabric').FabricObject[] = [];
    for (const obj of active) {
      const elementId = getElementId(obj);
      if (!elementId) continue;
      removable.push(obj);
    }

    if (removable.length > 0) {
      recordUndo();
      canvas.discardActiveObject();
      canvas.remove(...removable);
      const removedIds = new Set<string>();
      for (const obj of removable) {
        const elementId = getElementId(obj);
        if (elementId) {
          addedElementsRef.current.delete(elementId);
          removedIds.add(elementId);
        }
      }
      setLiveElements((prev) => prev.filter((el) => !removedIds.has(el.id)));
      canvas.requestRenderAll();
      syncSelection(canvas);
      // Same reason as `insertElement`: `canvas.remove` already fires
      // `object:removed`, and this stays anyway so all four explicit-edit
      // handlers raise the flag the same way.
      markDirty();
    }

    setStatus('idle');
    setMessage(
      `Removed ${removable.length} element${removable.length === 1 ? '' : 's'}. Save to persist.`
    );
  }, [template, syncSelection, markDirty, t]);

  // DEC-012: The canvas admits one keyboard shortcut: Delete/Backspace on the selected element.
  // SPEC-19-03: Escape cancels active drawing tool mode.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawingToolRef.current) {
        if (previewShapeRef.current) {
          fabricCanvasRef.current?.remove(previewShapeRef.current);
          previewShapeRef.current = null;
          fabricCanvasRef.current?.requestRenderAll();
        }
        setDrawingTool(null);
        return;
      }

      // Session Undo/Redo shortcuts (Ctrl+Z / Cmd+Z, Ctrl+Y / Cmd+Y, Ctrl+Shift+Z / Cmd+Shift+Z)
      const isUndo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey;
      const isRedo =
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'));

      if (isUndo || isRedo) {
        const activeEl = document.activeElement;
        if (
          activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          (activeEl instanceof HTMLElement && activeEl.isContentEditable) ||
          activeEl instanceof HTMLButtonElement ||
          activeEl?.getAttribute('role') === 'button'
        ) {
          return;
        }

        const shell = canvasShellRef.current;
        const isCanvasFocused =
          shell &&
          (shell.contains(activeEl) || activeEl === document.body || activeEl === null);
        if (!isCanvasFocused) return;

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const activeObjects = canvas.getActiveObjects();
        const isTextEditing = activeObjects.some((obj) => (obj as any).isEditing === true);
        if (isTextEditing) return;

        const canUndo = !busy && isEditable && !isRestoringHistoryRef.current && undoStackRef.current.length > 0;
        const canRedo = !busy && isEditable && !isRestoringHistoryRef.current && redoStackRef.current.length > 0;

        if (isUndo && canUndo) {
          e.preventDefault();
          void handleUndo();
          return;
        }
        if (isRedo && canRedo) {
          e.preventDefault();
          void handleRedo();
          return;
        }
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;

      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable) ||
        activeEl instanceof HTMLButtonElement ||
        activeEl?.getAttribute('role') === 'button'
      ) {
        return;
      }

      const shell = canvasShellRef.current;
      const isCanvasFocused =
        shell &&
        (shell.contains(activeEl) || activeEl === document.body || activeEl === null);
      if (!isCanvasFocused) return;

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length === 0) return;

      const isTextEditing = activeObjects.some((obj) => (obj as any).isEditing === true);
      if (isTextEditing) return;

      e.preventDefault();
      handleDeleteSelected();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleDeleteSelected, handleUndo, handleRedo]);

  const handleDuplicateSelected = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    const layout = template ? getEditableLayout(template) : null;
    if (!canvas || !layout) return;

    const byId = new Map<string, CanvasElement>([
      ...addedElementsRef.current,
      ...layout.elements.map((e) => [e.id, e] as const),
    ]);
    const active = canvas.getActiveObjects();
    if (active.length === 0) {
      setStatus('error');
      setMessage(t('admin.artifacts.selectElementFirst'));
      return;
    }

    const fabric = await import('fabric');
    if (fabricCanvasRef.current !== canvas) return;
    recordUndo();

    const usedIds = new Set<string>([
      ...layout.elements.map((e) => e.id),
      ...addedElementsRef.current.keys(),
      ...canvas
        .getObjects()
        .map(getElementId)
        .filter((id): id is string => typeof id === 'string'),
    ]);

    let maxZ = [
      ...layout.elements,
      ...addedElementsRef.current.values(),
    ].reduce((acc, element) => Math.max(acc, element.zIndex), -1);

    const newObjects: import('fabric').FabricObject[] = [];

    for (const obj of active) {
      const elementId = getElementId(obj);
      if (!elementId) continue;
      const source = byId.get(elementId);
      if (!source) continue;

      const id = nextElementId(usedIds, insertCounterRef.current);
      usedIds.add(id);
      insertCounterRef.current += 1;
      maxZ += 1;

      // Duplicate element: live extraction of styles/text/shape/geometry/tokens.
      // Image element copies its URL string by reference (shared ref).
      const leftPx = typeof obj.left === 'number' ? obj.left : pctToPx(source.x, CANVAS_WIDTH);
      const topPx = typeof obj.top === 'number' ? obj.top : pctToPx(source.y, CANVAS_HEIGHT);
      const liveX = Math.min(90, pxToPct(leftPx, CANVAS_WIDTH) + pxToPct(INSERT_CASCADE_PX, CANVAS_WIDTH));
      const liveY = Math.min(90, pxToPct(topPx, CANVAS_HEIGHT) + pxToPct(INSERT_CASCADE_PX, CANVAS_HEIGHT));

      const objW = Math.abs(obj.width ?? 0) * (obj.scaleX ?? 1);
      const objH = Math.abs(obj.height ?? 0) * (obj.scaleY ?? 1);
      const liveW = objW > 0 ? pxToPct(objW, CANVAS_WIDTH) : source.w;
      const liveH = objH > 0 ? pxToPct(objH, CANVAS_HEIGHT) : source.h;

      const clonedStyle: TextStyle & ImageStyle & ShapeStyle = source.style ? { ...source.style } : {};

      if (source.type === 'text' && isFabricTextObject(obj)) {
        if (obj.fontFamily) clonedStyle.fontFamily = resolveCatalogFontFamily(obj.fontFamily);
        if (typeof obj.fontSize === 'number') clonedStyle.fontSize = normalizeFontSize(obj.fontSize);
        const fillHex = toStrictHexColor(obj.fill, undefined);
        if (fillHex) clonedStyle.fontColor = fillHex;
        if (obj.fontWeight) clonedStyle.fontWeight = obj.fontWeight === 'bold' ? 'bold' : 'normal';
        if (obj.fontStyle) clonedStyle.fontStyle = obj.fontStyle === 'italic' ? 'italic' : 'normal';
        if ((obj as any).underline !== undefined) {
          clonedStyle.textDecoration = (obj as any).underline ? 'underline' : 'none';
        }
        if (obj.textAlign) clonedStyle.textAlign = obj.textAlign as any;
        if (typeof (obj as any).lineHeight === 'number') clonedStyle.lineHeight = (obj as any).lineHeight;
        if ((obj as any).shadow) {
          clonedStyle.textShadow = true;
          clonedStyle.textShadowBlur =
            typeof (obj as any).shadow.blur === 'number' ? (obj as any).shadow.blur : 4;
        } else if ((obj as any).shadow === null) {
          clonedStyle.textShadow = false;
        }
      }

      if (source.type === 'shape' || source.type === 'line') {
        const isTransparent = (obj as any).fill === 'transparent' || source.style?.fillColor === 'transparent';
        if (isTransparent) {
          clonedStyle.fillColor = 'transparent';
        } else {
          const shapeFillHex = toStrictHexColor((obj as any).fill, undefined);
          if (shapeFillHex) clonedStyle.fillColor = shapeFillHex;
        }
        const strokeHex = toStrictHexColor((obj as any).stroke, undefined);
        if (strokeHex) clonedStyle.strokeColor = strokeHex;
        if (typeof (obj as any).strokeWidth === 'number') clonedStyle.strokeWidth = (obj as any).strokeWidth;
        if (typeof (obj as any).opacity === 'number') clonedStyle.opacity = (obj as any).opacity;
      }

      const clonedElement: CanvasElement = {
        ...source,
        id,
        required: false,
        x: liveX,
        y: liveY,
        w: liveW,
        h: liveH,
        zIndex: maxZ,
        style: Object.keys(clonedStyle).length > 0 ? clonedStyle : undefined,
      };

      if (source.type === 'text' && isFabricTextObject(obj)) {
        clonedElement.content = obj.text ?? source.content;
      }

      addedElementsRef.current.set(id, clonedElement);
      setLiveElements((prev) => [...prev, clonedElement]);
      const fabricObj = elementToFabricObject(fabric, clonedElement, true, { transparentProxy: true });
      canvas.add(fabricObj);
      newObjects.push(fabricObj);
    }

    if (newObjects.length > 0) {
      canvas.discardActiveObject();
      if (newObjects.length === 1) {
        canvas.setActiveObject(newObjects[0]);
      } else {
        const sel = new fabric.ActiveSelection(newObjects, { canvas });
        canvas.setActiveObject(sel);
      }
      canvas.requestRenderAll();
      syncSelection(canvas);
      markDirty();
      setStatus('idle');
      setMessage(null);
    }
  }, [template, syncSelection, markDirty, t]);

  const applyTextStyle = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    void import('fabric').then((fabric) => {
      const shadowObj = textShadow
        ? new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: shadowBlur, offsetX: 2, offsetY: 2 })
        : null;
      let updated = false;
      for (const obj of canvas.getActiveObjects()) {
        if (!isFabricTextObject(obj)) continue;
        obj.set({
          fill: 'transparent',
          stroke: 'transparent',
          shadow: null,
          strokeWidth: 0,
          fontSize,
          fontWeight,
          fontStyle,
          underline,
          lineHeight,
        } as any);
        const d = ((obj as any).data = (obj as any).data || {});
        d.style = {
          ...(d.style || {}),
          fontColor,
          fontSize,
          fontWeight,
          fontStyle,
          textDecoration: underline ? 'underline' : 'none',
          lineHeight,
          textShadow,
          textShadowBlur: shadowBlur,
          shadow: shadowObj,
        };
        updated = true;
      }
      if (updated) {
        canvas.requestRenderAll();
        markDirty();
      }
    });
  };

  const handleFontColorChange = (color: string) => {
    recordUndo();
    setFontColor(color);
    setLiveElements((prev) =>
      prev.map((el) => {
        if (!selectedElementIds.includes(el.id)) return el;
        return {
          ...el,
          style: {
            ...el.style,
            fontColor: color,
          },
        };
      })
    );
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    let updated = false;
    for (const obj of canvas.getActiveObjects()) {
      if (!isFabricTextObject(obj)) continue;
      obj.set({ fill: 'transparent', stroke: 'transparent', shadow: null });
      const d = ((obj as any).data = (obj as any).data || {});
      d.style = { ...(d.style || {}), fontColor: color };
      updated = true;
    }
    if (updated) {
      canvas.requestRenderAll();
      markDirty();
    }
  };

  const handleFontFamilyChange = async (family: string | null) => {
    if (!family) return;
    recordUndo();
    setFontFamily(family);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    markDirty();
    if (typeof document !== 'undefined' && document.fonts?.load) {
      try {
        const texts = canvas.getActiveObjects().filter(isFabricTextObject);
        const szs = [...new Set(texts.map((o) => o.fontSize || fontSize || DEFAULT_FONT_SIZE))];
        await Promise.all((szs.length ? szs : [fontSize || DEFAULT_FONT_SIZE]).map((s) => document.fonts.load(`${s}px "${family}"`)));
      } catch {}
    }
    if (fabricCanvasRef.current !== canvas) return;
    setLiveElements((p) =>
      p.map((e) => {
        if (!selectedElementIds.includes(e.id)) return e;
        const newStyle = { ...e.style, fontFamily: family };
        delete newStyle.pptxTypeface;
        return { ...e, style: newStyle };
      })
    );
    let updated = false;
    for (const obj of canvas.getActiveObjects()) {
      if (!isFabricTextObject(obj)) continue;
      obj.set({ fontFamily: getFontStack(family), fill: 'transparent', stroke: 'transparent', shadow: null });
      const d = ((obj as any).data = (obj as any).data || {});
      d.style = { ...(d.style || {}), fontFamily: family };
      delete d.style?.pptxTypeface;
      d.authoredHeight = (obj.height ?? 0) * (obj.scaleY ?? 1);
      updated = true;
    }
    if (updated) {
      canvas.requestRenderAll();
      markDirty();
    }
  };

  const handleFontUploadBatch = useCallback(
    async (files: FileList | File[], targetFamily?: string) => {
      const fileArr = Array.from(files);
      if (fileArr.length === 0) return;

      setFontUploading(true);
      const toastId = toast.loading(
        t('admin.artifacts.importProgress')
          .replace('{current}', '1')
          .replace('{total}', String(fileArr.length))
      );

      const successFaces: ImportedFontFace[] = [];
      const failed: string[] = [];
      const initialSelectedIds = [...selectedElementIdsRef.current];

      try {
        for (let i = 0; i < fileArr.length; i++) {
          const file = fileArr[i];
          toast.loading(
            t('admin.artifacts.importProgress')
              .replace('{current}', String(i + 1))
              .replace('{total}', String(fileArr.length)),
            { id: toastId }
          );

          const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
          if (ext !== '.ttf' && ext !== '.otf') {
            failed.push(`${file.name} (unsupported format, must be .ttf or .otf)`);
            continue;
          }

          try {
            const fd = new FormData();
            fd.append('file', file);
            if (targetFamily) {
              fd.append('family', targetFamily);
            }
            const res = await fetch('/api/admin/artifacts/fonts', {
              method: 'POST',
              body: fd,
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              failed.push(`${file.name} (${errData.error || `status ${res.status}`})`);
              continue;
            }

            const face = (await res.json()) as ImportedFontFace;
            const hydrated = await registerDynamicFontFace(face);
            if (!hydrated) {
              failed.push(`${file.name} (failed to load FontFace in browser)`);
              continue;
            }
            successFaces.push(face);
          } catch (fileErr: any) {
            failed.push(`${file.name} (${fileErr.message || 'upload error'})`);
          }
        }

        if (successFaces.length === 0) {
          const errorMsg = failed.length > 0 ? failed.join('; ') : 'No valid font faces';
          toast.error(
            t('admin.artifacts.importFailed').replace('{error}', errorMsg),
            { id: toastId }
          );
          return;
        }

        // Case-insensitive family canonicalization
        const familyMap = new Map<string, string>(); // canonical lowercase -> first observed display name
        for (const face of successFaces) {
          const raw = face.family.trim();
          const canonical = raw.toLowerCase();
          if (!familyMap.has(canonical)) {
            familyMap.set(canonical, raw);
          }
        }

        const distinctFamilies = Array.from(familyMap.values());
        const uploadedFamilySet = new Set(familyMap.keys());

        // One-family selection rule: if all successful files belong to a single family (case-insensitive),
        // apply that family to the text selection that existed when the batch began.
        if (familyMap.size === 1) {
          const displayFamily = distinctFamilies[0];
          if (initialSelectedIds.length > 0) {
            // Apply font only to text elements in snapshot selection
            setLiveElements((prev) =>
              prev.map((el) =>
                initialSelectedIds.includes(el.id) && el.type === 'text' && el.style
                  ? { ...el, style: { ...el.style, fontFamily: displayFamily, fontStatus: 'uploaded' } }
                  : el.type === 'text' && el.style?.fontFamily && uploadedFamilySet.has(el.style.fontFamily.trim().toLowerCase())
                  ? { ...el, style: { ...el.style, fontStatus: 'uploaded' } }
                  : el
              )
            );
            markDirty();

            // Synchronize toolbar state only if the current selection still matches initial selection
            const currentSelected = selectedElementIdsRef.current;
            const selectionStillMatches =
              initialSelectedIds.length === currentSelected.length &&
              initialSelectedIds.every((id) => currentSelected.includes(id));
            if (selectionStillMatches) {
              setFontFamily(displayFamily);
            }

            const canvas = fabricCanvasRef.current;
            if (canvas) {
              const fabricMod = (window as any).fabric;
              canvas.getObjects().forEach((obj: any) => {
                const elId = obj.data?.elementId;
                if (initialSelectedIds.includes(elId)) {
                  const activeEl = liveElementsRef.current.find((e) => e.id === elId);
                  if (activeEl && activeEl.type === 'text') {
                    obj.set('fontFamily', displayFamily);
                    if (fabricMod) {
                      applyFabricTextFit(
                        obj,
                        { ...activeEl, style: { ...activeEl.style, fontFamily: displayFamily } },
                        fabricMod
                      );
                    }
                  }
                }
              });
              canvas.requestRenderAll();
            }
          } else {
            // SPEC-37-01: Reconcile element fontStatus when no text selection was active
            setLiveElements((prev) =>
              prev.map((el) =>
                el.type === 'text' && el.style?.fontFamily && uploadedFamilySet.has(el.style.fontFamily.trim().toLowerCase())
                  ? { ...el, style: { ...el.style, fontStatus: 'uploaded' } }
                  : el
              )
            );
            markDirty();
          }

          if (failed.length > 0) {
            toast.warning(
              t('admin.artifacts.importPartialWarning')
                .replace('{count}', String(successFaces.length))
                .replace('{failedCount}', String(failed.length))
                .replace('{failed}', failed.join('; ')),
              { id: toastId }
            );
          } else {
            toast.success(
              t('admin.artifacts.importSingleFamilySuccess')
                .replace('{count}', String(successFaces.length))
                .replace('{family}', displayFamily),
              { id: toastId }
            );
          }
        } else {
          // Multiple families imported: leave selection unchanged, notify operator
          if (failed.length > 0) {
            toast.warning(
              t('admin.artifacts.importPartialWarning')
                .replace('{count}', String(successFaces.length))
                .replace('{failedCount}', String(failed.length))
                .replace('{failed}', failed.join('; ')),
              { id: toastId }
            );
          } else {
            toast.success(
              t('admin.artifacts.importMultiFamilySuccess')
                .replace('{count}', String(successFaces.length))
                .replace('{families}', distinctFamilies.join(', ')),
              { id: toastId }
            );
          }
        }
      } finally {
        setFontUploading(false);
      }
    },
    [t, markDirty]
  );

  const handleToggleBold = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const texts = canvas.getActiveObjects().filter(isFabricTextObject);
    if (texts.length === 0) return;
    recordUndo();
    const nextWeight: 'normal' | 'bold' = fontWeight === 'bold' ? 'normal' : 'bold';
    setFontWeight(nextWeight);
    setLiveElements((prev) =>
      prev.map((el) => {
        if (!selectedElementIds.includes(el.id)) return el;
        const newStyle = { ...el.style, fontWeight: nextWeight };
        delete newStyle.pptxTypeface;
        return { ...el, style: newStyle };
      })
    );
    for (const obj of texts) {
      obj.set({ fontWeight: nextWeight, fill: 'transparent', stroke: 'transparent', shadow: null });
      const d = ((obj as any).data = (obj as any).data || {});
      d.style = { ...(d.style || {}), fontWeight: nextWeight };
      delete d.style?.pptxTypeface;
    }
    canvas.requestRenderAll();
    markDirty();
  }, [fontWeight, selectedElementIds, markDirty]);

  const handleToggleItalic = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const texts = canvas.getActiveObjects().filter(isFabricTextObject);
    if (texts.length === 0) return;
    recordUndo();
    const nextStyle: 'normal' | 'italic' = fontStyle === 'italic' ? 'normal' : 'italic';
    setFontStyle(nextStyle);
    setLiveElements((prev) =>
      prev.map((el) => {
        if (!selectedElementIds.includes(el.id)) return el;
        const newStyle = { ...el.style, fontStyle: nextStyle };
        delete newStyle.pptxTypeface;
        return { ...el, style: newStyle };
      })
    );
    for (const obj of texts) {
      obj.set({ fontStyle: nextStyle, fill: 'transparent', stroke: 'transparent', shadow: null });
      const d = ((obj as any).data = (obj as any).data || {});
      d.style = { ...(d.style || {}), fontStyle: nextStyle };
      delete d.style?.pptxTypeface;
    }
    canvas.requestRenderAll();
    markDirty();
  }, [fontStyle, selectedElementIds, markDirty]);

  const handleLetterSpacingChange = useCallback(
    (valStr: string) => {
      recordUndo();
      setLetterSpacingInput(valStr);
      const parsed = parseFloat(valStr);
      const newSpacing = Number.isFinite(parsed) ? parsed : undefined;
      setLetterSpacing(newSpacing);

      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          const newStyle = { ...el.style };
          if (newSpacing !== undefined) {
            newStyle.letterSpacing = newSpacing;
          } else {
            delete newStyle.letterSpacing;
          }
          return { ...el, style: newStyle };
        })
      );

      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      let updated = false;
      for (const obj of canvas.getActiveObjects()) {
        if (!isFabricTextObject(obj)) continue;
        const fs = typeof (obj as any).fontSize === 'number' ? (obj as any).fontSize : DEFAULT_FONT_SIZE;
        (obj as any).set({
          charSpacing: newSpacing !== undefined ? (newSpacing / fs) * 1000 : 0,
        });
        const d = ((obj as any).data = (obj as any).data || {});
        d.style = {
          ...(d.style || {}),
        };
        if (newSpacing !== undefined) {
          d.style.letterSpacing = newSpacing;
        } else {
          delete d.style.letterSpacing;
        }
        updated = true;
      }
      if (updated) {
        canvas.requestRenderAll();
        markDirty();
      }
    },
    [selectedElementIds, markDirty]
  );

  const handleToggleUnderline = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const texts = canvas.getActiveObjects().filter(isFabricTextObject);
    if (texts.length === 0) return;
    recordUndo();
    const nextUnderline = !underline;
    setUnderline(nextUnderline);
    setLiveElements((prev) =>
      prev.map((el) => {
        if (!selectedElementIds.includes(el.id)) return el;
        return {
          ...el,
          style: {
            ...el.style,
            textDecoration: nextUnderline ? 'underline' : 'none',
          },
        };
      })
    );
    for (const obj of texts) {
      obj.set({ underline: nextUnderline, fill: 'transparent', stroke: 'transparent', shadow: null } as any);
      const d = ((obj as any).data = (obj as any).data || {});
      d.style = { ...(d.style || {}), textDecoration: nextUnderline ? 'underline' : 'none' };
    }
    canvas.requestRenderAll();
    markDirty();
  }, [underline, selectedElementIds, markDirty]);

  const handleLineHeightChange = useCallback(
    (val: number) => {
      recordUndo();
      const clamped = Math.max(0.8, Math.min(2.5, Number(val.toFixed(2))));
      setLineHeight(clamped);
      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          return {
            ...el,
            style: {
              ...el.style,
              lineHeight: clamped,
            },
          };
        })
      );
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      for (const obj of canvas.getActiveObjects()) {
        if (isFabricTextObject(obj)) {
          obj.set({ lineHeight: clamped });
          obj.set({ fill: 'transparent', stroke: 'transparent', shadow: null });
          const d = ((obj as any).data = (obj as any).data || {});
          d.style = { ...(d.style || {}), lineHeight: clamped };
        }
      }
      canvas.requestRenderAll();
      markDirty();
    },
    [selectedElementIds, markDirty]
  );

  const handleToggleTextShadow = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    recordUndo();
    const fabric = await import('fabric');
    const nextShadow = !textShadow;
    setTextShadow(nextShadow);
    setLiveElements((prev) =>
      prev.map((el) => {
        if (!selectedElementIds.includes(el.id)) return el;
        return {
          ...el,
          style: {
            ...el.style,
            textShadow: nextShadow,
          },
        };
      })
    );
    const shadowObj = nextShadow
      ? new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: shadowBlur, offsetX: 2, offsetY: 2 })
      : null;
    for (const obj of canvas.getActiveObjects()) {
      if (isFabricTextObject(obj)) {
        obj.set({ shadow: null, fill: 'transparent', stroke: 'transparent' });
        const d = ((obj as any).data = (obj as any).data || {});
        d.style = { ...(d.style || {}), textShadow: nextShadow };
      }
    }
    canvas.requestRenderAll();
    markDirty();
  }, [textShadow, shadowBlur, selectedElementIds, markDirty]);

  const handleShadowBlurChange = useCallback(
    async (blurVal: number) => {
      recordUndo();
      const clamped = Math.max(0, Math.min(20, Math.round(blurVal)));
      setShadowBlur(clamped);
      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          return {
            ...el,
            style: {
              ...el.style,
              textShadowBlur: clamped,
            },
          };
        })
      );
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      for (const obj of canvas.getActiveObjects()) {
        if (isFabricTextObject(obj)) {
          obj.set({ shadow: null, fill: 'transparent', stroke: 'transparent' });
          const d = ((obj as any).data = (obj as any).data || {});
          d.style = { ...(d.style || {}), textShadowBlur: clamped };
        }
      }
      canvas.requestRenderAll();
      markDirty();
    },
    [selectedElementIds, markDirty]
  );

  /**
   * Writes the words of the selected text box straight through to Fabric, so
   * the next Save picks them up. Deliberately limited to a single selected text
   * element: applying one string to a multi-selection would wipe the others.
   */
  const handleTextContentChange = (value: string) => {
    recordUndo();
    setTextContent(value);
    const canvas = fabricCanvasRef.current;
    if (!canvas) {
      setLiveElements((prev) =>
        prev.map((el) => (selectedElementIds.includes(el.id) ? { ...el, content: value } : el))
      );
      markDirty();
      return;
    }
    const texts = canvas.getActiveObjects().filter(isFabricTextObject);
    if (texts.length !== 1) {
      setLiveElements((prev) =>
        prev.map((el) => (selectedElementIds.includes(el.id) ? { ...el, content: value } : el))
      );
      markDirty();
      return;
    }
    const textObj = texts[0];
    textObj.set({ text: value, fill: 'transparent', stroke: 'transparent', shadow: null });
    const objData = ((textObj as any).data = (textObj as any).data || {});
    const id = getElementId(textObj);
    const liveEl = liveElementsRef.current.find((e) => e.id === id);

    const fSize = normalizeFontSize(textObj.fontSize ?? liveEl?.style?.fontSize ?? fontSize);
    const lHeight =
      typeof textObj.lineHeight === 'number'
        ? textObj.lineHeight
        : typeof liveEl?.style?.lineHeight === 'number'
          ? liveEl.style.lineHeight
          : TEXT_LINE_HEIGHT;
    const currentW =
      typeof objData.authoredWidth === 'number' && objData.authoredWidth > 0
        ? objData.authoredWidth
        : typeof liveEl?.w === 'number'
          ? pctToPx(liveEl.w, CANVAS_WIDTH)
          : (textObj.width ?? 100) * Math.abs(textObj.scaleX ?? 1);
    const currentH =
      typeof objData.authoredHeight === 'number' && objData.authoredHeight > 0
        ? objData.authoredHeight
        : typeof liveEl?.h === 'number'
          ? pctToPx(liveEl.h, CANVAS_HEIGHT)
          : (textObj.height ?? 50) * Math.abs(textObj.scaleY ?? 1);
    const currentTopPx =
      typeof textObj.top === 'number'
        ? textObj.top
        : liveEl?.y
          ? pctToPx(liveEl.y, CANVAS_HEIGHT)
          : 0;

    const { boundedRequiredHeight, shouldExpand } = computeAutoExpandedHeight({
      textContent: value,
      authoredWidthPx: currentW,
      authoredHeightPx: currentH,
      fontSizePx: fSize,
      lineHeight: lHeight,
      fontFamily: liveEl?.style?.fontFamily || textObj.fontFamily,
      fontWeight: String(liveEl?.style?.fontWeight || textObj.fontWeight || 'normal'),
      fontStyle: String(liveEl?.style?.fontStyle || textObj.fontStyle || 'normal'),
      topPx: currentTopPx,
    });

    if (shouldExpand) {
      textObj.set({ height: boundedRequiredHeight, scaleY: 1 });
      textObj.setCoords?.();
      objData.authoredHeight = boundedRequiredHeight;
      objData.heightChange = 'font-size-auto';
      syncTextClipOnScale(textObj);
      setLiveElements((prev) =>
        prev.map((el) =>
          el.id === id
            ? {
                ...el,
                content: value,
                h: pxToPct(boundedRequiredHeight, CANVAS_HEIGHT),
              }
            : el
        )
      );
    } else {
      setLiveElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, content: value } : el))
      );
    }

    canvas.requestRenderAll();
    syncSelection(canvas);
    markDirty();
  };

  const handleFontSizeInput = (raw: string) => {
    setFontSizeInput(raw);
    // SPEC-21-01: Keystroke Isolation.
    // Updates only the draft input state while typing without modifying the canvas
    // or clamping the font size mid-keystroke. Actual canvas mutation, scaling,
    // and persistence flags are strictly deferred until handleFontSizeCommit
    // is triggered by blur or Enter key press.
  };

  const handleFontSizeCommit = () => {
    recordUndo();
    const result = commitFontSizeFromDraft(fontSizeInput, fontSize);
    setFontSize(result.fontSize);
    setFontSizeInput(result.inputValue);
    markDirty();

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    let updated = false;
    for (const obj of canvas.getActiveObjects()) {
      if (!isFabricTextObject(obj)) continue;
      obj.set({ fontSize: result.fontSize });
      obj.set({ fill: 'transparent', stroke: 'transparent', shadow: null });
      const objData = ((obj as any).data = (obj as any).data || {});
      const id = getElementId(obj);
      const liveEl = liveElementsRef.current.find((e) => e.id === id);
      objData.style = { ...(objData.style || {}), fontSize: result.fontSize };

      const lHeight =
        typeof obj.lineHeight === 'number'
          ? obj.lineHeight
          : typeof liveEl?.style?.lineHeight === 'number'
            ? liveEl.style.lineHeight
            : TEXT_LINE_HEIGHT;
      const currentW =
        typeof objData.authoredWidth === 'number' && objData.authoredWidth > 0
          ? objData.authoredWidth
          : typeof liveEl?.w === 'number'
            ? pctToPx(liveEl.w, CANVAS_WIDTH)
            : (obj.width ?? 100) * Math.abs(obj.scaleX ?? 1);
      const currentH =
        typeof objData.authoredHeight === 'number' && objData.authoredHeight > 0
          ? objData.authoredHeight
          : typeof liveEl?.h === 'number'
            ? pctToPx(liveEl.h, CANVAS_HEIGHT)
            : (obj.height ?? 50) * Math.abs(obj.scaleY ?? 1);
      const currentTopPx =
        typeof obj.top === 'number'
          ? obj.top
          : liveEl?.y
            ? pctToPx(liveEl.y, CANVAS_HEIGHT)
            : 0;

      const { boundedRequiredHeight, shouldExpand } = computeAutoExpandedHeight({
        textContent: obj.text ?? liveEl?.content ?? '',
        authoredWidthPx: currentW,
        authoredHeightPx: currentH,
        fontSizePx: result.fontSize,
        lineHeight: lHeight,
        fontFamily: liveEl?.style?.fontFamily || obj.fontFamily,
        fontWeight: String(liveEl?.style?.fontWeight || obj.fontWeight || 'normal'),
        fontStyle: String(liveEl?.style?.fontStyle || obj.fontStyle || 'normal'),
        topPx: currentTopPx,
      });

      if (shouldExpand) {
        obj.set({ height: boundedRequiredHeight, scaleY: 1 });
        obj.setCoords?.();
        objData.authoredHeight = boundedRequiredHeight;
        objData.heightChange = 'font-size-auto';
        syncTextClipOnScale(obj);
        setLiveElements((prev) =>
          prev.map((el) =>
            el.id === id
              ? {
                  ...el,
                  h: pxToPct(boundedRequiredHeight, CANVAS_HEIGHT),
                  style: { ...el.style, fontSize: result.fontSize },
                }
              : el
          )
        );
      } else {
        objData.authoredHeight = currentH;
        syncTextClipOnScale(obj);
        setLiveElements((prev) =>
          prev.map((el) =>
            el.id === id
              ? {
                  ...el,
                  style: { ...el.style, fontSize: result.fontSize },
                }
              : el
          )
        );
      }
      updated = true;
    }
    if (updated) {
      canvas.requestRenderAll();
      markDirty();
    }
  };

  const [internalCopiedSlidePayload, setInternalCopiedSlidePayload] = useState<CopiedSlide | null>(null);

  const activeCopiedSlidePayload =
    externalCopiedSlidePayload !== undefined
      ? externalCopiedSlidePayload
      : internalCopiedSlidePayload;

  const setCopiedSlide = (val: CopiedSlide | null) => {
    if (onCopySlidePayloadChange) {
      onCopySlidePayloadChange(val);
    }
    setInternalCopiedSlidePayload(val);
  };

  const handleCopySlide = async (item: ArtifactTemplateSummary) => {
    try {
      const data = await adapter.getOne(item.id);
      const { updatedAt, id, ...body } = data;
      setCopiedSlide({
        label: `${item.label} (Copy)`,
        payload: body,
      });
      toast(t('admin.artifacts.copiedSlide'));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('admin.artifacts.loadOneFailed'));
    }
  };

  const handlePasteSlide = async () => {
    if (!activeCopiedSlidePayload) return;
    const proceed = mayDiscard(
      isDirty && isEditable,
      DISCARD_ON_SWITCH_CONFIRMATION,
      (message) => window.confirm(message)
    );
    if (!proceed) return;

    setStatus('creating');
    setMessage(null);
    try {
      // 1. Create new authored slide
      const data = await adapter.create(activeCopiedSlidePayload.label);

      // 2. Put copied layout/payload into the new slide (shares image references as-is)
      const saveRes = await adapter.save(data.id, {
        ...activeCopiedSlidePayload.payload,
        id: data.id,
        label: activeCopiedSlidePayload.label,
        baseType: 'general',
        updatedAt: data.updatedAt,
      });
      if (!saveRes.ok) throw new Error(saveRes.error || t('admin.artifacts.saveFailed'));

      await loadList();
      setSelectedId(data.id);
      setSelectedIds(new Set([data.id]));
      setAnchorId(data.id);
      setStatus('success');
      toast(t('admin.artifacts.created').replace('{label}', activeCopiedSlidePayload.label));
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.addFailed'));
    }
  };

  const handleSetTextAlign = useCallback(
    (align: 'left' | 'center' | 'right') => {
      recordUndo();
      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          return {
            ...el,
            style: {
              ...el.style,
              textAlign: align,
            },
          };
        })
      );
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      const texts = canvas.getActiveObjects().filter(isFabricTextObject);
      if (texts.length === 0) return;
      for (const obj of texts) {
        obj.set({ textAlign: align });
      }
      canvas.requestRenderAll();
      markDirty();
    },
    [selectedElementIds, markDirty]
  );

  const handleSetShapeFill = useCallback(
    (color: string) => {
      recordUndo();
      setShapeFill(color);
      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          return {
            ...el,
            style: {
              ...el.style,
              fillColor: color,
            },
          };
        })
      );
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      for (const obj of canvas.getActiveObjects()) {
        if ((obj as any).type === 'rect' && !(obj as any).data?.imageRef) {
          obj.set({ fill: color });
        }
      }
      canvas.requestRenderAll();
      markDirty();
    },
    [selectedElementIds, markDirty]
  );

  const handleStrokeColorChange = useCallback(
    (color: string) => {
      recordUndo();
      setStrokeColor(color);
      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          const isLine = el.type === 'line';
          const isOutline =
            el.type === 'shape' &&
            (el.style?.fillColor === 'transparent' || Boolean(el.style?.strokeColor));
          if (!isLine && !isOutline) return el;
          return {
            ...el,
            style: {
              ...el.style,
              strokeColor: color,
            },
          };
        })
      );
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      let updated = false;
      for (const obj of canvas.getActiveObjects()) {
        const id = getElementId(obj);
        const liveEl = liveElementsRef.current.find((e) => e.id === id);
        const isLine = (obj as any).type === 'line' || (obj as any).data?.isLine;
        const isOutline =
          (obj as any).type === 'rect' &&
          ((obj as any).fill === 'transparent' ||
            liveEl?.style?.fillColor === 'transparent' ||
            Boolean(liveEl?.style?.strokeColor));
        if (isLine || isOutline) {
          obj.set({ stroke: color });
          const d = ((obj as any).data = (obj as any).data || {});
          d.style = { ...(d.style || {}), strokeColor: color };
          updated = true;
        }
      }
      if (updated) {
        canvas.requestRenderAll();
        markDirty();
      }
    },
    [selectedElementIds, markDirty, recordUndo]
  );

  const handleStrokeWidthChange = useCallback(
    (widthNum: number) => {
      recordUndo();
      const clamped = Math.max(1, Math.min(50, Math.round(widthNum)));
      setStrokeWidth(clamped);
      setLiveElements((prev) =>
        prev.map((el) => {
          if (!selectedElementIds.includes(el.id)) return el;
          const isLine = el.type === 'line';
          const isOutline =
            el.type === 'shape' &&
            (el.style?.fillColor === 'transparent' || Boolean(el.style?.strokeColor));
          if (!isLine && !isOutline) return el;
          return {
            ...el,
            style: {
              ...el.style,
              strokeWidth: clamped,
            },
          };
        })
      );
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      let updated = false;
      for (const obj of canvas.getActiveObjects()) {
        const id = getElementId(obj);
        const liveEl = liveElementsRef.current.find((e) => e.id === id);
        const isLine = (obj as any).type === 'line' || (obj as any).data?.isLine;
        const isOutline =
          (obj as any).type === 'rect' &&
          ((obj as any).fill === 'transparent' ||
            liveEl?.style?.fillColor === 'transparent' ||
            Boolean(liveEl?.style?.strokeColor));
        if (isLine || isOutline) {
          obj.set({ strokeWidth: clamped });
          const d = ((obj as any).data = (obj as any).data || {});
          d.style = { ...(d.style || {}), strokeWidth: clamped };
          updated = true;
        }
      }
      if (updated) {
        canvas.requestRenderAll();
        markDirty();
      }
    },
    [selectedElementIds, markDirty, recordUndo]
  );

  const handleCloneTemplate = async (item: ArtifactTemplateSummary) => {
    try {
      const data = await adapter.getOne(item.id);
      const { updatedAt, id, ...body } = data;

      const baseLabel = item.label.replace(/\s*\(Copy(?:\s+\d+)?\)$/, '');
      let copyNum = 1;
      const regex = new RegExp(`^${baseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(Copy(?:\\s+(\\d+))?\\)$`);
      for (const t of templates) {
        const match = t.label.match(regex);
        if (match) {
          const n = match[1] ? parseInt(match[1], 10) : 1;
          if (n >= copyNum) copyNum = n + 1;
        }
      }
      const newLabel = `${baseLabel} (Copy ${copyNum})`;

      const created = await adapter.create(newLabel, {
        baseType: item.baseType,
        variableName: (item as any).variableName,
        annSetId: (item as any).annSetId,
      });

      if (item.baseType === 'general' && body.layouts) {
        await adapter.save(created.id, {
          ...body,
          id: created.id,
          label: newLabel,
          baseType: 'general',
          updatedAt: created.updatedAt,
        });
      }

      await loadList();
      setSelectedId(created.id);
      setSelectedIds(new Set([created.id]));
      setAnchorId(created.id);
      toast(t('admin.artifacts.created').replace('{label}', newLabel));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clone slide');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (busy || isDeletingSelected) {
      e.preventDefault();
      return;
    }
    dragSourceIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const rawData = e.dataTransfer.getData('text/plain');
    const sourceIndex =
      rawData !== '' && !Number.isNaN(Number(rawData))
        ? Number(rawData)
        : (dragSourceIndexRef.current ?? draggedIndex);
    dragSourceIndexRef.current = null;
    setDraggedIndex(null);
    if (
      sourceIndex === null ||
      sourceIndex < 0 ||
      sourceIndex >= templates.length ||
      targetIndex < 0 ||
      targetIndex >= templates.length
    ) {
      return;
    }
    const draggedItem = templates[sourceIndex];
    if (!draggedItem) return;

    const next = moveSelectedBlock({
      orderedItems: templates,
      selectedIds,
      draggedId: draggedItem.id,
      targetIndex,
    });
    if (next === templates || next.every((item, i) => item.id === templates[i].id)) {
      return;
    }
    setTemplates(next);
    await handleReorderTemplates(next);
  };

  const handleCreate = async () => {
    const proceed = mayDiscard(
      isDirty && isEditable,
      DISCARD_ON_SWITCH_CONFIRMATION,
      (message) => window.confirm(message)
    );
    if (!proceed) return;

    setStatus('creating');
    setMessage(null);
    try {
      let opts: { baseType?: string; variableName?: string; annSetId?: number } = {};
      let label = newLabel.trim();
      if (newSlideType === 'general') {
        label = label || 'New Slide';
        opts = { baseType: 'general' };
      } else if (newSlideType.startsWith('song:')) {
        const vn = newSlideType.slice(5);
        const songEntry = availableSongSets.find((s) => s.variableName === vn);
        label = label || songEntry?.title || vn;
        opts = { baseType: 'song-set-entry', variableName: vn };
      } else if (newSlideType.startsWith('ann:')) {
        const sid = parseInt(newSlideType.slice(4), 10);
        const annEntry = availableAnnSets.find((a) => a.id === sid);
        label = label || annEntry?.label || `Announcement Set ${sid}`;
        opts = { baseType: 'ann-set-marker', annSetId: sid };
      }
      const data = await adapter.create(label, opts);
      setNewLabel('');
      await loadList();
      setSelectedId(data.id);
      setSelectedIds(new Set([data.id]));
      setAnchorId(data.id);
      setStatus('success');
      setMessage(
        t('admin.artifacts.created').replace('{label}', data.label || label)
      );
      toast(t('admin.artifacts.created').replace('{label}', data.label || label));
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.addFailed'));
    }
  };

  const pptxFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportPptx = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      event.target.value = '';

      if (!file.name.toLowerCase().endsWith('.pptx')) {
        toast.error('Please select a valid .pptx file');
        return;
      }

      const editable = template ? isCanvasAuthorable(template.baseType) : false;
      const proceed = mayDiscard(
        isDirty && editable,
        DISCARD_ON_SWITCH_CONFIRMATION,
        (msg) => window.confirm(msg)
      );
      if (!proceed) return;

      setIsImporting(true);
      const toastId = toast.loading('Importing presentation slides...');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/admin/artifacts/import-pptx', {
          method: 'POST',
          body: formData,
        });

        let data: any = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch {
            // ignore malformed json
          }
        }

        if (!response.ok) {
          if (response.status === 413) {
            throw new Error('File exceeds upload limit (max 100 MiB)');
          }
          throw new Error(data?.error || `Failed to import PPTX (status ${response.status})`);
        }

        toast.success(`Imported ${data.importedCount} slide(s) successfully`, { id: toastId });

        await loadList();

        if (data.firstTemplate?.id) {
          undoStackRef.current = [];
          redoStackRef.current = [];
          setUndoStack([]);
          setRedoStack([]);
          pendingBaselineSnapshotRef.current = null;
          pendingTextBaselineRef.current = null;
          setSelectedId(data.firstTemplate.id);
          setSelectedIds(new Set([data.firstTemplate.id]));
          setAnchorId(data.firstTemplate.id);
          setTemplate(data.firstTemplate);
          setDraftLabel(typeof data.firstTemplate.label === 'string' ? data.firstTemplate.label : '');
          setIsDirty(false);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to import presentation', { id: toastId });
      } finally {
        setIsImporting(false);
      }
    },
    [template, isDirty, loadList, setSelectedId, setTemplate, setIsDirty]
  );

  const handleRename = async () => {
    if (!template) return;
    const label = draftLabel.trim();
    if (!label) return;

    setStatus('renaming');
    setMessage(null);
    try {
      const res = await adapter.rename(template.id, label, template.updatedAt);
      if (res.status === 409) {
        await loadTemplate(template.id);
        setStatus('conflict');
        setMessage(res.error || t('admin.artifacts.modifiedElsewhere'));
        return;
      }
      if (!res.ok || !res.data) throw new Error(res.error || t('admin.artifacts.renameFailed'));
      const data = res.data;
      setTemplate(data);
      if (typeof data.label === 'string') setDraftLabel(data.label);
      setStatus('success');
      setMessage(t('admin.artifacts.renamed'));
      toast(t('admin.artifacts.renamed'));
      await loadList();
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error ? err.message : t('admin.artifacts.renameFailed')
      );
    }
  };

  const handleSave = async () => {
    if (!template) return;
    const layout = getEditableLayout(template);
    const canvas = fabricCanvasRef.current;
    if (!layout || !canvas) return;

    const currentSaveSeq = ++saveSequenceRef.current;
    setStatus('saving');
    setMessage(null);
    try {
      // SPEC-23-03: Await document.fonts.ready and any active font loads before serializing canvas geometry
      // so stored dimensions and measurements reflect final font metrics.
      if (typeof document !== 'undefined' && 'fonts' in document) {
        if (document.fonts?.ready) {
          try {
            await document.fonts.ready;
          } catch {
            // Gracefully continue if font readiness check fails
          }
        }
        if (typeof document.fonts?.load === 'function') {
          try {
            const fontLoads: Promise<any>[] = [];
            for (const obj of canvas.getObjects()) {
              if (isFabricTextObject(obj) && obj.fontFamily) {
                const sz = typeof obj.fontSize === 'number' ? obj.fontSize : DEFAULT_FONT_SIZE;
                fontLoads.push(document.fonts.load(`${sz}px "${obj.fontFamily}"`));
              }
            }
            if (fontLoads.length > 0) {
              await Promise.all(fontLoads);
            }
          } catch {
            // Gracefully continue
          }
        }
      }

      // Fabric reports group-relative left/top while an ActiveSelection is
      // live; discard it first so serialization always reads canvas coords.
      canvas.discardActiveObject();
      // The selection is gone, so the toolbar must not keep offering actions
      // (Delete, content edit) against an object that is no longer active.
      syncSelection(canvas);
      // The canvas is authoritative for the element set: additions appear here
      // and deletions are simply absent. Server-side stability rules still
      // reject removal of any seeded or required element.
      const isHealingSave = isHealingOnlyRef.current;
      isHealingOnlyRef.current = false;
      const updatedElements = serializeCanvas(
        canvas,
        layout,
        addedElementsRef.current,
        { isHealingSave }
      );
      const { updatedAt, ...templateBody } = template;
      const extraPlaceholders = [...addedPlaceholdersRef.current.values()].filter(
        (placeholder) =>
          !template.placeholders.some((existing) => existing.key === placeholder.key)
      );
      const payload = {
        ...templateBody,
        label: draftLabel.trim() || template.label,
        placeholders: [...template.placeholders, ...extraPlaceholders],
        layouts: {
          ...templateBody.layouts,
          default: {
            ...layout,
            elements: updatedElements,
          },
        },
        updatedAt,
      };

      const res = await adapter.save(template.id, payload);
      if (currentSaveSeq !== saveSequenceRef.current) return;
      if (res.status === 409) {
        // Reload first: `loadTemplate` clears the banner, so the explanation
        // has to be written after it or the admin sees nothing at all.
        await loadTemplate(template.id);
        setStatus('conflict');
        // Reloading remounts the canvas from the server copy, which throws away
        // every element added or deleted since the last successful save. Say so
        // plainly instead of leaving the admin to discover it.
        setMessage(
          t('admin.artifacts.conflictSaved').replace(
            '{error}',
            res.error || t('admin.artifacts.modifiedElsewhere')
          )
        );
        return;
      }
      if (!res.ok || !res.data) throw new Error(res.error || t('admin.artifacts.saveFailed'));
      const data = res.data;
      setTemplate(data);
      if (typeof data.label === 'string') setDraftLabel(data.label);
      setIsDirty((current) => nextDirtyState(current, 'saved'));
      setStatus('success');
      const unknownWarnings = findUnknownPredefinedFieldTokens(payload);
      if (unknownWarnings.length > 0) {
        const warningMsg = `${t('admin.artifacts.saved')} (${unknownWarnings.join(', ')})`;
        setMessage(warningMsg);
        toast(warningMsg);
      } else {
        setMessage(t('admin.artifacts.saved'));
        toast(t('admin.artifacts.saved'));
      }
      await loadList();
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.saveFailed'));
    }
  };

  const handleReset = async () => {
    if (!template || busy) return;
    if (
      !window.confirm(
        t('admin.artifacts.confirmReset').replace('{label}', template.label)
      )
    )
      return;

    // Discard any in-flight Save by incrementing sequence counter
    saveSequenceRef.current += 1;

    setStatus('resetting');
    setMessage(null);
    try {
      // Revert in-memory canvas state to the last-Saved template from adapter/store
      const data = await adapter.getOne(template.id);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoStack([]);
      setRedoStack([]);
      pendingBaselineSnapshotRef.current = null;
      addedElementsRef.current = new Map();
      addedPlaceholdersRef.current = new Map();
      setSelectedElementIds([]);
      setContextMenu(null);
      setTemplate({ ...data });
      if (typeof data.label === 'string') setDraftLabel(data.label);
      setIsDirty((current) => nextDirtyState(current, 'reset'));
      setStatus('success');
      setMessage(t('admin.artifacts.resetDone'));
      toast(t('admin.artifacts.resetDone'));
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.resetFailed'));
    }
  };

  const handleRemeasureAll = useCallback(async () => {
    if (busy) return;
    setStatus('saving');
    setMessage('Re-measuring templates…');
    try {
      if (typeof document !== 'undefined' && 'fonts' in document && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }
      const fabric = await import('fabric');
      const summaries = await adapter.list();
      let totalMeasured = 0;
      let totalSkipped = 0;
      let savedCount = 0;

      for (const item of summaries) {
        const fullTmpl = await adapter.getOne(item.id);
        const { updatedTemplate, measuredCount, skippedCount, changed } = healTemplate(
          fullTmpl,
          fabric
        );
        totalSkipped += skippedCount;
        if (changed && measuredCount > 0) {
          totalMeasured += measuredCount;
          const { updatedAt, ...templateBody } = updatedTemplate;
          const res = await adapter.save(item.id, {
            ...templateBody,
            updatedAt,
          });
          if (res.ok) {
            savedCount++;
          }
        }
      }

      await loadList();
      if (selectedId) {
        await loadTemplate(selectedId);
      }
      setStatus('idle');
      const outcome = `Re-measured ${totalMeasured} element(s), skipped ${totalSkipped} already-measured across ${savedCount} saved template(s).`;
      setMessage(outcome);
      toast(outcome);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Re-measure failed');
      toast.error(err instanceof Error ? err.message : 'Re-measure failed');
    }
  }, [busy, adapter, selectedId, loadList, loadTemplate]);

  const reconcileSelectedTemplate = async (
    summaries: ArtifactTemplateSummary[]
  ) => {
    const nextSelection = reconcileSlideSelection(
      selectedIds,
      anchorId,
      selectedId,
      summaries.map((s) => s.id)
    );
    setSelectedIds(new Set(nextSelection.selectedIds));
    setAnchorId(nextSelection.anchorId);

    const activeToUse = nextSelection.activeId;
    if (activeToUse !== selectedId) {
      setSelectedId(activeToUse);
    }

    const summary = activeToUse ? summaries.find((item) => item.id === activeToUse) : null;
    if (!summary) {
      setSelectedId(null);
      setTemplate(null);
      setIsDirty((current) => nextDirtyState(current, 'template-changed'));
      setStatus('idle');
      return;
    }
    // A delete/reorder refreshes every remaining row's concurrency token. Keep
    // an unsaved canvas mounted, but advance its token from the authoritative
    // summary so its next Save is not needlessly rejected as stale.
    if (isDirty) {
      setTemplate((current) =>
        current?.id === summary.id ? { ...current, updatedAt: summary.updatedAt } : current
      );
      return;
    }
    await loadTemplate(summary.id);
  };

  const handleDeleteSelectedTemplates = async (singleItem?: ArtifactTemplateSummary) => {
    let targetIds: string[];
    if (singleItem) {
      if (selectedIds.has(singleItem.id) && selectedIds.size > 1) {
        targetIds = templates.filter((t) => selectedIds.has(t.id)).map((t) => t.id);
      } else {
        targetIds = [singleItem.id];
      }
    } else {
      targetIds = templates.filter((t) => selectedIds.has(t.id)).map((t) => t.id);
    }

    if (targetIds.length === 0) return;

    const containsActive = selectedId !== null && targetIds.includes(selectedId);
    let warning: string;

    if (targetIds.length === 1) {
      const item = templates.find((t) => t.id === targetIds[0]) ?? singleItem;
      const label = item?.label ?? '';
      warning =
        containsActive && isDirty && isEditable
          ? t('admin.artifacts.confirmDeleteDirty').replace('{label}', label)
          : t('admin.artifacts.confirmDelete').replace('{label}', label);
    } else {
      warning =
        containsActive && isDirty && isEditable
          ? t('admin.artifacts.confirmDeleteBulkDirty').replace('{count}', String(targetIds.length))
          : t('admin.artifacts.confirmDeleteBulk').replace('{count}', String(targetIds.length));
    }

    if (!window.confirm(warning)) return;

    setStatus('deleting');
    setIsDeletingSelected(true);
    setMessage(null);

    try {
      const result = await runBulkDelete({
        selectedIds: targetIds,
        orderedSummaries: templates,
        deleteFn: (id, updatedAt) => adapter.delete(id, updatedAt),
        listFn: () => loadList(),
      });

      setTemplates(result.survivors);

      const nextActiveId = resolveNextActiveSlide(result.deletedIds, selectedId, templates);
      if (result.deletedIds.includes(selectedId ?? '')) {
        if (!nextActiveId) {
          setSelectedId(null);
          setTemplate(null);
          setIsDirty((current) => nextDirtyState(current, 'template-changed'));
        } else {
          setSelectedId(nextActiveId);
        }
      } else if (selectedId) {
        // Active slide survived: update in-memory updatedAt from survivors without remounting canvas
        const survivor = result.survivors.find((s) => s.id === selectedId);
        if (survivor) {
          setTemplate((curr) => (curr ? { ...curr, updatedAt: survivor.updatedAt } : null));
        }
      }

      // Reconcile selection: remove deleted IDs, ensure active replacement is selected
      const survivingSelected = Array.from(selectedIds).filter((id) => !result.deletedIds.includes(id));
      const finalSelectedCandidates =
        nextActiveId && !survivingSelected.includes(nextActiveId)
          ? [nextActiveId, ...survivingSelected]
          : survivingSelected;

      const nextSelection = reconcileSlideSelection(
        finalSelectedCandidates,
        anchorId,
        nextActiveId,
        result.survivors.map((s) => s.id)
      );
      setSelectedIds(new Set(nextSelection.selectedIds));
      setAnchorId(nextSelection.anchorId);
      if (nextSelection.activeId !== nextActiveId) {
        setSelectedId(nextSelection.activeId);
      }

      if (!result.completed) {
        setStatus('conflict');
        const partialMsg = t('admin.artifacts.deletedBulkPartial')
          .replace('{deleted}', String(result.deletedCount))
          .replace('{total}', String(targetIds.length));
        setMessage(partialMsg);
        toast(partialMsg);
      } else {
        setStatus('success');
        const successMsg =
          targetIds.length === 1
            ? t('admin.artifacts.deleted').replace('{label}', templates.find((t) => t.id === targetIds[0])?.label ?? '')
            : t('admin.artifacts.deletedBulk').replace('{count}', String(result.deletedCount));
        setMessage(successMsg);
        toast(successMsg);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.deleteFailed'));
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handleDeleteTemplate = async (item: ArtifactTemplateSummary) => {
    await handleDeleteSelectedTemplates(item);
  };

  const handleDeckSequenceKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.defaultPrevented) return;
    if ((e.nativeEvent as any)?.isComposing || (e as any).isComposing) return;
    const target = e.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target?.isContentEditable ||
      target?.closest('button')
    ) {
      return;
    }
    if (busy || isDeletingSelected) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      const allIds = selectAllSlides(templates.map((t) => t.id));
      setSelectedIds(new Set(allIds));
      if (!selectedId && allIds.length > 0) {
        setSelectedId(allIds[0]);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (selectedId) {
        setSelectedIds(new Set([selectedId]));
        setAnchorId(selectedId);
      } else {
        setSelectedIds(new Set());
        setAnchorId(null);
        setTemplate(null);
        setIsDirty((current) => nextDirtyState(current, 'template-changed'));
      }
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      void handleDeleteSelectedTemplates();
      return;
    }
  };

  const handleSlideClick = (
    e: React.MouseEvent | React.KeyboardEvent,
    item: ArtifactTemplateSummary
  ) => {
    const isCtrlOrCmd = 'ctrlKey' in e && (e.ctrlKey || e.metaKey);
    const isShift = 'shiftKey' in e && e.shiftKey;
    const orderedIds = templates.map((t) => t.id);

    const result = resolveMultiSelectClick({
      clickedId: item.id,
      isCtrlOrCmd,
      isShift,
      currentSelectedIds: selectedIds,
      currentAnchorId: anchorId,
      currentActiveId: selectedId,
      orderedIds,
    });

    if (result.requiresDiscardConfirmation) {
      const proceed = mayDiscard(
        isDirty && isEditable,
        DISCARD_ON_SWITCH_CONFIRMATION,
        (message) => window.confirm(message)
      );
      if (!proceed) return;
    }

    setSelectedIds(new Set(result.selectedIds));
    setAnchorId(result.anchorId);
    if (result.activeId !== selectedId) {
      setSelectedId(result.activeId);
      if (!result.activeId) {
        setTemplate(null);
        setIsDirty((current) => nextDirtyState(current, 'template-changed'));
      }
    }
  };

  const handleReorderTemplates = async (desired: ArtifactTemplateSummary[]) => {
    setStatus('reordering');
    setMessage(null);
    try {
      const res = await adapter.reorder(
        desired.map(({ id, updatedAt }) => ({ id, updatedAt }))
      );
      if (res.status === 409 || res.status === 400) {
        const summaries = await loadList();
        await reconcileSelectedTemplate(summaries);
        setStatus('conflict');
        setMessage(
          t('admin.artifacts.reorderConflict').replace(
            '{error}',
            res.error || t('admin.artifacts.modifiedElsewhere')
          )
        );
        return;
      }
      if (!res.ok) throw new Error(res.error || t('admin.artifacts.reorderFailed'));
      const summaries = res.templates ?? (await loadList());
      setTemplates(summaries);
      await reconcileSelectedTemplate(summaries);
      setStatus('success');
      setMessage(t('admin.artifacts.reorderSaved'));
      toast(t('admin.artifacts.reorderSaved'));
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : t('admin.artifacts.reorderFailed'));
    }
  };

  const handleMoveTemplate = async (item: ArtifactTemplateSummary, direction: -1 | 1) => {
    if (busy || isDeletingSelected) return;
    const index = templates.findIndex((candidate) => candidate.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= templates.length) return;

    const desired = moveSelectedBlock({
      orderedItems: templates,
      selectedIds,
      draggedId: item.id,
      targetIndex: target,
    });
    if (desired === templates || desired.every((t, i) => t.id === templates[i].id)) return;
    await handleReorderTemplates(desired);
  };

  const isResettable = Boolean(template && isEditable);
  const labelDirty = Boolean(
    template && draftLabel.trim() !== '' && draftLabel.trim() !== template.label
  );

  // Letterbox the 960×540 reference canvas inside its shell: scale to the smaller
  // of width/height ratio so the stage always fills the card without scrollbars.
  useEffect(() => {
    const shell = canvasShellRef.current;
    if (!shell) return;
    fitCanvasToShell();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fitCanvasToShell());
    observer.observe(shell);
    return () => {
      observer.disconnect();
    };
  }, [template, fitCanvasToShell]);

  // The browser-level exits: closing the tab, reloading, typing a new URL. The
  // listener is the registration itself — armed only while an editable canvas
  // has something to lose, and removed on cleanup, so an operator who has only
  // read a template meets nothing.
  useEffect(() => {
    if (!isDirty || !isEditable) return;
    window.addEventListener('beforeunload', beforeUnloadGuard);
    return () => {
      window.removeEventListener('beforeunload', beforeUnloadGuard);
    };
  }, [isDirty, isEditable]);

  // `beforeunload` cannot see a client-side route change, so the same state is
  // published to the page's navigation blocker, which is what `Header`'s links
  // read. Cleared on unmount: a blocked flag outliving this editor would put a
  // confirmation in front of every link on the page it left behind.
  useEffect(() => {
    setIsBlocked(isDirty && isEditable);
    return () => {
      setIsBlocked(false);
    };
  }, [isDirty, isEditable, setIsBlocked]);

  // The canvas stops accepting input while a request is in flight, the way the
  // toolbar buttons already do.
  //
  // Without this there is a window with no good outcome. `handleSave` reads the
  // canvas once, then awaits; a drag landing in that gap fires `object:modified`
  // and sets the flag, but the edit is not in the payload, and the success path
  // replaces `template` — which remounts the canvas from the server copy and
  // throws that edit away. Clearing the flag then reports clean over work that
  // was silently discarded, which is the exact failure this story exists to
  // prevent. Discarding the active object closes the toolbar paths in the same
  // move: with no selection, `applyTextStyle` changes nothing and the text field
  // disables itself.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    if (busy) canvas.discardActiveObject();
    canvas.selection = !busy;
    for (const object of canvas.getObjects()) {
      object.selectable = !busy;
      object.evented = !busy;
    }
    canvas.requestRenderAll();
  }, [busy]);
  const canDeleteSelection = selectedElementIds.length > 0;

  return (
    <div className={hideList ? 'block' : 'grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)] min-h-[580px]'}>
      {!hideList ? (
        <aside className="space-y-4 lg:space-y-0 lg:flex lg:flex-col lg:gap-4 lg:h-0 lg:min-h-full">
          {prefixListSlot ? <div className="shrink-0">{prefixListSlot}</div> : null}

          {/* POIN 1 & 2: REGION "NEW SLIDE" */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 shadow-sm shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Slide</span>
              <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                {adapter === mainSpineAdapter ? 'Spine Placement' : 'Add Slide'}
              </span>
            </div>
            {adapter === mainSpineAdapter ? (
              <div className="flex gap-1.5 pt-0.5">
                <Select
                  value={newSlideType}
                  onValueChange={(val) => {
                    if (val) setNewSlideType(val);
                  }}
                  disabled={busy}
                >
                  <SelectTrigger className="flex-1 min-w-0 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">📄 General Slide (Canvas)</SelectItem>
                    {availableSongSets.length > 0 ? (
                      availableSongSets.map((s) => (
                        <SelectItem key={s.variableName} value={`song:${s.variableName}`}>
                          🎵 {s.title}
                        </SelectItem>
                      ))
                    ) : null}
                    {availableAnnSets.length > 0 ? (
                      availableAnnSets.map((a) => (
                        <SelectItem key={a.id} value={`ann:${a.id}`}>
                          📢 {a.label}
                        </SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={busy}
                  className="shrink-0 h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            ) : (
              <div className="flex gap-1.5 pt-0.5">
                <Input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={t('admin.artifacts.addPlaceholder')}
                  disabled={busy}
                  className="flex-1 text-xs h-8"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleCreate()}
                  disabled={busy || !newLabel.trim()}
                  className="shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              </div>
            )}
            <div className="pt-2 border-t border-border/50">
              <input
                ref={pptxFileInputRef}
                type="file"
                accept=".pptx"
                className="hidden"
                onChange={handleImportPptx}
                disabled={busy || isImporting}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => pptxFileInputRef.current?.click()}
                disabled={busy || isImporting}
                className="w-full text-xs h-8 border-dashed"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                {isImporting ? 'Importing PPTX...' : 'Import PPTX'}
              </Button>
            </div>
          </div>

          {/* LIST TEMPLATES (POIN 3: HOVER ACTIONS & DND REORDER) */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-sm flex flex-col flex-1 min-h-[220px] max-h-[calc(100vh-380px)] lg:max-h-full">
            <div className="flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">Deck Sequence</span>
                {selectedIds.size > 1 ? (
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0">
                    {t('admin.artifacts.selectedCount').replace('{count}', String(selectedIds.size))}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {selectedIds.size > 1 ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedId) {
                          setSelectedIds(new Set([selectedId]));
                          setAnchorId(selectedId);
                        } else {
                          setSelectedIds(new Set());
                          setAnchorId(null);
                        }
                      }}
                      disabled={busy || isDeletingSelected}
                      className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {t('admin.artifacts.deselect')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDeleteSelectedTemplates()}
                      disabled={busy || isDeletingSelected}
                      className="h-6 px-2 text-[11px] font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t('admin.artifacts.deleteSelected')} ({selectedIds.size})</span>
                    </Button>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground font-mono">{templates.length} slides</span>
                )}
              </div>
            </div>
            <ul
              tabIndex={0}
              onKeyDown={handleDeckSequenceKeyDown}
              className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-lg"
            >
              {templates.map((item, index) => {
                const isActive = selectedId === item.id;
                const isCoSelected = selectedIds.has(item.id) && !isActive;
                const isSelected = selectedIds.has(item.id);

                return (
                  <li
                    key={item.id}
                    draggable={!busy && !isDeletingSelected}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={() => {
                      if (dragOverIndex === index) setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDragOverIndex(null);
                      dragSourceIndexRef.current = null;
                    }}
                    onDrop={(e) => void handleDrop(e, index)}
                    className={`group relative transition-all ${
                      dragOverIndex === index ? 'ring-2 ring-primary bg-primary/20 rounded-lg' : ''
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={(e) => {
                        const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
                        if (!isModifier) {
                          if (item.id === selectedId) return;
                          const proceed = mayDiscard(
                            isDirty && isEditable,
                            DISCARD_ON_SWITCH_CONFIRMATION,
                            (message) => window.confirm(message)
                          );
                          if (!proceed) return;
                          setSelectedId(item.id);
                          setSelectedIds(new Set([item.id]));
                          setAnchorId(item.id);
                          return;
                        }
                        handleSlideClick(e, item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        const isModifier = event.ctrlKey || event.metaKey || event.shiftKey;
                        if (!isModifier) {
                          if (item.id === selectedId) return;
                          const proceed = mayDiscard(
                            isDirty && isEditable,
                            DISCARD_ON_SWITCH_CONFIRMATION,
                            (message) => window.confirm(message)
                          );
                          if (!proceed) return;
                          setSelectedId(item.id);
                          setSelectedIds(new Set([item.id]));
                          setAnchorId(item.id);
                          return;
                        }
                        handleSlideClick(event as any, item);
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all ${
                        isActive
                          ? 'border-primary bg-primary/20 ring-1 ring-primary/40 font-semibold text-foreground'
                          : isCoSelected
                            ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/20 text-foreground'
                            : 'border-border/60 bg-muted/30 hover:bg-muted/70 hover:border-border'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-medium truncate text-foreground">{item.label}</p>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          [{kindChipLabel(item.baseType)}]
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('admin.artifacts.moveUp')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMoveTemplate(item, -1);
                          }}
                          disabled={busy || isDeletingSelected || index === 0}
                          className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('admin.artifacts.moveDown')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleMoveTemplate(item, 1);
                          }}
                          disabled={busy || isDeletingSelected || index === templates.length - 1}
                          className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Clone / Duplicate"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCloneTemplate(item);
                          }}
                          disabled={busy || isDeletingSelected}
                          className="h-7 w-7 p-1 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={t('admin.artifacts.delete')}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteTemplate(item);
                          }}
                          disabled={busy || isDeletingSelected}
                          className="h-7 w-7 p-1 text-destructive hover:text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>
      ) : null}

      <section className="min-w-0 space-y-4">
        {bannerNote ? <div>{bannerNote}</div> : null}
        {!template ? (
          <>
            <div className="h-6 min-h-[24px] flex items-center overflow-hidden">
              {message ? (
                <p
                  role="alert"
                  className={`text-xs truncate ${
                    status === 'error' || status === 'conflict'
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {message}
                </p>
              ) : null}
            </div>
            {templates.length === 0 ? (
              <div className="aspect-video w-full max-h-[calc(100vh-310px)] min-h-[320px] rounded-xl border border-dashed border-border bg-card/50 flex flex-col items-center justify-center p-8 text-center shadow-sm relative overflow-hidden">
                <div className="max-w-md flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {t('admin.artifacts.emptySequenceTitle')}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('admin.artifacts.emptySequenceDesc')}
                  </p>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => pptxFileInputRef.current?.click()}
                    disabled={busy || isImporting}
                    className="mt-2 font-semibold"
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    {isImporting ? 'Importing PPTX...' : 'Import PPTX'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.artifacts.selectHint')}</p>
            )}
          </>
        ) : (
          <>
            {/* POIN 4: SLIDE HEADER REGION (CARD RESMI DENGAN SIKLUS RENAME/RESET KONSISTEN) */}
            <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between shadow-sm min-h-[58px]">
              <div className="flex items-center gap-3">
                {allowRename && isRenaming ? (
                  <Input
                    id="artifact-label"
                    type="text"
                    value={draftLabel}
                    onChange={(event) => setDraftLabel(event.target.value)}
                    maxLength={80}
                    disabled={busy}
                    aria-label={t('admin.artifacts.rename')}
                    placeholder={template.label}
                    className="text-base font-semibold max-w-sm h-8"
                    autoFocus
                  />
                ) : (
                  <span className="text-base font-bold text-foreground">{draftLabel || template.label}</span>
                )}
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  [{kindChipLabel(template.baseType)}]
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isDirty && isEditable ? (
                  <span
                    role="status"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {UNSAVED_INDICATOR_LABEL}
                  </span>
                ) : null}

                {allowRename ? (
                  <>
                    {isRenaming ? (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsRenaming(false);
                            setDraftLabel(template.label);
                          }}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            await handleRename();
                            setIsRenaming(false);
                          }}
                          disabled={!labelDirty || busy}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsRenaming(true)}
                        disabled={busy}
                      >
                        {t('admin.artifacts.rename')}
                      </Button>
                    )}
                    <div className="h-4 w-px bg-border mx-1" />
                  </>
                ) : null}

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Canvas:</span>
                  {isResettable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={!isEditable || busy || (!isDirty && !labelDirty)}
                    >
                      {t('admin.artifacts.reset')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pptxFileInputRef.current?.click()}
                    disabled={busy || isImporting}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    {isImporting ? 'Importing...' : 'Import PPTX'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemeasureAll}
                    disabled={busy}
                  >
                    {t('admin.artifacts.remeasureAll')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSave}
                    disabled={!isEditable || busy}
                  >
                    {t('admin.artifacts.save')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="h-6 min-h-[24px] flex items-center overflow-hidden">
              {message ? (
                <p
                  role="alert"
                  className={`text-xs truncate ${
                    status === 'error' || status === 'conflict'
                      ? 'text-destructive'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {message}
                </p>
              ) : null}
            </div>

            {!isEditable ? (
              <div className="aspect-video w-full max-h-[calc(100vh-310px)] min-h-[320px] rounded-xl border border-border bg-card flex flex-col items-center justify-center p-8 text-center shadow-sm relative overflow-hidden">
                <div className="max-w-md flex flex-col items-center gap-3">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
                    {`[${kindChipLabel(template.baseType)}]`}
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    {template.label}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {template.baseType === 'ann-set-marker'
                      ? t('admin.artifacts.markerSpineNote')
                      : t('admin.artifacts.readOnlyBody').replace(
                          '{kind}',
                          `[${kindChipLabel(template.baseType)}]`
                        )}
                  </p>
                  {template.baseType === 'song-set-entry' ? (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border/50">
                      {t('admin.artifacts.songSetDynamicNote')}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                {/* TOOLBAR ROW 1: ADD NEW ELEMENTS & CHANGE BACKGROUND */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/80 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={handleUndo}
                        disabled={busy || !isEditable || isRestoringHistory || undoStack.length === 0}
                        title="Undo (Ctrl+Z)"
                        aria-label="Undo"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={handleRedo}
                        disabled={busy || !isEditable || isRestoringHistory || redoStack.length === 0}
                        title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
                        aria-label="Redo"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="h-4 w-px bg-border mx-1" />
                    <span className="text-muted-foreground font-semibold px-1">Add:</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void insertImage(file);
                        }
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant={drawingTool === 'text' ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setDrawingTool((cur) => (cur === 'text' ? null : 'text'))}
                      disabled={busy}
                      title="Text"
                    >
                      <Type className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant={drawingTool === 'rect' ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setDrawingTool((cur) => (cur === 'rect' ? null : 'rect'))}
                      disabled={busy}
                      title="Rectangle"
                      aria-label="Rectangle"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant={drawingTool === 'line' ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setDrawingTool((cur) => (cur === 'line' ? null : 'line'))}
                      disabled={busy}
                      title="Line"
                      aria-label="Line"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant={drawingTool === 'rect-outline' ? 'default' : 'outline'}
                      size="icon-sm"
                      onClick={() => setDrawingTool((cur) => (cur === 'rect-outline' ? null : 'rect-outline'))}
                      disabled={busy}
                      title="Outline Shape"
                      aria-label="Outline Shape"
                    >
                      <SquareDashed className="w-3.5 h-3.5" />
                    </Button>
                    {allowImages ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                        title="Image"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </Button>
                    ) : null}

                    <div className="h-4 w-px bg-border mx-1" />

                    <div>
                      <input
                        ref={bgFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleUploadBackgroundFile(f);
                          if (bgFileInputRef.current) bgFileInputRef.current.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBgDialog(true)}
                        className="text-xs font-medium flex items-center gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Background
                      </Button>
                    </div>

                    <div>
                      <input
                        ref={fontImportInputRef}
                        type="file"
                        accept=".ttf,.otf"
                        multiple
                        className="hidden"
                        disabled={busy || fontUploading}
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            void handleFontUploadBatch(files);
                          }
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fontImportInputRef.current?.click()}
                        disabled={busy || fontUploading}
                        className="text-xs font-medium flex items-center gap-1.5"
                        title="Import custom font (.ttf, .otf)"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{fontUploading ? t('admin.artifacts.importingFont') : t('admin.artifacts.importFont')}</span>
                      </Button>
                    </div>

                    <div className="h-4 w-px bg-border mx-1" />

                    <Select
                      value={insertPlaceholderKey}
                      onValueChange={(val) => {
                        if (val) setInsertPlaceholderKey(val);
                      }}
                      disabled={busy}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-[170px] text-xs h-8"
                        aria-label={t('admin.artifacts.insertPlaceholder')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLACEHOLDER_CATALOG.filter(
                          (entry) => allowImages || entry.type !== 'image'
                        ).map((entry) => (
                          <SelectItem key={entry.key} value={entry.key}>
                            {t(placeholderLabelKey(entry.key))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        void insertPlaceholder(insertPlaceholderKey);
                      }}
                      disabled={busy}
                      className="text-xs"
                    >
                      + Placeholder
                    </Button>
                  </div>
                </div>

                {/* TOOLBAR ROW 2: ELEMENT PROPERTIES (TWO-ROW FIXED 88px PANEL) */}
                <div className="rounded-lg bg-background border border-border text-xs h-[88px] min-h-[88px] max-h-[88px] p-2 flex flex-col justify-between shrink-0">
                  {selectedElementIds.length === 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs italic">
                          Properties (None): Select element first
                        </span>
                      </div>
                      <div className="flex items-center text-[11px] text-muted-foreground">
                        <span>Tip: Del/Backspace to delete, Drag to move, Shift+Click to multi-select</span>
                      </div>
                    </>
                  ) : selectedTextCount > 0 ? (
                    <>
                      {/* Row 1: Identity & Primary Typography */}
                      <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden shrink-0 flex-nowrap py-0.5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium font-mono text-primary uppercase">
                          TEXT
                        </span>

                        {/* Font Family Selector (Combobox with Popover) */}
                        <Popover
                          open={fontPopoverOpen}
                          onOpenChange={(open) => {
                            setFontPopoverOpen(open);
                            if (!open) {
                              setFontSearchQuery('');
                            } else {
                              setTimeout(() => {
                                fontSearchInputRef.current?.focus();
                              }, 0);
                            }
                          }}
                        >
                          <PopoverTrigger
                            className="w-[180px] h-7 text-xs border border-input rounded-lg flex items-center justify-between px-2 bg-transparent hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                            title={
                              !isFontExportReady(fontFamily) && getFontDefinition(fontFamily)?.pptxSubstitute
                                ? `${FONT_ITEMS_MAP[fontFamily] ?? fontFamily} (${t('admin.artifacts.fontUnsafeWarning')}: ${getFontDefinition(fontFamily)?.pptxSubstitute})`
                                : FONT_ITEMS_MAP[fontFamily] ?? fontFamily
                            }
                            aria-label="Font Family"
                            disabled={busy}
                          >
                            <span className="truncate flex items-center gap-1 min-w-0" style={{ fontFamily }}>
                              <span className="truncate">{FONT_ITEMS_MAP[fontFamily] ?? fontFamily}</span>
                              {!isFontExportReady(fontFamily) && getFontDefinition(fontFamily)?.pptxSubstitute ? (
                                <span
                                  className="text-[10px] text-amber-600 dark:text-amber-400 font-sans opacity-90 shrink-0"
                                  title={`${t('admin.artifacts.fontUnsafeWarning')}: ${getFontDefinition(fontFamily)?.pptxSubstitute}`}
                                >
                                  ⚠
                                </span>
                              ) : null}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                          </PopoverTrigger>
                          <PopoverContent
                            className="max-h-72 w-[240px] p-0 flex flex-col overflow-hidden"
                            side="bottom"
                            align="start"
                            sideOffset={4}
                          >
                            <div
                              className="p-1.5 sticky top-0 bg-popover z-10 border-b border-border space-y-1.5"
                              onKeyDown={(e) => {
                                if (e.key !== 'Escape') e.stopPropagation();
                              }}
                              onKeyUp={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <Input
                                ref={fontSearchInputRef}
                                type="text"
                                placeholder={t('admin.artifacts.searchFonts')}
                                value={fontSearchQuery}
                                onChange={(e) => setFontSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Escape') e.stopPropagation();
                                }}
                                onKeyUp={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="h-7 text-xs"
                                autoFocus
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full text-xs h-7 justify-center flex items-center gap-1.5 border-dashed"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  fontImportInputRef.current?.click();
                                }}
                                disabled={busy || fontUploading}
                              >
                                <Upload className="w-3 h-3" />
                                <span>{fontUploading ? t('admin.artifacts.importingFont') : t('admin.artifacts.importFont')}</span>
                              </Button>
                            </div>
                            <div className="overflow-y-auto p-1 flex-1">
                              {(['custom', 'system', 'sans', 'serif', 'display', 'script'] as FontCategory[]).map(
                                (category) => {
                                  const query = fontSearchQuery.trim().toLowerCase();
                                  const fonts = FONT_CATALOG.filter(
                                    (f) =>
                                      f.category === category &&
                                      (query === '' || f.label.toLowerCase().includes(query))
                                  );
                                  if (fonts.length === 0) return null;
                                  return (
                                    <div key={category} className="mb-1">
                                      <div className="bg-muted/90 px-2.5 py-1 text-foreground font-bold tracking-wide rounded-sm my-1 border-l-2 border-primary text-[11px] select-none">
                                        {FONT_CATEGORY_LABELS[category][locale] ?? FONT_CATEGORY_LABELS[category].en}
                                      </div>
                                      {fonts.map((f) => (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          key={f.family}
                                          onClick={() => {
                                            handleFontFamilyChange(f.family);
                                            setFontSearchQuery('');
                                            setFontPopoverOpen(false);
                                          }}
                                          className={cn(
                                            'w-full justify-between h-auto py-1.5 px-2 text-xs font-normal hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors flex items-center',
                                            f.family === fontFamily && 'bg-accent/50 font-medium'
                                          )}
                                          style={{ fontFamily: f.family }}
                                        >
                                          <span className="flex items-center gap-1.5 truncate">
                                            <span>{f.label}</span>
                                            {f.variants && f.variants.length > 0 ? (
                                              <span className="flex items-center gap-0.5 shrink-0">
                                                {f.variants.map((v) => {
                                                  const label =
                                                    v === 'boldItalic' ? 'BI' : v === 'bold' ? 'B' : v === 'italic' ? 'I' : 'R';
                                                  return (
                                                    <span
                                                      key={v}
                                                      className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted/90 text-muted-foreground border border-border/70 select-none"
                                                      title={`Variant: ${v}`}
                                                    >
                                                      {label}
                                                    </span>
                                                  );
                                                })}
                                              </span>
                                            ) : null}
                                          </span>
                                          {!isFontExportReady(f.family) && f.pptxSubstitute ? (
                                            <span
                                              className="text-[10px] text-amber-600 dark:text-amber-400 font-sans ml-2 opacity-80"
                                              title={`${t('admin.artifacts.fontUnsafeWarning')}: ${f.pptxSubstitute}`}
                                            >
                                              → {f.pptxSubstitute}
                                            </span>
                                          ) : null}
                                        </Button>
                                      ))}
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* SPEC-33-03 / SPEC-37-01: Reconciled Unacquired Font Indicator and Acquisition Upload Button */}
                        {(() => {
                          const activeEl = liveElements.find((el) => selectedElementIds.includes(el.id));
                          if (!activeEl || activeEl.type !== 'text') return null;
                          const isFontAcquired = isFontExportReady(fontFamily) || Boolean(getFontDefinition(fontFamily));
                          const isUnacquired = !isFontAcquired;
                          if (!isUnacquired) return null;
                          return (
                            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 shrink-0">
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                                Unacquired Font
                              </span>
                              <label
                                htmlFor="font-acquire-upload-input"
                                className={`text-[10px] bg-amber-600 hover:bg-amber-700 text-white px-1.5 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap ${
                                  fontUploading || busy ? 'opacity-50 pointer-events-none' : ''
                                }`}
                                title="Upload .ttf or .otf font binary to hydrate slide typography"
                              >
                                {fontUploading ? 'Uploading...' : 'Acquire Font'}
                              </label>
                              <input
                                id="font-acquire-upload-input"
                                type="file"
                                accept=".ttf,.otf"
                                multiple
                                className="hidden"
                                disabled={fontUploading || busy}
                                onChange={async (e) => {
                                  const files = e.target.files;
                                  if (files && files.length > 0) {
                                    await handleFontUploadBatch(files, fontFamily);
                                  }
                                  e.target.value = '';
                                }}
                              />
                            </div>
                          );
                        })()}

                        <input
                          type="color"
                          value={fontColor}
                          onChange={(e) => handleFontColorChange(e.target.value)}
                          className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded shrink-0"
                          title="Font Color"
                        />
                        <Input
                          ref={fontSizeInputRef}
                          type="number"
                          min={MIN_FONT_SIZE}
                          max={MAX_FONT_SIZE}
                          value={fontSizeInput}
                          onChange={(e) => handleFontSizeInput(e.target.value)}
                          onBlur={handleFontSizeCommit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-20 h-7 text-xs text-center"
                          title="Font Size"
                        />
                        <Button
                          type="button"
                          variant={fontWeight === 'bold' ? 'default' : 'outline'}
                          size="icon-sm"
                          onClick={handleToggleBold}
                          disabled={busy}
                          title={t('admin.artifacts.bold')}
                        >
                          <Bold className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant={fontStyle === 'italic' ? 'default' : 'outline'}
                          size="icon-sm"
                          onClick={handleToggleItalic}
                          disabled={busy}
                          title={t('admin.artifacts.italic')}
                        >
                          <Italic className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant={underline ? 'default' : 'outline'}
                          size="icon-sm"
                          onClick={handleToggleUnderline}
                          disabled={busy}
                          title={t('admin.artifacts.underline')}
                        >
                          <Underline className="w-3.5 h-3.5" />
                        </Button>
                        <div className="flex items-center gap-1 shrink-0" title="Letter Spacing / Tracking (px, step 0.5)">
                          <span className="text-[10px] text-muted-foreground font-mono">AV</span>
                          <Input
                            data-testid="letter-spacing"
                            type="number"
                            step="0.5"
                            value={letterSpacingInput}
                            onChange={(e) => handleLetterSpacingChange(e.target.value)}
                            className="w-16 h-7 text-xs text-center px-1"
                            title="Letter Spacing (px)"
                          />
                        </div>
                        <div className="h-4 w-px bg-border mx-1 shrink-0" />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleSetTextAlign('left')}
                          title="Align Left"
                        >
                          <AlignLeft className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleSetTextAlign('center')}
                          title="Align Center"
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleSetTextAlign('right')}
                          title="Align Right"
                        >
                          <AlignRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Row 2: Advanced Effects & Sliders */}
                      <div className="flex items-center gap-4 overflow-x-auto overflow-y-hidden shrink-0 flex-nowrap py-0.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              const next = lineHeight >= 1.8 ? 1.0 : Number((lineHeight + 0.2).toFixed(1));
                              handleLineHeightChange(next);
                            }}
                            disabled={busy}
                            title={`Line Height (${lineHeight.toFixed(1)})`}
                          >
                            <MoveVertical className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-[11px] text-muted-foreground w-12">
                            {lineHeight.toFixed(1)}x
                          </span>
                          <input
                            type="range"
                            min={0.8}
                            max={2.4}
                            step={0.1}
                            value={lineHeight}
                            onChange={(e) => handleLineHeightChange(Number(e.target.value))}
                            disabled={busy}
                            className="w-20 h-3 accent-primary cursor-pointer"
                            title={`Line Height: ${lineHeight.toFixed(1)}`}
                          />
                        </div>

                        <div className="h-4 w-px bg-border shrink-0" />

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant={textShadow ? 'default' : 'outline'}
                            size="icon-sm"
                            onClick={handleToggleTextShadow}
                            disabled={busy}
                            title="Text Shadow"
                          >
                            <span className="font-black text-xs drop-shadow leading-none">S</span>
                          </Button>
                          <span className="text-[11px] text-muted-foreground">Shadow</span>
                          {textShadow && (
                            <input
                              type="range"
                              min={0}
                              max={20}
                              step={1}
                              value={shadowBlur}
                              onChange={(e) => void handleShadowBlurChange(Number(e.target.value))}
                              disabled={busy}
                              className="w-20 h-3 accent-primary cursor-pointer"
                              title={`Shadow Blur: ${shadowBlur}`}
                            />
                          )}
                        </div>
                      </div>
                    </>
                  ) : fabricCanvasRef.current?.getActiveObjects().some((o) => Boolean((o as any).data?.imageRef)) ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs italic">
                          Properties (Image): No properties to change
                        </span>
                      </div>
                      <div className="flex items-center text-[11px] text-muted-foreground">
                        <span>Aspect ratio locked on corner handles • Use Context Menu or Del to remove</span>
                      </div>
                    </>
                  ) : selectedLineCount > 0 ? (
                    <>
                      <div className="flex items-center gap-3 overflow-x-auto overflow-y-hidden shrink-0 flex-nowrap py-0.5">
                        <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium font-mono text-accent-foreground uppercase">
                          LINE
                        </span>
                        <Label className="flex items-center gap-1.5 text-xs">
                          Color:
                          <input
                            type="color"
                            value={strokeColor}
                            onChange={(e) => handleStrokeColorChange(e.target.value)}
                            className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded"
                            title="Line Color"
                          />
                        </Label>
                        <Label className="flex items-center gap-1.5 text-xs">
                          Thickness:
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={strokeWidth}
                            onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                            className="w-14 h-7 text-xs px-1.5 border border-input rounded bg-transparent"
                            title="Line Thickness (px)"
                          />
                          <span className="text-[10px] text-muted-foreground">px</span>
                        </Label>
                      </div>
                      <div className="flex items-center text-[11px] text-muted-foreground">
                        <span>Divider line • Drag handles to scale or reposition</span>
                      </div>
                    </>
                  ) : selectedOutlineShapeCount > 0 ? (
                    <>
                      <div className="flex items-center gap-3 overflow-x-auto overflow-y-hidden shrink-0 flex-nowrap py-0.5">
                        <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium font-mono text-accent-foreground uppercase">
                          SHAPE (OUTLINE)
                        </span>
                        <Label className="flex items-center gap-1.5 text-xs">
                          Border Color:
                          <input
                            type="color"
                            value={strokeColor}
                            onChange={(e) => handleStrokeColorChange(e.target.value)}
                            className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded"
                            title="Outline Border Color"
                          />
                        </Label>
                        <Label className="flex items-center gap-1.5 text-xs">
                          Thickness:
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={strokeWidth}
                            onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
                            className="w-14 h-7 text-xs px-1.5 border border-input rounded bg-transparent"
                            title="Border Thickness (px)"
                          />
                          <span className="text-[10px] text-muted-foreground">px</span>
                        </Label>
                      </div>
                      <div className="flex items-center text-[11px] text-muted-foreground">
                        <span>Decorative outline container (transparent fill) • Drag handles to scale</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium font-mono text-accent-foreground uppercase">
                          SHAPE
                        </span>
                        <Label className="flex items-center gap-1.5 text-xs">
                          Fill Color:
                          <input
                            type="color"
                            value={shapeFill}
                            onChange={(e) => handleSetShapeFill(e.target.value)}
                            className="w-5 h-5 bg-transparent border-0 cursor-pointer rounded"
                          />
                        </Label>
                      </div>
                      <div className="flex items-center text-[11px] text-muted-foreground">
                        <span>Rectangular shape container • Drag handles to scale</span>
                      </div>
                    </>
                  )}
                </div>

                {/* CANVAS WORKSPACE & CONTEXT MENU (POIN 5 & 6) */}
                <div
                  ref={canvasShellRef}
                  className="relative flex aspect-video w-full max-h-[calc(100vh-310px)] min-h-[320px] items-center justify-center overflow-hidden rounded-xl border border-border bg-black/90"
                  onContextMenu={(e) => {
                    // Prevent native browser context menu on canvas shell
                    e.preventDefault();
                  }}
                >
                  {/* SPEC-27-02: 16:9 Stage Container with high-contrast boundary, drop shadow, and overflow: hidden */}
                  <div
                    data-testid="editor-16-9-stage"
                    style={{
                      width: `${stageDimensions.width}px`,
                      height: `${stageDimensions.height}px`,
                      position: 'relative',
                      overflow: 'hidden',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                      backgroundColor: '#000000',
                    }}
                  >
                    {/* Visual Layer: Real ArtifactSlide Component (Option A) */}
                    {liveInstance ? (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          width: '100%',
                          height: '100%',
                        }}
                      >
                        <ArtifactSlide instance={liveInstance} />
                      </div>
                    ) : null}

                    {/* Interaction Layer: Transparent Fabric Canvas Overlay */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'auto',
                        width: '100%',
                        height: '100%',
                      }}
                    >
                      <canvas ref={canvasRef} />
                    </div>
                  </div>

                  {/* Context Menu (Right Click) */}
                  {contextMenu ? (
                    <div
                      style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                      className="absolute z-50 min-w-[160px] rounded-lg border border-border bg-popover/95 p-1 text-xs text-popover-foreground shadow-xl backdrop-blur-sm space-y-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-left cursor-pointer select-none"
                        onClick={() => {
                          handleReorderLayer('front');
                          setContextMenu(null);
                        }}
                      >
                        <span>{t('admin.artifacts.bringToFront')}</span>
                        <span className="text-[10px] text-muted-foreground">Top</span>
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-left cursor-pointer select-none"
                        onClick={() => {
                          handleReorderLayer('forward');
                          setContextMenu(null);
                        }}
                      >
                        <span>{t('admin.artifacts.bringForward')}</span>
                        <span className="text-[10px] text-muted-foreground">+1</span>
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-left cursor-pointer select-none"
                        onClick={() => {
                          handleReorderLayer('backward');
                          setContextMenu(null);
                        }}
                      >
                        <span>{t('admin.artifacts.sendBackward')}</span>
                        <span className="text-[10px] text-muted-foreground">-1</span>
                      </div>
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-left cursor-pointer select-none"
                        onClick={() => {
                          handleReorderLayer('back');
                          setContextMenu(null);
                        }}
                      >
                        <span>{t('admin.artifacts.sendToBack')}</span>
                        <span className="text-[10px] text-muted-foreground">Bottom</span>
                      </div>
                      <div className="h-px bg-border my-1" />
                      <div
                        role="button"
                        tabIndex={0}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-accent hover:text-accent-foreground text-left cursor-pointer select-none"
                        onClick={() => {
                          void handleDuplicateSelected();
                          setContextMenu(null);
                        }}
                      >
                        <span>{t('admin.artifacts.duplicateSelected')}</span>
                      </div>
                      <div
                        role="button"
                        tabIndex={canDeleteSelection ? 0 : -1}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left select-none ${
                          canDeleteSelection
                            ? 'hover:bg-destructive/10 text-destructive cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (canDeleteSelection) {
                            handleDeleteSelected();
                            setContextMenu(null);
                          }
                        }}
                      >
                        <span>{t('admin.artifacts.deleteSelected')}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </>
        )}

        {/* Change Background Modal Dialog */}
        {showBgDialog ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Change Canvas Background</h3>
                <Button variant="outline" size="sm" onClick={() => setShowBgDialog(false)}>
                  ✕
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => bgFileInputRef.current?.click()}
                    className="flex-1"
                  >
                    Upload Image File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleChangeBackgroundUrl(null)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    Remove Background
                  </Button>
                </div>

                {bgLibrary.length > 0 ? (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Choose from Background Library:</Label>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {bgLibrary.map((bg) => (
                        <div
                          key={bg.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => void handleChangeBackgroundUrl(bg.url)}
                          className="aspect-video rounded-lg overflow-hidden border border-border hover:border-primary cursor-pointer transition-all"
                        >
                          <img src={bg.url} alt="Background" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
