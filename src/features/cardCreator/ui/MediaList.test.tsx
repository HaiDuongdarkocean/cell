import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaList } from './MediaList';
import type { MediaFile } from '../media/mediaFile';

describe('MediaList — image gallery', () => {
  const image: MediaFile = {
    kind: 'image',
    filename: 'cell-image-1.png',
    mimeType: 'image/png',
    data: new Uint8Array([1, 2, 3]).buffer,
  };

  beforeEach(() => {
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        value: jest.fn(() => 'blob:mock'),
        writable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: jest.fn(),
        writable: true,
      });
    }
    if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
      Blob.prototype.arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener('loadend', () => resolve(reader.result as ArrayBuffer));
          reader.addEventListener('error', () => reject(reader.error));
          reader.readAsArrayBuffer(this);
        });
      };
      File.prototype.arrayBuffer = Blob.prototype.arrayBuffer as unknown as File['arrayBuffer'];
    }
  });

  it('renders empty dropzone when no images are attached', () => {
    const onAdd = jest.fn();
    render(<MediaList files={[]} kind="image" addLabel="Add image" onAdd={onAdd} onRemove={jest.fn()} dataId="cc-images" />);
    expect(screen.getByTestId('cc-images-empty')).toBeInTheDocument();
    expect(screen.getByText('Drop image here or click to add')).toBeInTheDocument();
  });

  it('calls onAdd when the empty dropzone is clicked', () => {
    const onAdd = jest.fn();
    render(<MediaList files={[]} kind="image" addLabel="Add image" onAdd={onAdd} onRemove={jest.fn()} dataId="cc-images" />);
    fireEvent.click(screen.getByTestId('cc-images-empty'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('renders image thumbnails with remove buttons and an add button', () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    render(
      <MediaList
        files={[image]}
        kind="image"
        addLabel="Add image"
        onAdd={onAdd}
        onRemove={onRemove}
        dataId="cc-images"
      />
    );

    expect(screen.getByTestId('cc-images-thumb-0')).toBeInTheDocument();
    expect(screen.getByTestId('cc-images-remove-0')).toBeInTheDocument();
    expect(screen.getByTestId('cc-images-add')).toBeInTheDocument();
  });

  it('calls onRemove with the correct index when the remove button is clicked', () => {
    const onRemove = jest.fn();
    render(
      <MediaList
        files={[image]}
        kind="image"
        addLabel="Add image"
        onAdd={jest.fn()}
        onRemove={onRemove}
        dataId="cc-images"
      />
    );

    fireEvent.click(screen.getByTestId('cc-images-remove-0'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('calls onAdd when the gallery add button is clicked', () => {
    const onAdd = jest.fn();
    render(
      <MediaList
        files={[image]}
        kind="image"
        addLabel="Add image"
        onAdd={onAdd}
        onRemove={jest.fn()}
        dataId="cc-images"
      />
    );

    fireEvent.click(screen.getByTestId('cc-images-add'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onReorder when an image thumbnail is dragged onto another', () => {
    const onReorder = jest.fn();
    const image2: MediaFile = {
      kind: 'image',
      filename: 'cell-image-2.png',
      mimeType: 'image/png',
      data: new Uint8Array([4, 5, 6]).buffer,
    };
    render(
      <MediaList
        files={[image, image2]}
        kind="image"
        addLabel="Add image"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onReorder={onReorder}
        dataId="cc-images"
      />
    );

    fireEvent.dragStart(screen.getByTestId('cc-images-thumb-0'), { dataTransfer: {} });
    fireEvent.drop(screen.getByTestId('cc-images-thumb-1'), { dataTransfer: {} });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('opens the image preview overlay when a thumbnail is clicked', () => {
    render(
      <MediaList
        files={[image]}
        kind="image"
        addLabel="Add image"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Preview cell-image-1.png/i }));
    expect(screen.getByRole('dialog', { name: 'Image preview' })).toBeInTheDocument();
  });

  it('calls onFilesDrop with converted image files when dropped', async () => {
    const onFilesDrop = jest.fn();
    const file = new File([new Uint8Array([1, 2, 3])], 'dropped.png', { type: 'image/png' });
    render(
      <MediaList
        files={[]}
        kind="image"
        addLabel="Add image"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onFilesDrop={onFilesDrop}
        dataId="cc-images"
      />
    );

    fireEvent.dragEnter(screen.getByTestId('cc-images'));
    fireEvent.drop(screen.getByTestId('cc-images'), { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(onFilesDrop).toHaveBeenCalled();
    });

    const [files, invalidCount] = onFilesDrop.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].kind).toBe('image');
    expect(files[0].filename).toBe('dropped.png');
    expect(invalidCount).toBe(0);
  });

  it('reports ignored invalid files when an audio file is dropped on an image list', async () => {
    const onFilesDrop = jest.fn();
    const invalid = new File([new Uint8Array([1, 2, 3])], 'audio.mp3', { type: 'audio/mpeg' });
    render(
      <MediaList
        files={[]}
        kind="image"
        addLabel="Add image"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onFilesDrop={onFilesDrop}
        dataId="cc-images"
      />
    );

    fireEvent.drop(screen.getByTestId('cc-images'), { dataTransfer: { files: [invalid] } });

    await waitFor(() => {
      expect(onFilesDrop).toHaveBeenCalled();
    });

    const [files, invalidCount] = onFilesDrop.mock.calls[0];
    expect(files).toHaveLength(0);
    expect(invalidCount).toBe(1);
  });

  it('calls onFilesDrop when an image file is dropped on a non-empty image gallery', async () => {
    const onFilesDrop = jest.fn();
    const file = new File([new Uint8Array([9, 8, 7])], 'new.png', { type: 'image/png' });
    render(
      <MediaList
        files={[image]}
        kind="image"
        addLabel="Add image"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onFilesDrop={onFilesDrop}
        onReorder={jest.fn()}
        dataId="cc-images"
      />
    );

    // Drop on an existing thumbnail — before the fix, the inner onDrop handler
    // called stopPropagation unconditionally and blocked the outer mediaZone
    // handler from running, so onFilesDrop was never called.
    fireEvent.drop(screen.getByTestId('cc-images-thumb-0'), { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(onFilesDrop).toHaveBeenCalled();
    });

    const [files, invalidCount] = onFilesDrop.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].kind).toBe('image');
    expect(files[0].filename).toBe('new.png');
    expect(invalidCount).toBe(0);
  });
});

describe('MediaList — audio list', () => {
  const audio: MediaFile = {
    kind: 'audio',
    filename: 'cell-audio-1.webm',
    mimeType: 'audio/webm',
    data: new Uint8Array([1, 2, 3]).buffer,
  };

  it('renders empty dropzone for audio when no files are attached', () => {
    const onAdd = jest.fn();
    render(
      <MediaList
        files={[]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={onAdd}
        onRemove={jest.fn()}
        dataId="cc-audio"
      />
    );

    expect(screen.getByTestId('cc-audio-empty')).toBeInTheDocument();
    expect(screen.getByText('Drop audio here or click to add')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-audio-empty'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('renders audio rows and an add button', () => {
    render(
      <MediaList
        files={[audio]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        dataId="cc-audio"
      />
    );

    expect(screen.getByText('cell-audio-1.webm')).toBeInTheDocument();
    expect(screen.getByTestId('cc-audio-remove-0')).toBeInTheDocument();
    expect(screen.getByTestId('cc-audio-add')).toBeInTheDocument();
  });

  it('calls onRemove with the correct index for audio rows', () => {
    const onRemove = jest.fn();
    render(
      <MediaList
        files={[audio]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={jest.fn()}
        onRemove={onRemove}
        dataId="cc-audio"
      />
    );

    fireEvent.click(screen.getByTestId('cc-audio-remove-0'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('calls onAdd when the audio add button is clicked', () => {
    const onAdd = jest.fn();
    render(
      <MediaList
        files={[audio]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={onAdd}
        onRemove={jest.fn()}
        dataId="cc-audio"
      />
    );

    fireEvent.click(screen.getByTestId('cc-audio-add'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onReorder when an audio row is dragged onto another', () => {
    const onReorder = jest.fn();
    const audio2: MediaFile = {
      kind: 'audio',
      filename: 'cell-audio-2.webm',
      mimeType: 'audio/webm',
      data: new Uint8Array([4, 5, 6]).buffer,
    };
    render(
      <MediaList
        files={[audio, audio2]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onReorder={onReorder}
        dataId="cc-audio"
      />
    );

    fireEvent.dragStart(screen.getByTestId('cc-audio-view-0'), { dataTransfer: {} });
    fireEvent.drop(screen.getByTestId('cc-audio-view-1'), { dataTransfer: {} });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('calls onFilesDrop when an audio file is dropped on an empty audio area', async () => {
    const onFilesDrop = jest.fn();
    const file = new File([new Uint8Array([1, 2, 3])], 'dropped.webm', { type: 'audio/webm' });
    render(
      <MediaList
        files={[]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onFilesDrop={onFilesDrop}
        dataId="cc-audio"
      />
    );

    fireEvent.dragEnter(screen.getByTestId('cc-audio'));
    fireEvent.drop(screen.getByTestId('cc-audio'), { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(onFilesDrop).toHaveBeenCalled();
    });

    const [files, invalidCount] = onFilesDrop.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].kind).toBe('audio');
    expect(files[0].filename).toBe('dropped.webm');
    expect(invalidCount).toBe(0);
  });

  it('calls onFilesDrop when an audio file is dropped on a non-empty audio area', async () => {
    const onFilesDrop = jest.fn();
    const file = new File([new Uint8Array([9, 8, 7])], 'new.mp3', { type: 'audio/mpeg' });
    render(
      <MediaList
        files={[audio]}
        kind="audio"
        addLabel="Add sentence audio"
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        onFilesDrop={onFilesDrop}
        onReorder={jest.fn()}
        dataId="cc-audio"
      />
    );

    // Drop on an existing row — before the fix, the inner onDrop handler
    // called stopPropagation unconditionally and blocked the outer mediaZone
    // handler from running, so onFilesDrop was never called.
    fireEvent.drop(screen.getByTestId('cc-audio-view-0'), { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(onFilesDrop).toHaveBeenCalled();
    });

    const [files, invalidCount] = onFilesDrop.mock.calls[0];
    expect(files).toHaveLength(1);
    expect(files[0].kind).toBe('audio');
    expect(files[0].filename).toBe('new.mp3');
    expect(invalidCount).toBe(0);
  });
});
