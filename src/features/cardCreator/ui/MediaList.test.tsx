import { render, screen, fireEvent } from '@testing-library/react';
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
  });

  it('renders empty dropzone when no images are attached', () => {
    const onAdd = jest.fn();
    render(<MediaList files={[]} kind="image" addLabel="Add image" onAdd={onAdd} onRemove={jest.fn()} testId="cc-images" />);
    expect(screen.getByTestId('cc-images-empty')).toBeInTheDocument();
    expect(screen.getByText('Drop image here or click to add')).toBeInTheDocument();
  });

  it('calls onAdd when the empty dropzone is clicked', () => {
    const onAdd = jest.fn();
    render(<MediaList files={[]} kind="image" addLabel="Add image" onAdd={onAdd} onRemove={jest.fn()} testId="cc-images" />);
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
        testId="cc-images"
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
        testId="cc-images"
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
        testId="cc-images"
      />
    );

    fireEvent.click(screen.getByTestId('cc-images-add'));
    expect(onAdd).toHaveBeenCalled();
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
        testId="cc-audio"
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
        testId="cc-audio"
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
        testId="cc-audio"
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
        testId="cc-audio"
      />
    );

    fireEvent.click(screen.getByTestId('cc-audio-add'));
    expect(onAdd).toHaveBeenCalled();
  });
});
