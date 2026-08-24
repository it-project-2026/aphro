import { LabelBox, MapPoint } from './pdfExportTypes';

/**
 * Detects if two boxes overlap.
 */
export function boxesOverlap(a: LabelBox, b: LabelBox, padding: number = 2): boolean {
  return !(
    a.x + a.width + padding < b.x ||
    b.x + b.width + padding < a.x ||
    a.y + a.height + padding < b.y ||
    b.y + b.height + padding < a.y
  );
}

/**
 * Places labels for a set of points on a canvas-like coordinate system.
 * Uses a heuristic to avoid overlaps.
 */
export function resolveLabelCollisions(
  points: Array<{ x: number, y: number, point: MapPoint }>,
  boxWidth: number,
  boxHeight: number,
  canvasWidth: number,
  canvasHeight: number
): LabelBox[] {
  const labels: LabelBox[] = [];
  const placements: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'right', 'left'];

  // Sort points by y then x to process them in a predictable order (e.g. top to bottom)
  const sortedPoints = [...points].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const pt of sortedPoints) {
    let bestLabel: LabelBox | null = null;
    let minOverlaps = Infinity;

    for (const placement of placements) {
      let x = pt.x;
      let y = pt.y;

      // Adjust based on placement
      switch (placement) {
        case 'top':
          x = pt.x - boxWidth / 2;
          y = pt.y - boxHeight - 15; // 15px leader line
          break;
        case 'bottom':
          x = pt.x - boxWidth / 2;
          y = pt.y + 15;
          break;
        case 'left':
          x = pt.x - boxWidth - 15;
          y = pt.y - boxHeight / 2;
          break;
        case 'right':
          x = pt.x + 15;
          y = pt.y - boxHeight / 2;
          break;
      }

      const candidate: LabelBox = {
        id: pt.point.id,
        x,
        y,
        width: boxWidth,
        height: boxHeight,
        point: pt.point,
        anchorX: pt.x,
        anchorY: pt.y,
        placement
      };

      // Keep within canvas bounds
      if (candidate.x < 5 || candidate.x + boxWidth > canvasWidth - 5 || 
          candidate.y < 5 || candidate.y + boxHeight > canvasHeight - 5) {
        continue;
      }

      // Count overlaps with already placed labels
      let overlapCount = 0;
      for (const placed of labels) {
        if (boxesOverlap(candidate, placed)) {
          overlapCount++;
        }
      }

      if (overlapCount === 0) {
        bestLabel = candidate;
        break; 
      }

      if (overlapCount < minOverlaps) {
        minOverlaps = overlapCount;
        bestLabel = candidate;
      }
    }

    if (bestLabel) {
      labels.push(bestLabel);
    }
  }

  return labels;
}
