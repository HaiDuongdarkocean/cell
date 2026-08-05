import { createPlayerModeHostController } from './playerModeHost';

describe('playerModeHost', () => {
  it('applies fixed video styles and restores inline styles exactly', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.appendChild(video);
    container.style.setProperty('position', 'relative', 'important');
    video.style.setProperty('object-fit', 'cover');
    video.style.setProperty('height', '80px', 'important');

    const controller = createPlayerModeHostController(video, container);
    controller.update(270);

    // Container is no longer modified — only video styles are applied.
    expect(container.style.getPropertyValue('position')).toBe('relative');
    expect(video.style.getPropertyValue('position')).toBe('fixed');
    expect(video.style.getPropertyValue('object-fit')).toBe('contain');
    expect(video.style.getPropertyValue('z-index')).toBe('2147483646');
    expect(video.style.getPropertyValue('background')).toBe('rgb(0, 0, 0)');

    controller.restore();

    expect(container.style.getPropertyValue('position')).toBe('relative');
    expect(video.style.getPropertyValue('object-fit')).toBe('cover');
    expect(video.style.getPropertyValue('height')).toBe('80px');
    expect(video.style.getPropertyPriority('height')).toBe('important');
    expect(video.style.getPropertyValue('position')).toBe('');
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
