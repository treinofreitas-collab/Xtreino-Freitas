function getSize(imageData) {
  const width = Number(imageData?.width);
  const height = Number(imageData?.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Imagem inválida para remoção de fundo.');
  }
  if (!imageData.data || imageData.data.length !== width * height * 4) {
    throw new Error('A imagem precisa estar em formato RGBA.');
  }
  return { width, height, pixelCount: width * height };
}

export function getVisibleAlphaBounds(imageData, alphaThreshold = 8) {
  const { width, height } = getSize(imageData);
  const threshold = Math.min(255, Math.max(0, Number(alphaThreshold) || 0));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (imageData.data[(y * width + x) * 4 + 3] <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return maxX < 0
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function padImageDataToSquare(imageData) {
  const { width, height } = getSize(imageData);
  const size = Math.max(width, height);
  const offsetX = Math.floor((size - width) / 2);
  const offsetY = Math.floor((size - height) / 2);
  const data = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * width * 4;
    const targetOffset = ((y + offsetY) * size + offsetX) * 4;
    data.set(imageData.data.subarray(sourceOffset, sourceOffset + width * 4), targetOffset);
  }

  return { data, width: size, height: size };
}

function averagePatch(data, width, height, startX, startY, patchSize) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let count = 0;
  for (let y = startY; y < Math.min(height, startY + patchSize); y += 1) {
    for (let x = startX; x < Math.min(width, startX + patchSize); x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 16) continue;
      red += data[offset];
      green += data[offset + 1];
      blue += data[offset + 2];
      alpha += data[offset + 3];
      count += 1;
    }
  }
  return count
    ? [red / count, green / count, blue / count, alpha / count]
    : null;
}

function distance(first, second) {
  const red = first[0] - second[0];
  const green = first[1] - second[1];
  const blue = first[2] - second[2];
  return Math.sqrt(red * red + green * green + blue * blue);
}

function median(values) {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function hasTransparentEdgeBackground(imageData) {
  const { width, height } = getSize(imageData);
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const transparentCount = corners.filter(([x, y]) => (
    imageData.data[(y * width + x) * 4 + 3] < 16
  )).length;
  return transparentCount >= 3;
}

export function sampleEdgeBackground(imageData) {
  const { width, height } = getSize(imageData);
  const patchSize = Math.max(1, Math.min(12, Math.floor(Math.min(width, height) / 4)));
  const samples = [
    averagePatch(imageData.data, width, height, 0, 0, patchSize),
    averagePatch(imageData.data, width, height, width - patchSize, 0, patchSize),
    averagePatch(imageData.data, width, height, 0, height - patchSize, patchSize),
    averagePatch(imageData.data, width, height, width - patchSize, height - patchSize, patchSize),
  ].filter(Boolean);
  if (!samples.length) return null;
  const color = [0, 1, 2].map(channel => median(samples.map(sample => sample[channel])));
  const distances = samples.map(sample => distance(sample, color));
  const spread = Math.max(...distances);
  return { color, spread, distances, sampleCount: samples.length };
}

export function hasUniformEdgeBackground(imageData, maxSpread = 44) {
  const sample = sampleEdgeBackground(imageData);
  return hasTransparentEdgeBackground(imageData)
    || Boolean(sample && sample.distances.filter(value => value <= maxSpread).length >= 3);
}

export function removeConnectedEdgeBackground(imageData, tolerance = 42) {
  const { width, height, pixelCount } = getSize(imageData);
  const sample = sampleEdgeBackground(imageData);
  const result = new Uint8ClampedArray(imageData.data);
  if (!sample) return { data: result, width, height, removedCount: 0, backgroundColor: null };

  const threshold = Math.max(0, Number(tolerance) || 0);
  const thresholdSquared = threshold * threshold;
  const visited = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const matchesBackground = pixel => {
    const offset = pixel * 4;
    if (result[offset + 3] < 16) return true;
    const red = result[offset] - sample.color[0];
    const green = result[offset + 1] - sample.color[1];
    const blue = result[offset + 2] - sample.color[2];
    return red * red + green * green + blue * blue <= thresholdSquared;
  };

  const enqueue = pixel => {
    if (visited[pixel] || !matchesBackground(pixel)) return;
    visited[pixel] = 1;
    queue[tail] = pixel;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
    result[pixel * 4 + 3] = 0;
  }

  // Make only the outermost antialiased fringe translucent; enclosed logo
  // details remain untouched because the flood fill starts at image borders.
  const featherThreshold = (threshold + 20) ** 2;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (visited[pixel]) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const touchesRemoved = (x > 0 && visited[pixel - 1])
      || (x + 1 < width && visited[pixel + 1])
      || (y > 0 && visited[pixel - width])
      || (y + 1 < height && visited[pixel + width]);
    if (!touchesRemoved) continue;
    const offset = pixel * 4;
    const red = imageData.data[offset] - sample.color[0];
    const green = imageData.data[offset + 1] - sample.color[1];
    const blue = imageData.data[offset + 2] - sample.color[2];
    const colorDistanceSquared = red * red + green * green + blue * blue;
    if (colorDistanceSquared <= featherThreshold) {
      const colorDistance = Math.sqrt(colorDistanceSquared);
      const alphaFactor = Math.min(1, Math.max(0, (colorDistance - threshold) / 20));
      result[offset + 3] = Math.round(imageData.data[offset + 3] * alphaFactor);
    }
  }

  return {
    data: result,
    width,
    height,
    removedCount: tail,
    backgroundColor: sample.color.map(value => Math.round(value)),
  };
}

export function applyLogoBrush(imageData, sourceImageData, centerX, centerY, radius, mode) {
  const { width, height } = getSize(imageData);
  getSize(sourceImageData);
  if (sourceImageData.width !== width || sourceImageData.height !== height) {
    throw new Error('A imagem original e a prévia precisam ter o mesmo tamanho.');
  }
  if (!['restore', 'erase'].includes(mode)) throw new Error('Ação de pincel inválida.');

  const safeRadius = Math.max(1, Number(radius) || 1);
  const minimumX = Math.max(0, Math.floor(centerX - safeRadius));
  const maximumX = Math.min(width - 1, Math.ceil(centerX + safeRadius));
  const minimumY = Math.max(0, Math.floor(centerY - safeRadius));
  const maximumY = Math.min(height - 1, Math.ceil(centerY + safeRadius));
  const innerRadius = safeRadius * 0.7;

  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
      if (distanceFromCenter > safeRadius) continue;
      const coverage = distanceFromCenter <= innerRadius
        ? 1
        : (safeRadius - distanceFromCenter) / Math.max(1, safeRadius - innerRadius);
      const offset = (y * width + x) * 4;

      if (mode === 'restore') {
        imageData.data[offset] = sourceImageData.data[offset];
        imageData.data[offset + 1] = sourceImageData.data[offset + 1];
        imageData.data[offset + 2] = sourceImageData.data[offset + 2];
        imageData.data[offset + 3] = Math.max(
          imageData.data[offset + 3],
          Math.round(sourceImageData.data[offset + 3] * coverage),
        );
      } else {
        imageData.data[offset + 3] = Math.round(imageData.data[offset + 3] * (1 - coverage));
      }
    }
  }

  return {
    dirtyX: minimumX,
    dirtyY: minimumY,
    dirtyWidth: maximumX - minimumX + 1,
    dirtyHeight: maximumY - minimumY + 1,
  };
}
