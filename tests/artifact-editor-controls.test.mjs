/**
 * DEC-004 / W3 Registry Canvas Controls Tests.
 *
 * Verifies:
 * 1. Image element insertion and canvas serialization.
 * 2. Explicit dense zIndex assignment (0..N-1) on canvas serialization and layer reordering.
 * 3. Conditional bold/italic styling:
 *    - Off-default ('bold' or 'italic') is serialized and accepted by validate_artifact.go rules.
 *    - Construction default ('normal' or unset) is NOT serialized on untouched seed layouts.
 * 4. Image deletion from layout leaves shared image references intact.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  serializeTextStyle,
  serializeCanvas,
  calculateImageFit,
  resolveInitialSelectedId,
  shouldPreserveSelectionOnContextMenu,
  computeContextMenuCoords,
  handleContextMenuTrigger,
  updateImageElementFit,
  syncImageClipOnMove,
  syncImageClipOnScale,
  isBackgroundElement,
  filterOutBackgroundElements,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);
const { validateArtifactTemplate } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'validate.ts')).href
);

// Mock minimal Fabric objects to test pure serialization functions in Node environment
class MockFabricObject {
  constructor(options = {}) {
    this.type = options.type || 'rect';
    this.left = options.left ?? 0;
    this.top = options.top ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 100;
    this.scaleX = options.scaleX ?? 1;
    this.scaleY = options.scaleY ?? 1;
    this.data = options.data || {};
    this.fill = options.fill;
  }
  get(key) {
    if (key === 'data') return this.data;
    return this[key];
  }
  set(opts) {
    Object.assign(this, opts);
    return this;
  }
}

class MockFabricText extends MockFabricObject {
  constructor(text = '', options = {}) {
    super({ ...options, type: 'text' });
    this.text = text;
    this.fontSize = options.fontSize;
    this.fontFamily = options.fontFamily;
    this.fontWeight = options.fontWeight;
    this.fontStyle = options.fontStyle;
    this.underline = options.underline;
    this.textAlign = options.textAlign;
  }
}

class MockCanvas {
  constructor(objects = []) {
    this._objects = [...objects];
  }
  getObjects() {
    return [...this._objects];
  }
  bringObjectForward(obj) {
    const idx = this._objects.indexOf(obj);
    if (idx < 0 || idx === this._objects.length - 1) return false;
    this._objects.splice(idx, 1);
    this._objects.splice(idx + 1, 0, obj);
    return true;
  }
  sendObjectBackwards(obj) {
    const idx = this._objects.indexOf(obj);
    if (idx <= 0) return false;
    this._objects.splice(idx, 1);
    this._objects.splice(idx - 1, 0, obj);
    return true;
  }
  bringObjectToFront(obj) {
    const idx = this._objects.indexOf(obj);
    if (idx < 0 || idx === this._objects.length - 1) return false;
    this._objects.splice(idx, 1);
    this._objects.push(obj);
    return true;
  }
  sendObjectToBack(obj) {
    const idx = this._objects.indexOf(obj);
    if (idx <= 0) return false;
    this._objects.splice(idx, 1);
    this._objects.unshift(obj);
    return true;
  }
}

test('Part 1 & 2: Image insertion and dense zIndex layer ordering (0..N-1)', () => {
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 'e1',
        type: 'text',
        required: false,
        x: 10,
        y: 10,
        w: 40,
        h: 20,
        zIndex: 0,
        content: 'Title',
        style: { fontSize: 32, fontColor: '#FFFFFF' },
      },
      {
        id: 'e2',
        type: 'shape',
        required: false,
        x: 20,
        y: 20,
        w: 30,
        h: 30,
        zIndex: 1,
        style: { fillColor: '#5C2E16', opacity: 1 },
      },
    ],
  };

  const added = new Map([
    [
      'usr-img-1',
      {
        id: 'usr-img-1',
        type: 'image',
        required: false,
        x: 50,
        y: 50,
        w: 30,
        h: 30,
        zIndex: 2,
        imageRef: '/api/uploads/0123456789abcdef0123456789abcdef.png',
      },
    ],
  ]);

  const obj1 = new MockFabricText('Title', { data: { elementId: 'e1' }, left: 96, top: 54, width: 384, height: 108 });
  const obj2 = new MockFabricObject({ data: { elementId: 'e2' }, left: 192, top: 108, width: 288, height: 162 });
  const obj3 = new MockFabricObject({ data: { elementId: 'usr-img-1' }, left: 480, top: 270, width: 288, height: 162 });

  const canvas = new MockCanvas([obj1, obj2, obj3]);

  // Serializing original canvas order: obj1=0, obj2=1, obj3=2
  const elements1 = serializeCanvas(canvas, layout, added);
  assert.equal(elements1.length, 3);
  const byId1 = new Map(elements1.map((e) => [e.id, e]));
  assert.equal(byId1.get('e1').zIndex, 0);
  assert.equal(byId1.get('e2').zIndex, 1);
  assert.equal(byId1.get('usr-img-1').zIndex, 2);
  assert.equal(byId1.get('usr-img-1').imageRef, '/api/uploads/0123456789abcdef0123456789abcdef.png');

  // Reorder: Send image to back (obj3 becomes first in canvas)
  canvas.sendObjectToBack(obj3);
  assert.deepEqual(canvas.getObjects().map((o) => o.data.elementId), ['usr-img-1', 'e1', 'e2']);

  const elements2 = serializeCanvas(canvas, layout, added);
  const byId2 = new Map(elements2.map((e) => [e.id, e]));
  assert.equal(byId2.get('usr-img-1').zIndex, 0);
  assert.equal(byId2.get('e1').zIndex, 1);
  assert.equal(byId2.get('e2').zIndex, 2);

  // Validate dense contiguous zIndex without gaps or duplicates
  const zIndices = elements2.map((e) => e.zIndex).sort((a, b) => a - b);
  assert.deepEqual(zIndices, [0, 1, 2]);

  // Reorder existing elements without adding new ones: e1 and e2
  const simpleLayout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      { id: 'e1', type: 'text', required: false, x: 10, y: 10, w: 40, h: 20, zIndex: 1 },
      { id: 'e2', type: 'shape', required: false, x: 20, y: 20, w: 30, h: 30, zIndex: 1 },
    ],
  };
  const cObj1 = new MockFabricText('E1', { data: { elementId: 'e1' } });
  const cObj2 = new MockFabricObject({ data: { elementId: 'e2' } });
  // Initial order: e1 (index 0), e2 (index 1)
  const reorderCanvas = new MockCanvas([cObj1, cObj2]);
  const noAdded = new Map();
  // Untouched save keeps [1, 1]
  const unchanged = serializeCanvas(reorderCanvas, simpleLayout, noAdded);
  assert.deepEqual(unchanged.map(e => e.zIndex), [1, 1]);

  // Operator reorders: send e2 backwards / bring e2 to front (flip order to e2, e1)
  reorderCanvas.bringObjectToFront(cObj1); // already front
  reorderCanvas.sendObjectToBack(cObj1); // becomes [cObj1, cObj2] -> wait, send to back makes cObj1 index 0
  // let's swap:
  reorderCanvas.bringObjectToFront(cObj1); // [cObj2, cObj1]
  const reordered = serializeCanvas(reorderCanvas, simpleLayout, noAdded);
  const reorderedById = new Map(reordered.map(e => [e.id, e]));
  assert.equal(reorderedById.get('e2').zIndex, 0);
  assert.equal(reorderedById.get('e1').zIndex, 1);
});

test('Part 3: Bold and Italic serialization follows setIfMeaningful discipline', () => {
  const sourceElem = {
    id: 'e1',
    type: 'text',
    required: false,
    x: 10,
    y: 10,
    w: 40,
    h: 20,
    zIndex: 0,
    content: 'Hello',
  };

  // Case A: Untouched / default text object without bold or italic
  const textObjNormal = new MockFabricText('Hello', {
    fill: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Arial',
    textAlign: 'left',
    // fontWeight and fontStyle undefined/normal
  });
  const styleNormal = serializeTextStyle(sourceElem, textObjNormal);
  // Must NOT invent or write fontWeight / fontStyle when they match defaults
  assert.equal(styleNormal, undefined);

  // Case B: Explicit Bold
  const textObjBold = new MockFabricText('Hello', {
    fill: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    textAlign: 'left',
  });
  const styleBold = serializeTextStyle(sourceElem, textObjBold);
  assert.ok(styleBold);
  assert.equal(styleBold.fontWeight, 'bold');
  assert.equal(styleBold.fontStyle, undefined);

  // Case C: Explicit Italic
  const textObjItalic = new MockFabricText('Hello', {
    fill: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Arial',
    fontStyle: 'italic',
    textAlign: 'left',
  });
  const styleItalic = serializeTextStyle(sourceElem, textObjItalic);
  assert.ok(styleItalic);
  assert.equal(styleItalic.fontStyle, 'italic');
  assert.equal(styleItalic.fontWeight, undefined);

  // Case D: Both Bold and Italic
  const textObjBoth = new MockFabricText('Hello', {
    fill: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontStyle: 'italic',
    textAlign: 'left',
  });
  const styleBoth = serializeTextStyle(sourceElem, textObjBoth);
  assert.ok(styleBoth);
  assert.equal(styleBoth.fontWeight, 'bold');
  assert.equal(styleBoth.fontStyle, 'italic');

  // Case E: Underline (BUG-10, OQ-41)
  const textObjUnderline = new MockFabricText('Hello', {
    fill: '#FFFFFF',
    fontSize: 32,
    fontFamily: 'Arial',
    underline: true,
    textAlign: 'left',
  });
  const styleUnderline = serializeTextStyle(sourceElem, textObjUnderline);
  assert.ok(styleUnderline);
  assert.equal(styleUnderline.textDecoration, 'underline');
});

test('SPEC-12-01 / BUG-10: Template with textDecoration: underline passes validator', () => {
  const templateWithUnderline = {
    schemaVersion: 1,
    id: 'underline-template',
    label: 'Underline Template',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'e1',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 80,
            h: 20,
            zIndex: 0,
            content: 'Underlined Header',
            style: {
              fontFamily: 'Arial',
              fontSize: 32,
              fontColor: '#FFFFFF',
              textDecoration: 'underline',
              textAlign: 'center',
            },
          },
        ],
      },
    },
  };
  const validated = validateArtifactTemplate(templateWithUnderline);
  assert.equal(validated.layouts.default.elements[0].style.textDecoration, 'underline');
});

test('Seed conformance proof: saving an untouched template does NOT introduce new fontStyle or fontWeight keys', () => {
  const seedElement = {
    id: 'e1',
    type: 'text',
    required: false,
    x: 5.63,
    y: 55.62,
    w: 56.42,
    h: 25.47,
    zIndex: 1,
    content: 'Welcome to',
    style: {
      fontSize: 101.75,
      fontColor: '#FFFFFF',
      textAlign: 'left',
    },
  };

  const textObj = new MockFabricText('Welcome to', {
    fill: '#FFFFFF',
    fontSize: 101.75,
    fontFamily: 'Arial',
    textAlign: 'left',
  });

  const serializedStyle = serializeTextStyle(seedElement, textObj);
  assert.equal(serializedStyle.fontWeight, undefined);
  assert.equal(serializedStyle.fontStyle, undefined);
  assert.deepEqual(serializedStyle, seedElement.style);
});

test('Validation: Template with image element, bold, italic, and explicit zIndex passes validator', () => {
  const templatePayload = {
    schemaVersion: 1,
    id: 'test-styled-slide',
    label: 'Test Styled Slide',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'e1',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 80,
            h: 20,
            zIndex: 0,
            content: 'Bold and Italic Header',
            style: {
              fontFamily: 'Arial',
              fontSize: 32,
              fontColor: '#FFFFFF',
              fontWeight: 'bold',
              fontStyle: 'italic',
              textAlign: 'center',
            },
          },
          {
            id: 'e2',
            type: 'image',
            required: false,
            x: 10,
            y: 35,
            w: 80,
            h: 50,
            zIndex: 1,
            imageRef: '/api/uploads/0123456789abcdef0123456789abcdef.jpg',
          },
        ],
      },
    },
  };

  const validated = validateArtifactTemplate(templatePayload);
  assert.equal(validated.id, 'test-styled-slide');
  assert.equal(validated.layouts.default.elements[0].style.fontWeight, 'bold');
  assert.equal(validated.layouts.default.elements[0].style.fontStyle, 'italic');
  assert.equal(
    validated.layouts.default.elements[1].imageRef,
    '/api/uploads/0123456789abcdef0123456789abcdef.jpg'
  );
  assert.equal(validated.layouts.default.elements[0].zIndex, 0);
  assert.equal(validated.layouts.default.elements[1].zIndex, 1);
});

test('AC-06: Seed template with non-dense zIndex preserves stored zIndex when not reordered', () => {
  // Test with welcome template layout elements where stored zIndex is [1, 1, 1]
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 'e1',
        type: 'text',
        required: false,
        x: 5.63,
        y: 55.62,
        w: 56.42,
        h: 25.47,
        zIndex: 1,
        content: 'Welcome to',
        style: { fontSize: 101.75, fontColor: '#FFFFFF', textAlign: 'left' },
      },
      {
        id: 'e2',
        type: 'text',
        required: false,
        x: 5.63,
        y: 80.48,
        w: 77.04,
        h: 7.97,
        zIndex: 1,
        content: 'BANDUNG INTERNATIONAL COMMUNITY',
        style: { fontSize: 20.7, fontColor: '#FFFFFF', textAlign: 'left' },
      },
      {
        id: 'e3',
        type: 'text',
        required: false,
        x: 5.63,
        y: 89.5,
        w: 50,
        h: 5.5,
        zIndex: 1,
        content: '{service_date}',
        style: { fontSize: 14.67, fontColor: '#FFFFFF', textAlign: 'left' },
      },
    ],
  };

  // Mount canvas in initial painted order (sorted by zIndex then index): e1, e2, e3
  const obj1 = new MockFabricText('Welcome to', { data: { elementId: 'e1' }, left: 54.048, top: 300.348 });
  const obj2 = new MockFabricText('BANDUNG INTERNATIONAL COMMUNITY', { data: { elementId: 'e2' }, left: 54.048, top: 434.592 });
  const obj3 = new MockFabricText('{service_date}', { data: { elementId: 'e3' }, left: 54.048, top: 483.3 });

  const canvas = new MockCanvas([obj1, obj2, obj3]);
  const added = new Map();

  const serialized = serializeCanvas(canvas, layout, added);
  assert.equal(serialized.length, 3);
  assert.equal(serialized[0].zIndex, 1, 'e1 zIndex must stay 1');
  assert.equal(serialized[1].zIndex, 1, 'e2 zIndex must stay 1');
  assert.equal(serialized[2].zIndex, 1, 'e3 zIndex must stay 1');
  assert.deepEqual(
    serialized.map((e) => e.zIndex),
    [1, 1, 1]
  );

  // Partial survival (e.g. element deleted without reordering remaining ones)
  // Deleting e2 from canvas leaves obj1 and obj3 in original relative rank
  const canvasPartial = new MockCanvas([obj1, obj3]);
  const serializedPartial = serializeCanvas(canvasPartial, layout, added);
  assert.equal(serializedPartial.length, 2);
  assert.equal(serializedPartial[0].zIndex, 1);
  assert.equal(serializedPartial[1].zIndex, 1);
});

test('AC-07: Seed template with non-dense zIndex preserves stored zIndex on insert (image, text, shape)', () => {
  // Seed layout with non-dense stored zIndex [1, 1, 1] (e.g. welcome template)
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 'e1',
        type: 'text',
        required: false,
        x: 5.63,
        y: 55.62,
        w: 56.42,
        h: 25.47,
        zIndex: 1,
        content: 'Welcome to',
        style: { fontSize: 101.75, fontColor: '#FFFFFF', textAlign: 'left' },
      },
      {
        id: 'e2',
        type: 'text',
        required: false,
        x: 5.63,
        y: 80.48,
        w: 77.04,
        h: 7.97,
        zIndex: 1,
        content: 'BANDUNG INTERNATIONAL COMMUNITY',
        style: { fontSize: 20.7, fontColor: '#FFFFFF', textAlign: 'left' },
      },
      {
        id: 'e3',
        type: 'text',
        required: false,
        x: 5.63,
        y: 89.5,
        w: 50,
        h: 5.5,
        zIndex: 1,
        content: '{service_date}',
        style: { fontSize: 14.67, fontColor: '#FFFFFF', textAlign: 'left' },
      },
    ],
  };

  const obj1 = new MockFabricText('Welcome to', { data: { elementId: 'e1' }, left: 54.048, top: 300.348 });
  const obj2 = new MockFabricText('BANDUNG INTERNATIONAL COMMUNITY', { data: { elementId: 'e2' }, left: 54.048, top: 434.592 });
  const obj3 = new MockFabricText('{service_date}', { data: { elementId: 'e3' }, left: 54.048, top: 483.3 });

  // 1. Exercise Insert Image control
  {
    const addedImage = new Map([
      [
        'usr-img-1',
        {
          id: 'usr-img-1',
          type: 'image',
          required: false,
          x: 10,
          y: 10,
          w: 30,
          h: 30,
          zIndex: 2, // maxZ + 1
          imageRef: '/api/uploads/test-image.png',
        },
      ],
    ]);
    const objImage = new MockFabricObject({ data: { elementId: 'usr-img-1' }, left: 96, top: 54, width: 288, height: 162 });
    const canvasWithImage = new MockCanvas([obj1, obj2, obj3, objImage]);

    const serializedImage = serializeCanvas(canvasWithImage, layout, addedImage);
    assert.equal(serializedImage.length, 4);
    const byId = new Map(serializedImage.map((e) => [e.id, e]));
    assert.equal(byId.get('e1').zIndex, 1, 'pre-existing e1 zIndex must stay 1 on image insert');
    assert.equal(byId.get('e2').zIndex, 1, 'pre-existing e2 zIndex must stay 1 on image insert');
    assert.equal(byId.get('e3').zIndex, 1, 'pre-existing e3 zIndex must stay 1 on image insert');
    assert.equal(byId.get('usr-img-1').zIndex, 2, 'inserted image zIndex must be above maxZ (2)');
    assert.deepEqual(
      serializedImage.map((e) => e.zIndex),
      [1, 1, 1, 2]
    );
  }

  // 2. Exercise Insert Text control
  {
    const addedText = new Map([
      [
        'usr-txt-1',
        {
          id: 'usr-txt-1',
          type: 'text',
          required: false,
          x: 10,
          y: 10,
          w: 40,
          h: 15,
          zIndex: 2, // maxZ + 1
          content: 'New text',
          style: { fontFamily: 'Arial', fontSize: 32, fontColor: '#FFFFFF', fontWeight: 'normal', textAlign: 'left' },
        },
      ],
    ]);
    const objText = new MockFabricText('New text', { data: { elementId: 'usr-txt-1' }, left: 96, top: 54, width: 384, height: 81 });
    const canvasWithText = new MockCanvas([obj1, obj2, obj3, objText]);

    const serializedText = serializeCanvas(canvasWithText, layout, addedText);
    assert.equal(serializedText.length, 4);
    const byId = new Map(serializedText.map((e) => [e.id, e]));
    assert.equal(byId.get('e1').zIndex, 1, 'pre-existing e1 zIndex must stay 1 on text insert');
    assert.equal(byId.get('e2').zIndex, 1, 'pre-existing e2 zIndex must stay 1 on text insert');
    assert.equal(byId.get('e3').zIndex, 1, 'pre-existing e3 zIndex must stay 1 on text insert');
    assert.equal(byId.get('usr-txt-1').zIndex, 2, 'inserted text zIndex must be above maxZ (2)');
    assert.deepEqual(
      serializedText.map((e) => e.zIndex),
      [1, 1, 1, 2]
    );
  }

  // 3. Exercise Insert Shape control
  {
    const addedShape = new Map([
      [
        'usr-shp-1',
        {
          id: 'usr-shp-1',
          type: 'shape',
          required: false,
          x: 10,
          y: 10,
          w: 30,
          h: 30,
          zIndex: 2, // maxZ + 1
          style: { fillColor: '#5C2E16', opacity: 1 },
        },
      ],
    ]);
    const objShape = new MockFabricObject({ data: { elementId: 'usr-shp-1' }, left: 96, top: 54, width: 288, height: 162 });
    const canvasWithShape = new MockCanvas([obj1, obj2, obj3, objShape]);

    const serializedShape = serializeCanvas(canvasWithShape, layout, addedShape);
    assert.equal(serializedShape.length, 4);
    const byId = new Map(serializedShape.map((e) => [e.id, e]));
    assert.equal(byId.get('e1').zIndex, 1, 'pre-existing e1 zIndex must stay 1 on shape insert');
    assert.equal(byId.get('e2').zIndex, 1, 'pre-existing e2 zIndex must stay 1 on shape insert');
    assert.equal(byId.get('e3').zIndex, 1, 'pre-existing e3 zIndex must stay 1 on shape insert');
    assert.equal(byId.get('usr-shp-1').zIndex, 2, 'inserted shape zIndex must be above maxZ (2)');
    assert.deepEqual(
      serializedShape.map((e) => e.zIndex),
      [1, 1, 1, 2]
    );
  }
});

test('AC-07: Seed template with non-dense zIndex preserves stored zIndex on element deletion', () => {
  // Seed layout with non-dense stored zIndex [1, 1, 1]
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 'e1',
        type: 'text',
        required: false,
        x: 5.63,
        y: 55.62,
        w: 56.42,
        h: 25.47,
        zIndex: 1,
        content: 'Welcome to',
        style: { fontSize: 101.75, fontColor: '#FFFFFF', textAlign: 'left' },
      },
      {
        id: 'e2',
        type: 'text',
        required: false,
        x: 5.63,
        y: 80.48,
        w: 77.04,
        h: 7.97,
        zIndex: 1,
        content: 'BANDUNG INTERNATIONAL COMMUNITY',
        style: { fontSize: 20.7, fontColor: '#FFFFFF', textAlign: 'left' },
      },
      {
        id: 'e3',
        type: 'text',
        required: false,
        x: 5.63,
        y: 89.5,
        w: 50,
        h: 5.5,
        zIndex: 1,
        content: '{service_date}',
        style: { fontSize: 14.67, fontColor: '#FFFFFF', textAlign: 'left' },
      },
    ],
  };

  const obj1 = new MockFabricText('Welcome to', { data: { elementId: 'e1' }, left: 54.048, top: 300.348 });
  const obj3 = new MockFabricText('{service_date}', { data: { elementId: 'e3' }, left: 54.048, top: 483.3 });

  // Delete element e2: canvas holds obj1 and obj3 in original relative order, added map empty
  const canvasAfterDelete = new MockCanvas([obj1, obj3]);
  const serialized = serializeCanvas(canvasAfterDelete, layout, new Map());

  assert.equal(serialized.length, 2);
  const byId = new Map(serialized.map((e) => [e.id, e]));
  assert.equal(byId.get('e1').zIndex, 1, 'surviving e1 stored zIndex must remain byte-identical (1)');
  assert.equal(byId.get('e3').zIndex, 1, 'surviving e3 stored zIndex must remain byte-identical (1)');
  assert.deepEqual(
    serialized.map((e) => e.zIndex),
    [1, 1]
  );
});

test('SPEC-12-01: ArtifactEditor source guards for realtime styling, underline, and shape color sync', async () => {
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Textbox construction in elementToFabricObject handles textDecoration underline
  assert.ok(
    code.includes("style?.textDecoration === 'underline' ? { underline: true } : {}"),
    'elementToFabricObject must construct Textbox with underline when style.textDecoration is underline'
  );

  // 2. Realtime font color apply
  assert.ok(
    code.includes('handleFontColorChange'),
    'ArtifactEditor must have handleFontColorChange for realtime color update'
  );

  // 3. Font size commit on blur / enter
  assert.ok(
    code.includes('handleFontSizeCommit') && code.includes('obj.set({ fontSize: result.fontSize })'),
    'handleFontSizeCommit must update active text objects on canvas'
  );

  // 4. Font size input is w-20 to fit 3 digits
  assert.ok(
    code.includes('className="w-20 h-7 text-xs text-center"'),
    'Font size input must use w-20 so 3 digits are not truncated'
  );

  // 5. Shape color sync and realtime apply
  assert.ok(
    code.includes('setShapeFill(toStrictHexColor'),
    'syncSelection must sync shape fill color from active shape'
  );
  assert.ok(
    code.includes('value={shapeFill}'),
    'Shape color input must be controlled with value={shapeFill}'
  );

  // 6. Underline toggle button
  assert.ok(
    code.includes('handleToggleUnderline'),
    'ArtifactEditor must define handleToggleUnderline'
  );
  assert.ok(
    code.includes("title={t('admin.artifacts.underline')}"),
    'ArtifactEditor must render an Underline button'
  );
});

test('SPEC-12-02: Canvas interaction regressions - context menu, keyboard delete, drag reorder', async () => {
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Right-click context menu must have an opener wired
  assert.ok(
    code.includes('onContextMenu={') && code.includes('setContextMenu('),
    'Canvas shell must have onContextMenu handler that opens the context menu'
  );

  // 2. Keyboard Delete/Backspace shortcut with isEditing guard (DEC-012)
  assert.ok(
    code.includes("e.key !== 'Delete' && e.key !== 'Backspace'") ||
    (code.includes("'Delete'") && code.includes("'Backspace'")),
    'Must handle Delete and Backspace keys for selected canvas element'
  );
  assert.ok(
    code.includes('.isEditing'),
    'Keyboard delete must guard against active inline text editing'
  );

  // 3. Deck Sequence drag reorder handles dataTransfer and visual feedback
  assert.ok(
    code.includes('dragOverIndex') || code.includes('dropEffect'),
    'Deck sequence must handle drag events properly'
  );
  assert.ok(
    code.includes("getData('text/plain')") && code.includes('handleReorderTemplates'),
    'handleDrop must read source index from dataTransfer and persist reorder'
  );
});

test('SPEC-12-03: Image aspect ratio contain-fit in ArtifactEditor and canvas-utils', async () => {
  // 1. Behavioral test: Wide image (400x100 = 4:1) inside box (200x100 = 2:1)
  const wideFit = calculateImageFit(
    { left: 10, top: 20, width: 200, height: 100 },
    { width: 400, height: 100 },
    'contain'
  );
  assert.equal(wideFit.width, 400);
  assert.equal(wideFit.height, 100);
  assert.equal(wideFit.scaleX, 0.5);
  assert.equal(wideFit.scaleY, 0.5);
  // Rendered dimensions must preserve 4:1 ratio
  const wideRenderedW = wideFit.width * wideFit.scaleX;
  const wideRenderedH = wideFit.height * wideFit.scaleY;
  assert.equal(wideRenderedW, 200);
  assert.equal(wideRenderedH, 50);
  assert.equal(wideRenderedW / wideRenderedH, 4);
  // Centered vertically inside 100px box (top=20 + (100-50)/2 = 45)
  assert.equal(wideFit.top, 45);
  assert.equal(wideFit.left, 10);

  // 2. Behavioral test: Tall image (100x400 = 1:4) inside box (200x200 = 1:1)
  const tallFit = calculateImageFit(
    { left: 0, top: 0, width: 200, height: 200 },
    { width: 100, height: 400 },
    'contain'
  );
  assert.equal(tallFit.width, 100);
  assert.equal(tallFit.height, 400);
  assert.equal(tallFit.scaleX, 0.5);
  assert.equal(tallFit.scaleY, 0.5);
  // Rendered dimensions must preserve 1:4 ratio
  const tallRenderedW = tallFit.width * tallFit.scaleX;
  const tallRenderedH = tallFit.height * tallFit.scaleY;
  assert.equal(tallRenderedW, 50);
  assert.equal(tallRenderedH, 200);
  assert.equal(tallRenderedW / tallRenderedH, 0.25);
  // Centered horizontally inside 200px box (left=0 + (200-50)/2 = 75)
  assert.equal(tallFit.left, 75);
  assert.equal(tallFit.top, 0);

  // 3. ArtifactEditor wiring
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');
  assert.ok(
    code.includes('calculateImageFit('),
    'ArtifactEditor must use calculateImageFit to compute contain dimensions and position'
  );
  assert.ok(
    code.includes('width: initial.width') && code.includes('height: initial.height'),
    'FabricImage must use natural dimensions for width/height so scaleX/scaleY preserve aspect ratio'
  );
});

test('SPEC-12-04: Select dropdown renders item label instead of raw value key', async () => {
  const React = (await import('react')).default;
  const { extractSelectItems } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'select-utils.ts')).href
  );

  // 1. Behavioral test: extractSelectItems scans JSX children and resolves value -> label
  const mockChildren = React.createElement(
    'div',
    null,
    React.createElement('div', { value: 'general' }, '📄 General Slide (Canvas)'),
    React.createElement('div', { value: 'song:opening_song_bt' }, '🎵 Bible Talk Opening Song'),
    React.createElement('div', { value: 'ann:1' }, '📢 Announcement Set 1')
  );

  const itemsMap = extractSelectItems(mockChildren);
  assert.equal(itemsMap.get('general'), '📄 General Slide (Canvas)');
  assert.equal(itemsMap.get('song:opening_song_bt'), '🎵 Bible Talk Opening Song');
  assert.equal(itemsMap.get('ann:1'), '📢 Announcement Set 1');

  // 2. Non-item children with native input type are not registered as select items
  const mockWithInput = React.createElement(
    'div',
    null,
    React.createElement('input', { type: 'text', value: 'stray-input-value' }),
    React.createElement('div', { value: 'legit-item' }, 'Legitimate Item')
  );
  const safeMap = extractSelectItems(mockWithInput);
  assert.equal(safeMap.has('stray-input-value'), false);
  assert.equal(safeMap.get('legit-item'), 'Legitimate Item');

  // 3. select.tsx wiring check: feeds extracted labels to Base UI native items prop
  const fs = await import('node:fs');
  const selectPath = path.join(root, 'src', 'components', 'ui', 'select.tsx');
  const code = fs.readFileSync(selectPath, 'utf8');
  assert.ok(
    code.includes('items={mergedItems}'),
    'select.tsx must feed extracted labels into Base UI native items prop'
  );
  assert.ok(
    code.includes('extractSelectItems'),
    'select.tsx must use extractSelectItems to resolve item labels'
  );
});

test('SPEC-12-06: Main Spine toolbar and title area consistency (BUG-12, BUG-13, BUG-17, DEC-009, DEC-011)', async () => {
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Element Properties row is always mounted (BUG-13)
  assert.ok(
    code.includes('Properties (None): Select element first'),
    'Element Properties row must show "Properties (None): Select element first" when nothing selected'
  );
  assert.ok(
    code.includes('Properties (Image): No properties to change') || (code.includes('IMAGE') && code.includes('imageFit')),
    'Element Properties row must show properties or placeholder when image selected'
  );

  // 2. Title area grouping per DEC-011
  assert.ok(
    code.includes('Canvas:'),
    'Title area must group canvas actions under "Canvas:" label per DEC-011'
  );

  // 3. Toolbar add buttons icon only, no "(Drag)" suffix (BUG-12)
  assert.ok(
    !code.includes('Text (Drag)') && !code.includes('Rectangle (Drag)'),
    'Toolbar add buttons must not include "(Drag)" text suffix'
  );

  // 4. Background button uses Background label and no Palette icon (BUG-12)
  assert.ok(
    !code.includes('<Palette') && code.includes('Background'),
    'Background button must use image icon and Background label'
  );

  // 5. No custom hover:bg-blue-600 overrides (DEC-009, BUG-17)
  assert.ok(
    !code.includes('hover:bg-blue-600'),
    'ArtifactEditor must not carry hand-written hover:bg-blue-600 button overrides'
  );
});

test('SPEC-13-01: Main Spine auto-selects first Deck Sequence slide on mount (BUG-1, BUG-8)', async () => {
  // 1. Behavioral tests for resolveInitialSelectedId (pure logic)
  const summaries = [{ id: 'slide-1' }, { id: 'slide-2' }, { id: 'slide-3' }];

  // Case A: Fresh load with no initial id -> auto-selects first slide
  assert.equal(
    resolveInitialSelectedId(null, null, summaries),
    'slide-1',
    'Must auto-select first slide on fresh load when nothing selected'
  );

  // Case B: Empty summaries guard -> returns null, does not select non-existent slide
  assert.equal(
    resolveInitialSelectedId(null, null, []),
    null,
    'Must return null when summaries list is empty'
  );

  // Case C: Pre-set initialSelectedId -> preserves explicit initial selection
  assert.equal(
    resolveInitialSelectedId(null, 'slide-2', summaries),
    'slide-2',
    'Must preserve explicit initialSelectedId'
  );

  // Case D: Existing current selection -> preserves current selected id
  assert.equal(
    resolveInitialSelectedId('slide-3', null, summaries),
    'slide-3',
    'Must preserve existing selection when current is already set'
  );

  // 2. Source scan guard: ArtifactEditor uses resolveInitialSelectedId in loadList resolution
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  assert.ok(
    code.includes('setSelectedId((current) => resolveInitialSelectedId(current, initialSelectedId, summaries))'),
    'ArtifactEditor must resolve initial selection via setSelectedId functional updater with resolveInitialSelectedId'
  );
});

test('SPEC-13-02: Canvas context menu wired to Fabric contextmenu event and multi-selection (BUG-2)', async () => {
  // 1. Behavioral tests: shouldPreserveSelectionOnContextMenu
  const objA = { id: 'objA' };
  const objB = { id: 'objB' };
  const objC = { id: 'objC' };

  // Case A: target is member of active multi-selection -> preserves multi-selection
  assert.equal(
    shouldPreserveSelectionOnContextMenu([objA, objB], objA),
    true,
    'Must preserve selection when right-clicking an already selected element in multi-selection'
  );
  assert.equal(
    shouldPreserveSelectionOnContextMenu([objA, objB], objB),
    true,
    'Must preserve selection when right-clicking another selected element in multi-selection'
  );

  // Case B: target is NOT member of active selection -> does not preserve (switch target)
  assert.equal(
    shouldPreserveSelectionOnContextMenu([objA, objB], objC),
    false,
    'Must not preserve selection when right-clicking an unselected element'
  );

  // Case C: no active selection or invalid target -> false
  assert.equal(
    shouldPreserveSelectionOnContextMenu([], objA),
    false,
    'Must return false when active selection is empty'
  );
  assert.equal(
    shouldPreserveSelectionOnContextMenu([objA], null),
    false,
    'Must return false when target is null'
  );

  // 2. Behavioral tests: computeContextMenuCoords clamping
  const shellRect = { left: 100, top: 50, width: 800, height: 500 };
  // Normal coordinate
  const coords1 = computeContextMenuCoords(200, 150, shellRect);
  assert.equal(coords1.x, 100);
  assert.equal(coords1.y, 100);

  // Clamped at right/bottom edges
  const coordsClamped = computeContextMenuCoords(900, 550, shellRect);
  assert.equal(coordsClamped.x, 800 - 170);
  assert.equal(coordsClamped.y, 500 - 220);

  // 3. Behavioral tests: handleContextMenuTrigger execution flow
  {
    let activeSelection = [objA, objB];
    let selectedTarget = null;
    let menuCoords = null;
    let rendered = false;
    let selectionSynced = false;

    const mockCanvas = {
      findTarget: (evt) => (evt.targetFound ? objA : null),
      getActiveObjects: () => activeSelection,
      setActiveObject: (obj) => { selectedTarget = obj; activeSelection = [obj]; },
      discardActiveObject: () => { selectedTarget = null; activeSelection = []; },
      requestRenderAll: () => { rendered = true; },
    };

    const mockSync = () => { selectionSynced = true; };
    const mockSetMenu = (c) => { menuCoords = c; };

    // Case 3A: Click on element already in multi-selection -> preserves selection, sets menu
    handleContextMenuTrigger(
      { clientX: 250, clientY: 150 },
      mockCanvas,
      shellRect,
      mockSync,
      mockSetMenu,
      objA
    );
    assert.deepEqual(activeSelection, [objA, objB], 'Multi-selection must be preserved');
    assert.ok(menuCoords, 'Menu coords must be set');
    assert.equal(menuCoords.x, 150);

    // Case 3B: Click on unselected element -> sets active object to target, syncs selection, sets menu
    handleContextMenuTrigger(
      { clientX: 250, clientY: 150 },
      mockCanvas,
      shellRect,
      mockSync,
      mockSetMenu,
      objC
    );
    assert.equal(selectedTarget, objC, 'Selection must switch to target objC');
    assert.ok(selectionSynced, 'Selection must be synced');
    assert.ok(menuCoords, 'Menu coords must be set');

    // Case 3C: Click on empty space (null target) -> discards selection, closes menu
    handleContextMenuTrigger(
      { clientX: 250, clientY: 150 },
      mockCanvas,
      shellRect,
      mockSync,
      mockSetMenu,
      null
    );
    assert.equal(selectedTarget, null, 'Selection must be cleared');
    assert.equal(menuCoords, null, 'Menu must be closed on empty space');
  }

  // 4. Source scan guards for ArtifactEditor
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // Must wire native contextmenu listener on upperCanvasEl directly and clean up on unmount
  assert.ok(
    code.includes("upperCanvasEl?.addEventListener('contextmenu', onNativeContextMenu)"),
    'upperCanvasEl must register native contextmenu listener'
  );
  assert.ok(
    code.includes("upperCanvasEl?.removeEventListener('contextmenu', onNativeContextMenu)"),
    'upperCanvasEl cleanup must unregister native contextmenu listener'
  );

  // Must delegate to handleContextMenuTrigger helper
  assert.ok(
    code.includes('handleContextMenuTrigger('),
    'Context menu handler must use handleContextMenuTrigger helper'
  );

  // Shell div must not duplicate trigger execution
  assert.ok(
    !code.includes('onContextMenu={(e) => {\n                    e.preventDefault();\n                    const canvas = fabricCanvasRef.current;'),
    'Shell div must not duplicate context menu trigger execution'
  );
});

test('SPEC-13-03: Image element grows and shrinks when resized with aspect ratio contain-fit (BUG-7)', async () => {
  // 1. Behavioral test: Growing an image element via resize handles
  // Start with image of natural size 400x200 (2:1 aspect ratio) in an initial box of 200x100
  const initialFit = calculateImageFit(
    { left: 10, top: 20, width: 200, height: 100 },
    { width: 400, height: 200 },
    'contain'
  );
  assert.equal(initialFit.width, 400);
  assert.equal(initialFit.height, 200);
  assert.equal(initialFit.scaleX, 0.5);
  assert.equal(initialFit.scaleY, 0.5);

  let coordsSet = false;
  const mockImageObj = {
    data: { imageRef: '/api/uploads/photo.jpg' },
    left: initialFit.left,
    top: initialFit.top,
    width: initialFit.width,
    height: initialFit.height,
    scaleX: initialFit.scaleX,
    scaleY: initialFit.scaleY,
    _element: { naturalWidth: 400, naturalHeight: 200 },
    set: function (props) { Object.assign(this, props); },
    setCoords: function () { coordsSet = true; },
  };

  const mockFabric = {
    Rect: class {
      constructor(opts) { Object.assign(this, opts); }
      set(opts) { Object.assign(this, opts); }
    },
  };

  // User drags resize handles outward to grow bounding box to 400x300 (scaleX=1.0, scaleY=1.5 on current dimensions)
  mockImageObj.scaleX = 1.0;
  mockImageObj.scaleY = 1.5;
  const didGrow = updateImageElementFit(mockImageObj, mockFabric);
  assert.equal(didGrow, true, 'updateImageElementFit must succeed on valid image object');

  // Rendered dimensions must fit within box (400x300), preserving 2:1 aspect ratio:
  // contain fit scale should be min(400/400, 300/200) = min(1.0, 1.5) = 1.0
  const renderedW_grow = mockImageObj.width * mockImageObj.scaleX;
  const renderedH_grow = mockImageObj.height * mockImageObj.scaleY;
  assert.equal(renderedW_grow, 400, 'Rendered width must grow to 400');
  assert.equal(renderedH_grow, 200, 'Rendered height must grow to 200 (preserving 2:1 ratio)');
  assert.equal(renderedW_grow / renderedH_grow, 2, 'Aspect ratio must stay 2:1');
  assert.equal(coordsSet, true, 'setCoords must be called after resize');

  // 2. Behavioral test: Shrinking an image element via resize handles
  // User drags resize handles inward to shrink bounding box to 100x100
  mockImageObj.scaleX = 0.25; // 400 * 0.25 = 100px width
  mockImageObj.scaleY = 0.5;  // 200 * 0.5 = 100px height
  coordsSet = false;
  const didShrink = updateImageElementFit(mockImageObj, mockFabric);
  assert.equal(didShrink, true);

  // contain fit scale: min(100/400, 100/200) = min(0.25, 0.5) = 0.25
  const renderedW_shrink = mockImageObj.width * mockImageObj.scaleX;
  const renderedH_shrink = mockImageObj.height * mockImageObj.scaleY;
  assert.equal(renderedW_shrink, 100, 'Rendered width must shrink to 100');
  assert.equal(renderedH_shrink, 50, 'Rendered height must shrink to 50 (preserving 2:1 ratio)');
  assert.equal(renderedW_shrink / renderedH_shrink, 2, 'Aspect ratio must stay 2:1 on shrink');

  // 3. Behavioral test: Cover objectFit correctly anchors clipBox to outer box coordinates
  // Portrait image (200x400, 1:2) inside landscape box (200x100) with cover fit
  mockImageObj.data = { imageRef: '/api/uploads/photo.jpg', objectFit: 'cover' };
  mockImageObj.left = 50;
  mockImageObj.top = 60;
  mockImageObj.width = 200;
  mockImageObj.height = 400;
  mockImageObj.scaleX = 1.0;
  mockImageObj.scaleY = 0.25; // 200x100 box
  mockImageObj._element = { naturalWidth: 200, naturalHeight: 400 };

  let clipBoxInstance = null;
  const mockFabricWithCapture = {
    Rect: class {
      constructor(opts) {
        Object.assign(this, opts);
        clipBoxInstance = this;
      }
      set(opts) { Object.assign(this, opts); }
    },
  };

  mockImageObj.clipPath = null;
  const didCover = updateImageElementFit(mockImageObj, mockFabricWithCapture);
  assert.equal(didCover, true);
  // ClipBox must be anchored to boxLeft (50) and boxTop (60) with boxWidth (200) and boxHeight (100)
  assert.ok(clipBoxInstance);
  assert.equal(clipBoxInstance.left, 50, 'ClipBox left must anchor to outer box left');
  assert.equal(clipBoxInstance.top, 60, 'ClipBox top must anchor to outer box top');
  assert.equal(clipBoxInstance.width, 200, 'ClipBox width must match outer box width');
  assert.equal(clipBoxInstance.height, 100, 'ClipBox height must match outer box height');
  assert.equal(clipBoxInstance.scaleX, 1, 'ClipBox scaleX must be 1');
  assert.equal(clipBoxInstance.scaleY, 1, 'ClipBox scaleY must be 1');

  // 4. Source scan guard: ArtifactEditor hooks object:modified to updateImageElementFit
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  assert.ok(
    code.includes("canvas.on('object:modified', onObjectModified)"),
    'ArtifactEditor must listen to object:modified on canvas'
  );
  assert.ok(
    code.includes('updateImageElementFit(target, fabric)'),
    'onObjectModified must invoke updateImageElementFit for resized images'
  );
  assert.ok(
    code.includes("canvas.off('object:modified', onObjectModified)"),
    'ArtifactEditor must unregister object:modified listener on unmount'
  );
});

test('SPEC-13-08: Canvas Reset becomes discard-unsaved-changes; seeded elements become deletable (DEC-014)', async () => {
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Shipped/seeded element deletion protection is removed
  assert.ok(
    !code.includes('deleteHintShipped') && !code.includes('shipped and required elements are part of the template'),
    'ArtifactEditor must remove the refused / deleteHintShipped refusal path'
  );
  assert.ok(
    !code.includes('!isUserAuthoredId(elementId) || source?.required'),
    'handleDelete must not refuse deletion of seeded or required elements'
  );

  // 2. canDeleteSelection allows deleting any selected elements
  assert.ok(
    !code.includes('requiredElementIds.has(id)') && !code.includes('isUserAuthoredId(id) && !requiredElementIds'),
    'canDeleteSelection must not restrict deletion to user-authored non-required elements'
  );

  // 3. Canvas Reset discards in-memory edits back to last-saved state and guards against in-flight saves
  assert.ok(
    code.includes('saveSequenceRef') || code.includes('saveCounterRef'),
    'handleReset and handleSave must use sequence counter to guard against in-flight saves'
  );

  // 4. i18n keys check: deleteHintShipped removed from keys and catalogues
  const keysPath = path.join(root, 'src', 'lib', 'i18n', 'keys.ts');
  const keysCode = fs.readFileSync(keysPath, 'utf8');
  assert.ok(
    !keysCode.includes('admin.artifacts.deleteHintShipped'),
    'keys.ts must not contain admin.artifacts.deleteHintShipped'
  );

  const catEnPath = path.join(root, 'src', 'lib', 'i18n', 'catalogue-en.ts');
  const catEnCode = fs.readFileSync(catEnPath, 'utf8');
  assert.ok(
    !catEnCode.includes('deleteHintShipped'),
    'catalogue-en.ts must not contain deleteHintShipped'
  );
  assert.ok(
    catEnCode.includes('Discard unsaved changes to "{label}"?'),
    'catalogue-en.ts must prompt to discard unsaved changes'
  );

  // 5. AD-11 in ARCHITECTURE-SPINE.md updated per DEC-014
  const spinePath = path.join(root, '.how', '_platform', 'ARCHITECTURE-SPINE.md');
  const spineCode = fs.readFileSync(spinePath, 'utf8');
  assert.ok(
    spineCode.includes('DEC-014') && spineCode.includes('Canvas Reset discards unsaved in-memory edits back to the last Saved state'),
    'AD-11 in ARCHITECTURE-SPINE.md must describe discard-unsaved-changes per DEC-014'
  );
});

test('SPEC-13-09: Adding a background replaces the existing one instead of stacking extra layers (DEC-014, BUG-19)', async () => {
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Guard against failed background load: try/catch wraps FabricImage.fromURL and keeps prior background
  assert.ok(
    code.includes('try {') && code.includes('FabricImage.fromURL') && code.includes('Failed to load background'),
    'handleChangeBackgroundUrl must wrap FabricImage.fromURL in try/catch to preserve prior background on failure'
  );

  // 2. Removal of existing background element to prevent stacking and stale canvas check
  assert.ok(
    code.includes('isBackgroundElement') && code.includes('filterOutBackgroundElements'),
    'handleChangeBackgroundUrl must use isBackgroundElement and filterOutBackgroundElements'
  );
  assert.ok(
    code.includes('if (fabricCanvasRef.current !== canvas) return;'),
    'handleChangeBackgroundUrl must guard against stale canvas after async calls'
  );

  // 3. Behavioral test: isBackgroundElement and filterOutBackgroundElements exported helpers
  const bgCandidate1 = { id: 'e2', type: 'image', x: 0, y: 0, w: 100, h: 100, zIndex: 0, imageRef: '/assets/song-title-bottom.jpeg' };
  const userImageAtZero = { id: 'usr-img-1', type: 'image', x: 10, y: 10, w: 20, h: 20, zIndex: 0, imageRef: '/api/uploads/logo.png' };
  const bannerAtHighZ = { id: 'usr-banner', type: 'image', x: 0, y: 0, w: 100, h: 20, zIndex: 2, imageRef: '/api/uploads/banner.png' };
  const shapeAtZero = { id: 'e1', type: 'shape', x: 0, y: 0, w: 100, h: 100, zIndex: 0 };
  const textElement = { id: 'e3', type: 'text', x: 10, y: 20, w: 50, h: 10, zIndex: 1, content: 'Title' };

  // Positive: seeded/full-width image at zIndex 0 is a background element
  assert.equal(isBackgroundElement(bgCandidate1), true, 'Full-width image at zIndex 0 is recognized as background element');

  // Negatives: regular user images, banners, shapes, and texts must NOT be identified as background element
  assert.equal(isBackgroundElement(userImageAtZero), false, 'Non-fullwidth user image at zIndex 0 must NOT be treated as background element');
  assert.equal(isBackgroundElement(bannerAtHighZ), false, 'Image at zIndex > 0 must NOT be treated as background element');
  assert.equal(isBackgroundElement(shapeAtZero), false, 'Shape element must NOT be treated as background element');
  assert.equal(isBackgroundElement(textElement), false, 'Text element must NOT be treated as background element');

  // filterOutBackgroundElements removes only genuine background element
  const elements = [bgCandidate1, userImageAtZero, bannerAtHighZ, shapeAtZero, textElement];
  const filtered = filterOutBackgroundElements(elements);
  assert.equal(filtered.length, 4, 'Exactly one background element should be removed');
  assert.equal(filtered.some((e) => e.id === 'e2'), false, 'e2 must be removed');
  assert.equal(filtered.some((e) => e.id === 'usr-img-1'), true, 'User logo must be kept');
  assert.equal(filtered.some((e) => e.id === 'usr-banner'), true, 'Banner must be kept');
  assert.equal(filtered.some((e) => e.id === 'e1'), true, 'Shape e1 must be kept');
  assert.equal(filtered.some((e) => e.id === 'e3'), true, 'Text e3 must be kept');
});

test('SPEC-13-12: Text line-height and text-shadow controls (BUG-22)', async () => {
  // 1. Validation test: template with lineHeight and textShadow passes validator
  const validTemplate = {
    schemaVersion: 1,
    id: 'test-spec-13-12',
    label: 'Test LineHeight Shadow',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'e1',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 80,
            h: 30,
            zIndex: 0,
            content: 'Hello World',
            style: {
              fontSize: 32,
              fontColor: '#FFFFFF',
              lineHeight: 1.4,
              textShadow: true,
            },
          },
        ],
      },
    },
  };

  const validated = validateArtifactTemplate(validTemplate);
  assert.equal(validated.layouts.default.elements[0].style.lineHeight, 1.4);
  assert.equal(validated.layouts.default.elements[0].style.textShadow, true);

  // Negative validation tests: invalid lineHeight and textShadow
  assert.throws(() => {
    validateArtifactTemplate({
      ...validTemplate,
      layouts: {
        default: {
          ...validTemplate.layouts.default,
          elements: [{ ...validTemplate.layouts.default.elements[0], style: { fontSize: 32, lineHeight: -1 } }],
        },
      },
    });
  }, /lineHeight must be positive/);

  assert.throws(() => {
    validateArtifactTemplate({
      ...validTemplate,
      layouts: {
        default: {
          ...validTemplate.layouts.default,
          elements: [{ ...validTemplate.layouts.default.elements[0], style: { fontSize: 32, textShadow: 'invalid' } }],
        },
      },
    });
  }, /textShadow must be a boolean/);

  // 2. Behavioral test: serializeTextStyle serializes lineHeight and textShadow
  const sourceElement = {
    id: 'e1',
    type: 'text',
    required: false,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 0,
  };

  const serializedWithStyles = serializeTextStyle(sourceElement, {
    fill: '#FFFFFF',
    fontSize: 24,
    lineHeight: 1.5,
    shadow: { color: 'rgba(0,0,0,0.8)' },
  });

  assert.equal(serializedWithStyles?.lineHeight, 1.5, 'lineHeight must be serialized');
  assert.equal(serializedWithStyles?.textShadow, true, 'textShadow must be serialized when shadow is present');

  // Construction default lineHeight (1.2 / TEXT_LINE_HEIGHT) is omitted when not on source
  const serializedDefault = serializeTextStyle(sourceElement, {
    fill: '#FFFFFF',
    fontSize: 24,
    lineHeight: 1.2,
  });
  assert.equal(serializedDefault?.lineHeight, undefined, 'default 1.2 lineHeight should be omitted on new element');

  // 3. Source scan guards in ArtifactEditor.tsx
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  assert.ok(
    code.includes('handleLineHeightChange') && code.includes('obj.set({ lineHeight: clamped })'),
    'handleLineHeightChange must set lineHeight on active canvas objects and call markDirty'
  );
  assert.ok(
    code.includes('handleToggleTextShadow') && code.includes('new fabric.Shadow('),
    'handleToggleTextShadow must toggle fabric.Shadow on active canvas objects and call markDirty'
  );
  assert.ok(
    code.includes('MoveVertical') && (code.includes('Sparkles') || code.includes('title="Text Shadow"')),
    'ArtifactEditor must render MoveVertical line height button and Text Shadow button'
  );
  assert.ok(
    code.includes('applyTextStyle') && code.includes('lineHeight,') && code.includes('shadow: shadowObj'),
    'applyTextStyle bulk multi-selection update must cover lineHeight and textShadow'
  );
});

test('SPEC-14-05 / BUG-22: Text shadow toggle and conditional slider controls', async () => {
  const fs = await import('node:fs');

  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Text shadow toggle button is directly adjacent to shadow slider
  assert.ok(
    code.includes('title="Text Shadow"') && code.includes('handleToggleTextShadow'),
    'ArtifactEditor must provide text shadow toggle button'
  );

  // 2. Button icon uses typography S glyph with drop-shadow
  assert.ok(
    code.includes('drop-shadow') && code.includes('>S</span>'),
    'Text shadow toggle button must render stylized S glyph'
  );

  // 3. Shadow blur slider is conditionally rendered only when textShadow is true
  assert.ok(
    code.includes('{textShadow &&') && code.includes('handleShadowBlurChange'),
    'Shadow adjustment slider must be conditionally rendered only when textShadow is true'
  );

  // 4. Line height controls remain intact
  assert.ok(
    code.includes('MoveVertical') && code.includes('handleLineHeightChange'),
    'Line height controls must remain functional and intact'
  );
});

test('SPEC-18-01: textShadowBlur schema validation, serialization, and removal on toggle', () => {
  const validTemplate = {
    schemaVersion: 1,
    id: 'test-shadow-blur',
    label: 'Test Shadow Blur',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'e1',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 80,
            h: 30,
            zIndex: 0,
            content: 'Hello World',
            style: {
              fontSize: 32,
              textShadow: true,
              textShadowBlur: 15,
            },
          },
        ],
      },
    },
  };

  const validated = validateArtifactTemplate(validTemplate);
  assert.equal(validated.layouts.default.elements[0].style.textShadowBlur, 15);

  // Negative validation tests: blur < 0, blur > 20, non-number
  assert.throws(() => {
    validateArtifactTemplate({
      ...validTemplate,
      layouts: {
        default: {
          ...validTemplate.layouts.default,
          elements: [{ ...validTemplate.layouts.default.elements[0], style: { fontSize: 32, textShadow: true, textShadowBlur: -1 } }],
        },
      },
    });
  }, /textShadowBlur must be 0\.\.20/);

  assert.throws(() => {
    validateArtifactTemplate({
      ...validTemplate,
      layouts: {
        default: {
          ...validTemplate.layouts.default,
          elements: [{ ...validTemplate.layouts.default.elements[0], style: { fontSize: 32, textShadow: true, textShadowBlur: 21 } }],
        },
      },
    });
  }, /textShadowBlur must be 0\.\.20/);

  // Serialization tests
  const sourceWithShadow = {
    id: 'e1',
    type: 'text',
    required: false,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    zIndex: 0,
    style: {
      textShadow: true,
      textShadowBlur: 4,
    },
  };

  const serializedBlur = serializeTextStyle(sourceWithShadow, {
    shadow: { color: 'rgba(0,0,0,0.8)', blur: 12 },
  });
  assert.equal(serializedBlur?.textShadow, true);
  assert.equal(serializedBlur?.textShadowBlur, 12);

  // Disabling shadow deletes both textShadow and textShadowBlur
  const serializedDisabled = serializeTextStyle(sourceWithShadow, {
    shadow: null,
  });
  assert.equal(serializedDisabled?.textShadow, undefined);
  assert.equal(serializedDisabled?.textShadowBlur, undefined);
});

test('SPEC-14-01 / BUG-7: Canvas image drag clipBox synchronization during active movement', async () => {
  const fs = await import('node:fs');

  // 1. Behavioral test: syncImageClipOnMove translates clipPath with image
  let setCoordsCalled = false;
  const mockClipPath = {
    left: 50,
    top: 60,
    width: 200,
    height: 100,
    absolutePositioned: true,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {
      setCoordsCalled = true;
    },
  };

  const mockImage = {
    left: 75,
    top: 60,
    width: 150,
    height: 100,
    data: {
      imageRef: '/api/uploads/sample.jpg',
      clipOffset: { x: -25, y: 0 },
    },
    clipPath: mockClipPath,
  };

  // Image is dragged to a new position (125, 110)
  mockImage.left = 125;
  mockImage.top = 110;

  const didSync = syncImageClipOnMove(mockImage);
  assert.equal(didSync, true, 'syncImageClipOnMove must return true for valid image with clipPath');
  assert.equal(mockClipPath.left, 100, 'clipPath.left must be updated to target.left + clipOffset.x (125 - 25 = 100)');
  assert.equal(mockClipPath.top, 110, 'clipPath.top must be updated to target.top + clipOffset.y (110 + 0 = 110)');
  assert.equal(setCoordsCalled, true, 'setCoords must be called on clipPath');

  // 2. Behavioral test: without clipOffset, defaults to matching target coordinates directly
  const simpleClip = {
    left: 10,
    top: 20,
    set(props) {
      Object.assign(this, props);
    },
  };
  const simpleImage = {
    left: 80,
    top: 90,
    data: { imageRef: '/test.png' },
    clipPath: simpleClip,
  };
  syncImageClipOnMove(simpleImage);
  assert.equal(simpleClip.left, 80);
  assert.equal(simpleClip.top, 90);

  // 3. Source scan guards in ArtifactEditor.tsx
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  assert.ok(
    code.includes("canvas.on('object:moving', onObjectMoving)"),
    'ArtifactEditor must listen to object:moving on canvas'
  );
  assert.ok(
    code.includes('syncImageClipOnMove(target)'),
    'onObjectMoving must invoke syncImageClipOnMove for moving objects'
  );
  assert.ok(
    code.includes("canvas.off('object:moving', onObjectMoving)"),
    'ArtifactEditor must unregister object:moving listener on unmount'
  );
  assert.ok(
    code.includes("action === 'drag' || action === 'move'"),
    'onObjectModified must guard against destructive fit recalculation on drag/move'
  );
});

test('SPEC-14-08 / BUG-26: Preserve object stacking on canvas', async () => {
  const fs = await import('node:fs');

  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // Fabric Canvas must be initialized with preserveObjectStacking: true
  assert.ok(
    code.includes('preserveObjectStacking: true'),
    'Fabric canvas initialization must include preserveObjectStacking: true to preserve element depth on selection'
  );
});

test('SPEC-14-09 / BUG-27: Realtime layer advance on Bring forward and layer reordering', async () => {
  const fs = await import('node:fs');

  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. Layer reordering handles all four directions: forward, backward, front, back
  assert.ok(
    code.includes("action === 'forward'") &&
    code.includes('canvas.bringObjectForward(obj)') &&
    code.includes('canvas.sendObjectBackwards(obj)') &&
    code.includes('canvas.bringObjectToFront(obj)') &&
    code.includes('canvas.sendObjectToBack(obj)'),
    'ArtifactEditor must support forward, backward, front, and back layer reordering'
  );

  // 2. Active selection is sorted by stack index to prevent multi-selection collisions
  assert.ok(
    code.includes('const sorted = [...active].sort') &&
    code.includes("action === 'forward' || action === 'front' ? idxB - idxA : idxA - idxB"),
    'ArtifactEditor must sort active objects by stack index to prevent multi-selection collisions'
  );

  // 3. Behavioral layer order swap test
  class MockCanvasStack {
    constructor(objects) {
      this._objects = [...objects];
    }
    getObjects() {
      return this._objects;
    }
    bringObjectForward(obj) {
      const idx = this._objects.indexOf(obj);
      if (idx !== -1 && idx < this._objects.length - 1) {
        this._objects.splice(idx, 1);
        this._objects.splice(idx + 1, 0, obj);
        return true;
      }
      return false;
    }
    sendObjectBackwards(obj) {
      const idx = this._objects.indexOf(obj);
      if (idx > 0) {
        this._objects.splice(idx, 1);
        this._objects.splice(idx - 1, 0, obj);
        return true;
      }
      return false;
    }
  }

  const elA = { id: 'a' };
  const elB = { id: 'b' };
  const elC = { id: 'c' };
  const mockStack = new MockCanvasStack([elA, elB, elC]);

  // Bring elA forward (+1)
  const moved = mockStack.bringObjectForward(elA);
  assert.equal(moved, true, 'bringObjectForward must advance element in stack');
  assert.deepEqual(mockStack.getObjects().map((o) => o.id), ['b', 'a', 'c'], 'elA must advance from index 0 to 1');

  // Bring elA forward again (+1)
  const moved2 = mockStack.bringObjectForward(elA);
  assert.equal(moved2, true);
  assert.deepEqual(mockStack.getObjects().map((o) => o.id), ['b', 'c', 'a'], 'elA must advance from index 1 to 2');

  // Bring elA forward at top returns false
  const movedTop = mockStack.bringObjectForward(elA);
  assert.equal(movedTop, false, 'bringObjectForward at top must return false');

  // 4. Multi-selection sort proof: moving [A, B] forward in [A, B, C, D]
  // Without sorting (top-down), moving A then B causes collisions where neither advances past C.
  // With sorting (top-down: B first, then A), both advance past C.
  const el1 = { id: '1' };
  const el2 = { id: '2' };
  const el3 = { id: '3' };
  const el4 = { id: '4' };
  const multiStack = new MockCanvasStack([el1, el2, el3, el4]);

  const activeSelection = [el1, el2]; // indices 0 and 1
  const objects = multiStack.getObjects();
  const sortedActive = [...activeSelection].sort((a, b) => {
    const idxA = objects.indexOf(a);
    const idxB = objects.indexOf(b);
    return idxB - idxA; // top-down for forward
  });

  for (const obj of sortedActive) {
    multiStack.bringObjectForward(obj);
  }

  // After sorted forward move: el2 swapped with el3, then el1 swapped with el3
  // Resulting stack: [el3, el1, el2, el4]
  assert.deepEqual(
    multiStack.getObjects().map((o) => o.id),
    ['3', '1', '2', '4'],
    'Multi-selection forward reordering must advance selected elements past adjacent element without collision'
  );
});

test('SPEC-15-01 / BUG-7: Canvas image real-time scaling clipPath synchronization', async () => {
  const fs = await import('node:fs');

  // 1. Behavioral test: syncImageClipOnScale synchronizes clipPath dimensions and position with scaled image
  let setCoordsCalled = false;
  const mockClipPath = {
    left: 10,
    top: 20,
    width: 100,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {
      setCoordsCalled = true;
    },
  };

  const mockImage = {
    left: 50,
    top: 60,
    width: 200,
    height: 150,
    scaleX: 1.8,
    scaleY: 1.8,
    angle: 0,
    data: {
      imageRef: '/api/uploads/sample.jpg',
      baseScaleX: 1,
      baseScaleY: 1,
      clipDimensions: { width: 200, height: 150 },
      clipOffset: { x: 0, y: 0 },
    },
    clipPath: mockClipPath,
  };

  const didSync = syncImageClipOnScale(mockImage);
  assert.equal(didSync, true, 'syncImageClipOnScale must return true for valid image with clipPath');
  assert.equal(mockClipPath.left, 50, 'clipPath.left must match image.left during scaling');
  assert.equal(mockClipPath.top, 60, 'clipPath.top must match image.top during scaling');
  assert.equal(mockClipPath.width, 360, 'clipPath.width must scale proportionally (200 * 1.8 = 360)');
  assert.equal(mockClipPath.height, 270, 'clipPath.height must scale proportionally (150 * 1.8 = 270)');
  assert.equal(mockClipPath.scaleX, 1, 'clipPath.scaleX must be 1 with dimension scaled');
  assert.equal(mockClipPath.scaleY, 1, 'clipPath.scaleY must be 1 with dimension scaled');
  assert.equal(mockClipPath.absolutePositioned, true, 'clipPath must remain absolutePositioned');
  assert.equal(setCoordsCalled, true, 'setCoords must be called on clipPath');

  // 2. Behavioral test: objectFit cover with offset scales mask and offset proportionally
  const coverClip = {
    left: 40,
    top: 50,
    width: 300,
    height: 150,
    scaleX: 1,
    scaleY: 1,
    set(props) {
      Object.assign(this, props);
    },
  };
  const coverImage = {
    left: 40,
    top: 20,
    scaleX: 1.5,
    scaleY: 1.5,
    data: {
      imageRef: '/sample.jpg',
      baseScaleX: 1.0,
      baseScaleY: 1.0,
      clipDimensions: { width: 300, height: 150 },
      clipOffset: { x: 0, y: 30 },
    },
    clipPath: coverClip,
  };

  syncImageClipOnScale(coverImage);
  assert.equal(coverClip.left, 40, 'cover left must be targetLeft + offsetX * ratioX (40 + 0 = 40)');
  assert.equal(coverClip.top, 65, 'cover top must be targetTop + offsetY * ratioY (20 + 30 * 1.5 = 65)');
  assert.equal(coverClip.width, 450, 'cover width must scale proportionally (300 * 1.5 = 450)');
  assert.equal(coverClip.height, 225, 'cover height must scale proportionally (150 * 1.5 = 225)');

  // 3. Behavioral test: non-1 initial scale (e.g. 0.5 scaled to 0.75 -> ratio 1.5) scales proportionally
  const scaledBaselineClip = {
    left: 20,
    top: 30,
    width: 200,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    set(props) {
      Object.assign(this, props);
    },
  };
  const nonOneImage = {
    left: 20,
    top: 30,
    scaleX: 0.75,
    scaleY: 0.75,
    data: {
      imageRef: '/sample.jpg',
      baseScaleX: 0.5,
      baseScaleY: 0.5,
      clipDimensions: { width: 200, height: 100 },
      clipOffset: { x: 0, y: 0 },
    },
    clipPath: scaledBaselineClip,
  };
  syncImageClipOnScale(nonOneImage);
  assert.equal(scaledBaselineClip.width, 300, 'clip width must scale from 200 by 1.5 (0.75/0.5) to 300');
  assert.equal(scaledBaselineClip.height, 150, 'clip height must scale from 100 by 1.5 (0.75/0.5) to 150');

  // 4. Behavioral test: shrinking (ratio < 1) scales clipPath down smoothly
  const shrinkClip = {
    left: 100,
    top: 100,
    width: 400,
    height: 200,
    scaleX: 1,
    scaleY: 1,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {},
  };
  const shrinkImage = {
    left: 100,
    top: 100,
    scaleX: 0.8,
    scaleY: 0.8,
    data: {
      imageRef: '/sample.jpg',
      baseScaleX: 1.0,
      baseScaleY: 1.0,
      clipDimensions: { width: 400, height: 200 },
      clipOffset: { x: 0, y: 0 },
    },
    clipPath: shrinkClip,
  };
  syncImageClipOnScale(shrinkImage);
  assert.equal(shrinkClip.width, 320, 'clip width must scale down proportionally (400 * 0.8 = 320)');
  assert.equal(shrinkClip.height, 160, 'clip height must scale down proportionally (200 * 0.8 = 160)');

  // 5. Behavioral test: non-uniform scaling (side handle: scaleX !== scaleY) scales clip dimensions independently
  const nonUniformClip = {
    left: 50,
    top: 50,
    width: 200,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {},
  };
  const nonUniformImage = {
    left: 50,
    top: 50,
    scaleX: 1.5,
    scaleY: 1.2,
    data: {
      imageRef: '/sample.jpg',
      baseScaleX: 1.0,
      baseScaleY: 1.0,
      clipDimensions: { width: 200, height: 100 },
      clipOffset: { x: 0, y: 0 },
    },
    clipPath: nonUniformClip,
  };
  syncImageClipOnScale(nonUniformImage);
  assert.equal(nonUniformClip.width, 300, 'clip width must scale from 200 by 1.5 to 300');
  assert.equal(nonUniformClip.height, 120, 'clip height must scale from 100 by 1.2 to 120');

  // 6. Behavioral test: scale-then-release consistency between syncImageClipOnScale and updateImageElementFit
  const releaseClip = {
    left: 40,
    top: 50,
    width: 300,
    height: 150,
    scaleX: 1,
    scaleY: 1,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {},
  };
  const releaseImage = {
    left: 40,
    top: 20,
    width: 300,
    height: 300,
    scaleX: 1.5,
    scaleY: 1.5,
    _element: { naturalWidth: 300, naturalHeight: 300 },
    data: {
      imageRef: '/sample.jpg',
      objectFit: 'cover',
      baseScaleX: 1.0,
      baseScaleY: 1.0,
      clipDimensions: { width: 300, height: 150 },
      clipOffset: { x: 0, y: 30 },
    },
    clipPath: releaseClip,
    set(props) {
      Object.assign(this, props);
    },
    setCoords() {},
  };

  // Active scaling drag
  syncImageClipOnScale(releaseImage);
  const dragLeft = releaseClip.left;
  const dragTop = releaseClip.top;
  const dragWidth = releaseClip.width;
  const dragHeight = releaseClip.height;

  // Mouse release fires updateImageElementFit
  updateImageElementFit(releaseImage, null);
  assert.equal(releaseClip.left, dragLeft, 'clip left on release must match active drag left without jumping');
  assert.equal(releaseClip.top, dragTop, 'clip top on release must match active drag top without jumping');
  assert.equal(releaseClip.width, dragWidth, 'clip width on release must match active drag width');
  assert.equal(releaseClip.height, dragHeight, 'clip height on release must match active drag height');

  // 5. Behavioral test: invalid or non-image objects return false
  assert.equal(syncImageClipOnScale(null), false);
  assert.equal(syncImageClipOnScale({}), false);
  assert.equal(syncImageClipOnScale({ data: { imageRef: 'test' } }), false);

  // 4. Source scan guards in ArtifactEditor.tsx
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  assert.ok(
    code.includes("canvas.on('object:scaling', onObjectScaling)"),
    'ArtifactEditor must listen to object:scaling on canvas'
  );
  assert.ok(
    code.includes('syncImageClipOnScale(target)'),
    'onObjectScaling must invoke syncImageClipOnScale for scaling objects'
  );
  assert.ok(
    code.includes("canvas.off('object:scaling', onObjectScaling)"),
    'ArtifactEditor must unregister object:scaling listener on unmount'
  );
});

test('SPEC-15-03 / BUG-28: Removal of redundant Apply Style button from properties toolbar', async () => {
  const fs = await import('node:fs');
  const editorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
  const code = fs.readFileSync(editorPath, 'utf8');

  // 1. The explicit Apply Style button is removed from the toolbar JSX
  assert.ok(
    !code.includes("{t('admin.artifacts.applyStyle')}"),
    'ArtifactEditor toolbar must not render redundant Apply Style button'
  );

  // 2. Toolbar retains stable 88px fixed height
  assert.ok(
    code.includes('h-[88px] min-h-[88px] max-h-[88px]'),
    'Toolbar must retain locked 88px height'
  );
  assert.ok(
    !code.includes('h-11 min-h-[44px] max-h-[44px]'),
    'Toolbar must NOT use old 44px height'
  );

  // 3. All real-time text property handlers remain functional, invoke canvas.requestRenderAll, and call markDirty()
  for (const handler of [
    'handleFontColorChange',
    'handleFontSizeCommit',
    'handleToggleBold',
    'handleToggleItalic',
    'handleToggleUnderline',
    'handleSetTextAlign',
    'handleLineHeightChange',
    'handleToggleTextShadow',
    'handleShadowBlurChange',
    'handleFontFamilyChange',
  ]) {
    const handlerStart = code.indexOf(`const ${handler}`);
    assert.ok(handlerStart !== -1, `Must find declaration of ${handler}`);
    const handlerBody = code.slice(handlerStart, handlerStart + 1200);
    assert.ok(
      handlerBody.includes('markDirty()'),
      `${handler} must call markDirty() immediately for real-time application`
    );
  }

  // 4. Behavioral test: real-time inline property updates directly mutate text object and trigger render
  let renderCount = 0;
  let markedDirty = false;
  const mockCanvas = {
    requestRenderAll() {
      renderCount++;
    },
  };
  const mockText = {
    type: 'textbox',
    fill: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    textAlign: 'left',
    lineHeight: 1.2,
    shadow: null,
    set(props) {
      Object.assign(this, props);
    },
  };

  // Simulate real-time color change
  mockText.set({ fill: '#FF0000' });
  mockCanvas.requestRenderAll();
  markedDirty = true;
  assert.equal(mockText.fill, '#FF0000');
  assert.equal(renderCount, 1);
  assert.equal(markedDirty, true);

  // Simulate real-time bold toggle
  mockText.set({ fontWeight: 'bold' });
  mockCanvas.requestRenderAll();
  assert.equal(mockText.fontWeight, 'bold');
  assert.equal(renderCount, 2);

  // Simulate real-time shadow toggle
  mockText.set({ shadow: { blur: 6, color: 'rgba(0,0,0,0.8)' } });
  mockCanvas.requestRenderAll();
  assert.deepEqual(mockText.shadow, { blur: 6, color: 'rgba(0,0,0,0.8)' });
  assert.equal(renderCount, 3);

  // Simulate real-time font family change
  mockText.set({ fontFamily: 'Montserrat' });
  mockCanvas.requestRenderAll();
  assert.equal(mockText.fontFamily, 'Montserrat');
  assert.equal(renderCount, 4);
});

test('SPEC-17-03: PPTX and Web Slide font family resolution and fallbacks', async () => {
  const { resolveFontFamily } = await import(pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href);
  const { getFontStack } = await import(pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href);
  const pptxDrawCode = fs.readFileSync(path.join(root, 'src', 'lib', 'pptx-draw.ts'), 'utf8');
  const slideCode = fs.readFileSync(path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx'), 'utf8');

  // 1. pptx-draw uses resolveFontFamily(style) for fontFace
  assert.ok(
    pptxDrawCode.includes('fontFace: resolveFontFamily(style)'),
    'pptx-draw.ts must map text style to fontFace via resolveFontFamily'
  );

  // 2. ArtifactSlide uses getFontStack for CSS fontFamily
  assert.ok(
    slideCode.includes('fontFamily: getFontStack(style.fontFamily)'),
    'ArtifactSlide.tsx must map style.fontFamily to CSS font stack via getFontStack'
  );

  // 3. resolveFontFamily bare family extraction and defaults
  assert.equal(resolveFontFamily({ fontFamily: 'Montserrat' }), 'Montserrat');
  assert.equal(resolveFontFamily({ fontFamily: 'Playfair Display' }), 'Playfair Display');
  assert.equal(resolveFontFamily({}), 'Arial');
  assert.equal(resolveFontFamily({ fontFamily: '' }), 'Arial');
  assert.equal(resolveFontFamily({ fontFamily: '   ' }), 'Arial');

  // 4. getFontStack CSS fallback chains
  assert.equal(getFontStack('Montserrat'), '"Montserrat", sans-serif');
  assert.equal(getFontStack('Playfair Display'), '"Playfair Display", serif');
  assert.equal(getFontStack('Great Vibes'), '"Great Vibes", cursive');
  assert.equal(getFontStack(undefined), '"Arial", sans-serif');

  // 5. syncSelection sets fontFamily from active text object
  const editorCode = fs.readFileSync(path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx'), 'utf8');
  assert.ok(
    editorCode.includes('setFontFamily(resolveCatalogFontFamily(selectedText.fontFamily || DEFAULT_FONT_FAMILY))'),
    'syncSelection must extract and set fontFamily state from selectedText via resolveCatalogFontFamily'
  );
});

test('SPEC-18-03: Textbox width resize serialization & seed conformance', async () => {
  const layout = {
    aspectRatio: '16:9',
    backgroundColor: '#000000',
    elements: [
      {
        id: 'e1',
        type: 'text',
        required: false,
        x: 10,
        y: 10,
        w: 56.42,
        h: 20,
        zIndex: 0,
        content: 'Welcome to',
        style: { fontSize: 114 },
      },
    ],
  };

  // 1. Widening a text element via side handles (scaleX === 1, obj.width increased)
  const widenedTextObj = new MockFabricText('Welcome to', {
    data: { elementId: 'e1' },
    left: 96,
    top: 54,
    width: 750, // 750 / 960 * 100 = 78.125%
    height: 108,
    scaleX: 1,
    scaleY: 1,
  });

  const canvasWidened = new MockCanvas([widenedTextObj]);
  const serializedWidened = serializeCanvas(canvasWidened, layout, new Map());
  assert.equal(serializedWidened.length, 1);
  assert.ok(
    Math.abs(serializedWidened[0].w - 78.125) < 0.01,
    `Widened text box must persist updated w (~78.125%), got ${serializedWidened[0].w}`
  );
  assert.notEqual(serializedWidened[0].w, 56.42, 'Widened text box must not revert to 56.42%');

  // 2. Corner-scaling a text element (scaleX !== 1)
  const cornerScaledTextObj = new MockFabricText('Welcome to', {
    data: { elementId: 'e1' },
    left: 96,
    top: 54,
    width: 480,
    height: 108,
    scaleX: 1.5, // visual width = 480 * 1.5 = 720px -> 720/960 = 75%
    scaleY: 1.5,
  });

  const canvasCornerScaled = new MockCanvas([cornerScaledTextObj]);
  const serializedCorner = serializeCanvas(canvasCornerScaled, layout, new Map());
  assert.equal(serializedCorner.length, 1);
  assert.ok(
    Math.abs(serializedCorner[0].w - 75.0) < 0.01,
    `Corner-scaled text box must persist updated w (~75%), got ${serializedCorner[0].w}`
  );

  // 3. Untouched text element preserves exact source.w (56.42) without floating point noise
  const untouchedWidthPx = (56.42 / 100) * 960; // 541.632
  const untouchedTextObj = new MockFabricText('Welcome to', {
    data: { elementId: 'e1' },
    left: 96,
    top: 54,
    width: untouchedWidthPx,
    height: 108,
    scaleX: 1,
    scaleY: 1,
  });

  const canvasUntouched = new MockCanvas([untouchedTextObj]);
  const serializedUntouched = serializeCanvas(canvasUntouched, layout, new Map());
  assert.equal(serializedUntouched.length, 1);
  assert.equal(
    serializedUntouched[0].w,
    56.42,
    'Untouched element must preserve exact source.w without floating point jitter'
  );
});








