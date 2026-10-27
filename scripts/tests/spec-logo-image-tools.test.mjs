import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLogoBrush,
  hasTransparentEdgeBackground,
  hasUniformEdgeBackground,
  padImageDataToSquare,
  removeConnectedEdgeBackground,
} from '../../artifacts/xtreino/public/js/spec-logo-image-tools.mjs';

function createImageData(width, height, color) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3] ?? 255;
  }
  return { data, width, height };
}

function setPixel(imageData, x, y, color) {
  const offset = (y * imageData.width + x) * 4;
  imageData.data.set(color, offset);
}

test('pads a non-square logo into a transparent square without cropping', () => {
  const source = createImageData(2, 4, [12, 34, 56, 255]);
  const square = padImageDataToSquare(source);

  assert.equal(square.width, 4);
  assert.equal(square.height, 4);
  for (let y = 0; y < square.height; y += 1) {
    assert.equal(square.data[(y * square.width) * 4 + 3], 0);
    assert.equal(square.data[(y * square.width + 3) * 4 + 3], 0);
    for (let x = 1; x <= 2; x += 1) {
      const offset = (y * square.width + x) * 4;
      assert.deepEqual([...square.data.slice(offset, offset + 4)], [12, 34, 56, 255]);
    }
  }
});

test('detects a uniform background from the four image edges', () => {
  const image = createImageData(8, 8, [248, 248, 248, 255]);
  assert.equal(hasUniformEdgeBackground(image), true);
  for (const [startX, startY] of [[0, 0], [6, 6]]) {
    for (let y = startY; y < startY + 2; y += 1) {
      for (let x = startX; x < startX + 2; x += 1) {
        setPixel(image, x, y, [0, 0, 0, 255]);
      }
    }
  }
  assert.equal(hasUniformEdgeBackground(image), false);
});

test('does not send an already-transparent logo to the AI path', () => {
  const image = createImageData(8, 8, [40, 80, 120, 255]);
  for (const [x, y] of [[0, 0], [7, 0], [0, 7], [7, 7]]) {
    setPixel(image, x, y, [0, 0, 0, 0]);
  }
  assert.equal(hasTransparentEdgeBackground(image), true);
  assert.equal(hasUniformEdgeBackground(image), true);
});

test('removes only edge-connected background, preserving enclosed logo details', () => {
  const image = createImageData(7, 7, [0, 0, 0, 255]);
  for (let y = 1; y < 6; y += 1) {
    for (let x = 1; x < 6; x += 1) setPixel(image, x, y, [255, 255, 255, 255]);
  }
  setPixel(image, 3, 3, [0, 0, 0, 255]);

  const result = removeConnectedEdgeBackground(image, 0);
  assert.equal(result.data[3], 0);
  assert.equal(result.data[(3 * 7 + 3) * 4 + 3], 255);
  assert.equal(result.removedCount, 24);
});

test('brush restores pixels from the original and erases them again', () => {
  const source = createImageData(5, 5, [210, 20, 30, 255]);
  const preview = createImageData(5, 5, [210, 20, 30, 0]);
  applyLogoBrush(preview, source, 2, 2, 1.5, 'restore');
  const centerOffset = (2 * 5 + 2) * 4;
  assert.equal(preview.data[centerOffset], 210);
  assert.equal(preview.data[centerOffset + 3], 255);

  applyLogoBrush(preview, source, 2, 2, 1.5, 'erase');
  assert.equal(preview.data[centerOffset + 3], 0);
});
