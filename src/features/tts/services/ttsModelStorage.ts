// ttsModelStorage — OPFS persistence for Supertonic v3 voice-pack files.
//
// Stored under OPFS root/tts/. Each language pack is a flat set of files
// (ONNX + JSON). Functions are async and safe for offscreen document use.

const TTS_ROOT = 'tts';

async function getTtsDirectory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(TTS_ROOT, { create: true });
}

export async function writeTtsFile(
  name: string,
  stream: ReadableStream<Uint8Array>,
  onChunk?: (bytes: number) => void,
): Promise<void> {
  const dir = await getTtsDirectory();
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writer = await fileHandle.createWritable();
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
      onChunk?.(value.byteLength);
    }
  } finally {
    await reader.releaseLock();
    await writer.close();
  }
}

export async function readTtsFile(name: string): Promise<File | undefined> {
  const dir = await getTtsDirectory();
  try {
    const fileHandle = await dir.getFileHandle(name);
    return await fileHandle.getFile();
  } catch {
    return undefined;
  }
}

export async function hasTtsFile(name: string): Promise<boolean> {
  const dir = await getTtsDirectory();
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function deleteTtsFile(name: string): Promise<void> {
  const dir = await getTtsDirectory();
  try {
    await dir.removeEntry(name);
  } catch {
    // Ignore if missing.
  }
}

export async function listTtsFiles(): Promise<readonly string[]> {
  const dir = await getTtsDirectory();
  const names: string[] = [];
  for await (const [name] of dir.entries()) {
    names.push(name);
  }
  return names;
}

export async function clearTtsDirectory(): Promise<void> {
  const dir = await getTtsDirectory();
  const names = await listTtsFiles();
  await Promise.all(names.map((name) => dir.removeEntry(name)));
}
