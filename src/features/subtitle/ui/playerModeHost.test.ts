import { createPlayerModeHostController } from './playerModeHost';

describe('playerModeHost', () => {
  it('is a no-op controller (canvas capture approach)', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.appendChild(video);
    container.style.setProperty('position', 'relative', 'important');
    video.style.setProperty('object-fit', 'cover');

    const controller = createPlayerModeHostController(video, container);
    controller.update(270);

    // No styles applied — video stays in host as-is.
    expect(container.style.getPropertyValue('position')).toBe('relative');
    expect(video.style.getPropertyValue('position')).toBe('');
    expect(video.style.getPropertyValue('object-fit')).toBe('cover');

    controller.restore();
    // Restore is also a no-op.
    expect(container.style.getPropertyValue('position')).toBe('relative');
    expect(video.style.getPropertyValue('object-fit')).toBe('cover');
  });

  it('does not reapply styles after restore', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    const controller = createPlayerModeHostController(video, container);

    controller.restore();
    controller.update(270);

    expect(video.style.getPropertyValue('position')).toBe('');
  });
});
