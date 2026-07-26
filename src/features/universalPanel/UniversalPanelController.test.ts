import { describe, expect, it, jest } from '@jest/globals';
import { createUniversalPanelController } from './UniversalPanelController';
import type { DictionaryPanelPrefill } from './types';

describe('createUniversalPanelController', () => {
  it('sendToCard invokes onSendToCard and opens the dictionary tab', async () => {
    const onSendToCard = jest.fn();
    const onOpen = jest.fn();
    const { controller } = createUniversalPanelController({
      onSendToCard,
      onOpen,
    });

    const prefill: DictionaryPanelPrefill = {
      term: 'hello',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: 'hello world',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    };

    await controller.sendToCard(prefill);

    expect(onSendToCard).toHaveBeenCalledTimes(1);
    expect(onSendToCard).toHaveBeenCalledWith(prefill);
    expect(onOpen).toHaveBeenCalledWith('dictionary');
    expect(controller.isOpen()).toBe(true);
  });

  it('sendToCard is a no-op after unmount', async () => {
    const onSendToCard = jest.fn();
    const { controller, unmount } = createUniversalPanelController({ onSendToCard });
    unmount();

    await controller.sendToCard({
      term: 'hello',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: '',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    });

    expect(onSendToCard).not.toHaveBeenCalled();
  });

  it('multiple rapid sendToCard calls preserve the last prefill', async () => {
    const onSendToCard = jest.fn();
    const onOpen = jest.fn();
    const { controller } = createUniversalPanelController({ onSendToCard, onOpen });

    const prefill1: DictionaryPanelPrefill = {
      term: 'hello',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: '',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    };
    const prefill2: DictionaryPanelPrefill = {
      term: 'world',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: '',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    };

    await Promise.all([
      controller.sendToCard(prefill1),
      controller.sendToCard(prefill2),
    ]);

    expect(onSendToCard).toHaveBeenCalledTimes(2);
    expect(onSendToCard).toHaveBeenLastCalledWith(prefill2);
    expect(onOpen).toHaveBeenCalledWith('dictionary');
    expect(controller.isOpen()).toBe(true);
  });

  it('sendToCard is a no-op if unmounted during open', async () => {
    const onSendToCard = jest.fn();
    const onOpen = jest.fn();
    const { controller, unmount } = createUniversalPanelController({
      onSendToCard,
      onOpen,
      getPersistedTab: () => new Promise((resolve) => { setTimeout(resolve, 0); }),
    });

    const promise = controller.sendToCard({
      term: 'test',
      langCode: 'en',
      reading: '',
      definitions: [],
      rawDefinitions: [],
      contextSentence: '',
      wordAudioUrls: [],
      sentenceAudioUrls: [],
      imageUrls: [],
    });
    unmount();
    await promise;

    expect(onSendToCard).toHaveBeenCalledTimes(1);
    expect(controller.isOpen()).toBe(false);
  });
});
