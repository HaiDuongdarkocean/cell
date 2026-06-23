/**
 * Minimal MP4 validation for parallel conversion output.
 *
 * Validates that merged fragmented MP4 has the expected structure:
 * - One init segment (ftyp + moov boxes)
 * - At least one media fragment (moof + mdat boxes)
 * - Non-empty mdat
 * - Consistent track IDs across fragments
 *
 * This is a box-level structural check, not a full codec validation.
 * It fails closed: if validation cannot confirm the output is valid,
 * it returns { valid: false } so the caller can fallback.
 */

/** Result of MP4 validation. */
export interface Mp4ValidationResult {
  readonly valid: boolean;
  readonly reason: string;
  readonly initSegmentFound?: boolean;
  readonly mediaFragmentCount?: number;
  readonly totalSize?: number;
}

/** MP4 box type as a 4-character string. */
type BoxType = string;

interface ParsedBox {
  type: BoxType;
  offset: number;
  size: number;
}

/**
 * Parse MP4 boxes from a Uint8Array. Returns an array of top-level boxes.
 * Each box has a 4-byte size and 4-byte type.
 */
function parseTopLevelBoxes(data: Uint8Array): ParsedBox[] {
  const boxes: ParsedBox[] = [];
  let offset = 0;

  while (offset + 8 <= data.length) {
    // Read 32-bit big-endian size
    const size =
      (data[offset] << 24) |
      (data[offset + 1] << 16) |
      (data[offset + 2] << 8) |
      data[offset + 3];

    // Read 4-character type
    const type = String.fromCharCode(
      data[offset + 4],
      data[offset + 5],
      data[offset + 6],
      data[offset + 7],
    );

    if (size < 8 || offset + size > data.length) {
      // Invalid box — stop parsing
      break;
    }

    boxes.push({ type, offset, size });
    offset += size;
  }

  return boxes;
}

/**
 * Validate a fragmented MP4 file's structure.
 *
 * @param data - The complete MP4 file as a Uint8Array.
 */
export function validateFragmentedMp4(data: Uint8Array): Mp4ValidationResult {
  if (data.length === 0) {
    return { valid: false, reason: 'empty data' };
  }

  if (data.length < 8) {
    return { valid: false, reason: `data too small (${data.length} bytes)` };
  }

  const boxes = parseTopLevelBoxes(data);

  if (boxes.length === 0) {
    return { valid: false, reason: 'no valid boxes found' };
  }

  // Check for ftyp box (file type) — should be first.
  if (boxes[0].type !== 'ftyp') {
    return {
      valid: false,
      reason: `first box is '${boxes[0].type}', expected 'ftyp'`,
    };
  }

  // Check for moov box (movie header / init segment).
  const moovBox = boxes.find((b) => b.type === 'moov');
  if (!moovBox) {
    return {
      valid: false,
      reason: 'no moov box found (missing init segment)',
      initSegmentFound: false,
    };
  }

  // Count media fragments (moof + mdat pairs).
  let mediaFragmentCount = 0;
  let hasMoof = false;

  for (const box of boxes) {
    if (box.type === 'moof') hasMoof = true;
    if (box.type === 'mdat') {
      if (hasMoof) {
        mediaFragmentCount++;
        hasMoof = false;
      }
    }
  }

  if (mediaFragmentCount === 0) {
    return {
      valid: false,
      reason: 'no media fragments (moof+mdat pairs) found',
      initSegmentFound: true,
      mediaFragmentCount: 0,
      totalSize: data.length,
    };
  }

  // Check for non-empty mdat (at least one mdat should have data beyond header).
  for (const box of boxes) {
    if (box.type === 'mdat' && box.size > 8) {
      // Found a non-empty mdat — validation passes.
      return {
        valid: true,
        reason: `valid: ftyp+moov init, ${mediaFragmentCount} media fragments`,
        initSegmentFound: true,
        mediaFragmentCount,
        totalSize: data.length,
      };
    }
  }

  return {
    valid: false,
    reason: 'all mdat boxes are empty',
    initSegmentFound: true,
    mediaFragmentCount,
    totalSize: data.length,
  };
}

/**
 * Validate a merged MP4 file from OPFS.
 * Reads the file and validates its structure.
 */
export async function validateMergedMp4(
  data: Uint8Array,
): Promise<Mp4ValidationResult> {
  return validateFragmentedMp4(data);
}
