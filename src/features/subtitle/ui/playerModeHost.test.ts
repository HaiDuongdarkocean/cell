import { createPlayerModeHostController } from './playerModeHost';

describe('playerModeHost', () => {
  it('applies top-aligned host/video styles and restores inline styles exactly', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.appendChild(video);
    container.style.setProperty('position', 'relative', 'important');
    container.style.setProperty('height', '42px');
    video.style.setProperty('object-fit', 'cover');
    video.style.setProperty('height', '80px', 'important');

    const controller = createPlayerModeHostController(video, container);
    controller.update(270);

    expect(container.style.getPropertyValue('position')).toBe('fixed');
    expect(container.style.getPropertyPriority('position')).toBe('important');
    expect(container.style.getPropertyValue('inset')).toBe('0 auto auto 0');
    expect(container.style.getPropertyValue('height')).toBe('270px');
    expect(video.style.getPropertyValue('position')).toBe('absolute');
    expect(video.style.getPropertyValue('object-fit')).toBe('contain');

    controller.restore();

    expect(container.style.getPropertyValue('position')).toBe('relative');
    expect(container.style.getPropertyPriority('position')).toBe('important');
    expect(container.style.getPropertyValue('height')).toBe('42px');
    expect(container.style.getPropertyValue('inset')).toBe('');
    expect(video.style.getPropertyValue('object-fit')).toBe('cover');
    expect(video.style.getPropertyValue('height')).toBe('80px');
    expect(video.style.getPropertyPriority('height')).toBe('important');
  });

  it('does not reapply styles after restore', () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    const controller = createPlayerModeHostController(video, container);

    controller.restore();
    controller.update(270);

    expect(container.style.getPropertyValue('position')).toBe('');
    expect(video.style.getPropertyValue('position')).toBe('');
  });
});
