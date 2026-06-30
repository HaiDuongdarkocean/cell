import { validateFragmentedMp4 } from '@/features/transmux/merging/mp4Validator';

/**
 * Create a minimal valid fragmented MP4 byte sequence for testing.
 * ftyp + moov + moof + mdat
 */
function makeValidFmp4(mdatDataSize: number = 100): Uint8Array {
  const boxes: Array<{ type: string; data: Uint8Array }> = [];

  // ftyp box (20 bytes: 8 header + 12 body)
  boxes.push({
    type: 'ftyp',
    data: new Uint8Array([
      0x69, 0x73, 0x6f, 0x6d, // major_brand: 'isom'
      0x00, 0x00, 0x02, 0x00, // minor_version: 512
      0x69, 0x73, 0x6f, 0x6d, // compatible_brand: 'isom'
    ]),
  });

  // moov box (minimal — just 8 bytes header, empty body)
  boxes.push({
    type: 'moov',
    data: new Uint8Array(0),
  });

  // moof box (minimal — just 8 bytes header, empty body)
  boxes.push({
    type: 'moof',
    data: new Uint8Array(0),
  });

  // mdat box (8 header + mdatDataSize data)
  boxes.push({
    type: 'mdat',
    data: new Uint8Array(mdatDataSize).fill(0xaa),
  });

  // Serialize
  const totalSize = boxes.reduce((sum, b) => sum + 8 + b.data.length, 0);
  const result = new Uint8Array(totalSize);
  let offset = 0;

  for (const box of boxes) {
    const boxSize = 8 + box.data.length;
    // Write big-endian size
    result[offset] = (boxSize >> 24) & 0xff;
    result[offset + 1] = (boxSize >> 16) & 0xff;
    result[offset + 2] = (boxSize >> 8) & 0xff;
    result[offset + 3] = boxSize & 0xff;
    // Write type
    for (let i = 0; i < 4; i++) {
      result[offset + 4 + i] = box.type.charCodeAt(i);
    }
    // Write data
    result.set(box.data, offset + 8);
    offset += boxSize;
  }

  return result;
}

describe('validateFragmentedMp4', () => {
  it('returns invalid for empty data', () => {
    const result = validateFragmentedMp4(new Uint8Array(0));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('returns invalid for data too small', () => {
    const result = validateFragmentedMp4(new Uint8Array(4));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('too small');
  });

  it('returns invalid when first box is not ftyp', () => {
    // Create data with moov as first box
    const data = new Uint8Array(16);
    data[0] = 0; data[1] = 0; data[2] = 0; data[3] = 16; // size=16
    data[4] = 0x6d; data[5] = 0x6f; data[6] = 0x6f; data[7] = 0x76; // 'moov'
    const result = validateFragmentedMp4(data);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('ftyp');
  });

  it('returns invalid when no moov box found', () => {
    // ftyp only, no moov
    const data = new Uint8Array(20);
    data[0] = 0; data[1] = 0; data[2] = 0; data[3] = 20; // size=20
    data[4] = 0x66; data[5] = 0x74; data[6] = 0x79; data[7] = 0x70; // 'ftyp'
    const result = validateFragmentedMp4(data);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('moov');
    expect(result.initSegmentFound).toBe(false);
  });

  it('returns invalid when no media fragments', () => {
    // ftyp + moov only, no moof/mdat
    const data = new Uint8Array(28);
    // ftyp: size=20
    data[0] = 0; data[1] = 0; data[2] = 0; data[3] = 20;
    data[4] = 0x66; data[5] = 0x74; data[6] = 0x79; data[7] = 0x70; // 'ftyp'
    // moov: size=8
    data[20] = 0; data[21] = 0; data[22] = 0; data[23] = 8;
    data[24] = 0x6d; data[25] = 0x6f; data[26] = 0x6f; data[27] = 0x76; // 'moov'
    const result = validateFragmentedMp4(data);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no media fragments');
    expect(result.initSegmentFound).toBe(true);
  });

  it('returns valid for well-formed fragmented MP4', () => {
    const data = makeValidFmp4(100);
    const result = validateFragmentedMp4(data);
    expect(result.valid).toBe(true);
    expect(result.initSegmentFound).toBe(true);
    expect(result.mediaFragmentCount).toBe(1);
    expect(result.totalSize).toBe(data.length);
  });

  it('returns invalid when all mdat boxes are empty', () => {
    // ftyp + moov + moof + mdat(size=8, no data)
    const data = new Uint8Array(44);
    let offset = 0;
    // ftyp: size=20
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 20;
    data[offset+4] = 0x66; data[offset+5] = 0x74; data[offset+6] = 0x79; data[offset+7] = 0x70;
    offset += 20;
    // moov: size=8
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x6f; data[offset+6] = 0x6f; data[offset+7] = 0x76;
    offset += 8;
    // moof: size=8
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x6f; data[offset+6] = 0x6f; data[offset+7] = 0x66;
    offset += 8;
    // mdat: size=8 (empty — no data beyond header)
    data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 8;
    data[offset+4] = 0x6d; data[offset+5] = 0x64; data[offset+6] = 0x61; data[offset+7] = 0x74;

    const result = validateFragmentedMp4(data);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('counts multiple media fragments', () => {
    // ftyp + moov + moof + mdat + moof + mdat
    const boxes: Array<{ type: string; data: Uint8Array }> = [
      { type: 'ftyp', data: new Uint8Array(12) },
      { type: 'moov', data: new Uint8Array(0) },
      { type: 'moof', data: new Uint8Array(0) },
      { type: 'mdat', data: new Uint8Array(50) },
      { type: 'moof', data: new Uint8Array(0) },
      { type: 'mdat', data: new Uint8Array(50) },
    ];

    const totalSize = boxes.reduce((sum, b) => sum + 8 + b.data.length, 0);
    const data = new Uint8Array(totalSize);
    let offset = 0;
    for (const box of boxes) {
      const boxSize = 8 + box.data.length;
      data[offset] = (boxSize >> 24) & 0xff;
      data[offset + 1] = (boxSize >> 16) & 0xff;
      data[offset + 2] = (boxSize >> 8) & 0xff;
      data[offset + 3] = boxSize & 0xff;
      for (let i = 0; i < 4; i++) {
        data[offset + 4 + i] = box.type.charCodeAt(i);
      }
      data.set(box.data, offset + 8);
      offset += boxSize;
    }

    const result = validateFragmentedMp4(data);
    expect(result.valid).toBe(true);
    expect(result.mediaFragmentCount).toBe(2);
  });
});
