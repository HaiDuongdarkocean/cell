const marks = new Set<string>();
const measures = new Map<string, number>();

const markMock = jest.fn((name: string) => {
  marks.add(name);
  return { name } as PerformanceMark;
});
const measureMock = jest.fn((name: string, start?: string, end?: string) => {
  if (!marks.has(start!) || !marks.has(end!)) {
    throw new DOMException('missing mark', 'SyntaxError');
  }
  measures.set(name, 42);
  return { name, duration: 42 } as PerformanceMeasure;
});
const clearMarksMock = jest.fn((name?: string) => {
  marks.delete(name!);
});

beforeAll(() => {
  Object.assign(performance, {
    mark: markMock,
    measure: measureMock,
    clearMarks: clearMarksMock,
  });
});

beforeEach(() => {
  marks.clear();
  measures.clear();
  jest.clearAllMocks();
});

function loadModule() {
  let m!: typeof import('./perfMarks');
  jest.isolateModules(() => {
    m = require('./perfMarks') as typeof import('./perfMarks');
  });
  return m;
}

describe('gate on (isCellDebug)', () => {
  beforeEach(() => {
    jest.doMock('./cellDebug', () => ({ isCellDebug: () => true }));
  });
  afterEach(() => jest.dontMock('./cellDebug'));

  it('marks + measures + clears marks, retains measure entries', () => {
    const m = loadModule();
    m.markLookup('dispatch', 'r1');
    m.markLookup('response', 'r1');
    m.measureLookup('dispatch', 'response', 'r1');
    expect(measureMock).toHaveBeenCalledWith(
      'cell:lookup:dispatch→response:r1',
      'cell:lookup:dispatch:r1',
      'cell:lookup:response:r1',
    );
    m.clearLookupMarks('r1');
    expect(marks.size).toBe(0);
    expect(measures.get('cell:lookup:dispatch→response:r1')).toBe(42);
  });

  it('audio marks + start→render measure', () => {
    const m = loadModule();
    m.markAudio('start', 'hi');
    m.markAudio('render', 'hi');
    m.measureAudio('start', 'render', 'hi');
    m.clearAudioMarks('hi');
    expect(measures.get('cell:audio:start→render:hi')).toBe(42);
    expect(marks.size).toBe(0);
  });

  it('measure silently skips when end mark missing', () => {
    const m = loadModule();
    m.markLookup('dispatch', 'r2');
    expect(() => m.measureLookup('dispatch', 'render', 'r2')).not.toThrow();
    expect(measures.size).toBe(0);
  });
});

describe('gate off', () => {
  beforeEach(() => {
    jest.doMock('./cellDebug', () => ({ isCellDebug: () => false }));
    jest.doMock('./env/devMode', () => ({ isDevMode: false }));
  });
  afterEach(() => {
    jest.dontMock('./cellDebug');
    jest.dontMock('./env/devMode');
  });

  it('no mark/measure calls', () => {
    const m = loadModule();
    m.markLookup('dispatch', 'r3');
    m.markAudio('start', 'x');
    m.measureLookup('dispatch', 'response', 'r3');
    m.measureAudio('start', 'render', 'x');
    m.clearLookupMarks('r3');
    expect(markMock).not.toHaveBeenCalled();
    expect(measureMock).not.toHaveBeenCalled();
    expect(clearMarksMock).not.toHaveBeenCalled();
  });
});
