import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CardCreatorSettingsPanel } from '@/features/settings/ui/CardCreatorSettingsPanel';
import { DEFAULT_CARD_CREATOR_SETTINGS } from '@/shared/config/config';
import type { CardCreatorSettings } from '@/entities/settings';
import { testConnection } from '@/features/cardCreator/service/cardCreatorService';
import {
  loadAnkiSchemaCache,
  refreshAnkiSchemaCache,
  getModelFields,
} from '@/features/cardCreator/service/ankiSchemaCache';

const TEST_CACHE = {
  url: 'http://localhost:8765',
  fetchedAt: 1,
  decks: ['Default', 'MyDeck'],
  models: ['Basic', 'Cell Video Card'],
  fieldsByModel: {
    Basic: ['Front', 'Back', 'Definitions'],
    'Cell Video Card': ['TargetWord', 'Sentence', 'Definitions'],
  },
};

jest.mock('@/features/cardCreator/service/cardCreatorService', () => ({
  testConnection: jest.fn(),
}));

jest.mock('@/features/cardCreator/service/ankiSchemaCache', () => ({
  loadAnkiSchemaCache: jest.fn(),
  refreshAnkiSchemaCache: jest.fn(),
  getModelFields: jest.fn(),
  removeAnkiSchemaCache: jest.fn(),
}));

const mockTestConnection = (
  jest.requireMock('@/features/cardCreator/service/cardCreatorService') as { testConnection: jest.MockedFunction<typeof testConnection> }
).testConnection;

const mockedAnkiSchemaCache = jest.requireMock('@/features/cardCreator/service/ankiSchemaCache') as {
  loadAnkiSchemaCache: jest.MockedFunction<typeof loadAnkiSchemaCache>;
  refreshAnkiSchemaCache: jest.MockedFunction<typeof refreshAnkiSchemaCache>;
  getModelFields: jest.MockedFunction<typeof getModelFields>;
};
const { loadAnkiSchemaCache: mockLoadCache, refreshAnkiSchemaCache: mockRefreshCache, getModelFields: mockGetModelFields } = mockedAnkiSchemaCache;

function makeProps(overrides: Partial<CardCreatorSettings> = {}, destination = 'anki' as const) {
  return {
    settings: { ...DEFAULT_CARD_CREATOR_SETTINGS, defaultNoteType: 'Basic', ...overrides },
    srsDestination: destination,
    onChange: jest.fn(),
    onDestinationChange: jest.fn(),
  };
}

describe('CardCreatorSettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTestConnection.mockResolvedValue({ ok: true, value: 6 });
    mockLoadCache.mockResolvedValue(TEST_CACHE);
    mockRefreshCache.mockResolvedValue({ ok: true, value: TEST_CACHE });
    mockGetModelFields.mockImplementation(async (_url: string, model: string) => {
      return TEST_CACHE.fieldsByModel[model as keyof typeof TEST_CACHE.fieldsByModel] ?? null;
    });
  });

  it('loads cached decks and note types on mount', async () => {
    const props = makeProps();
    render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => {
      expect(mockLoadCache).toHaveBeenCalledWith(props.settings.ankiConnectUrl);
    });
  });

  it('switches destination and hides the Anki section when Ocean SRS is selected', async () => {
    const props = makeProps();
    const { rerender } = render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => expect(mockLoadCache).toHaveBeenCalled());

    expect(screen.getByLabelText('AnkiConnect URL')).toBeInTheDocument();

    rerender(<CardCreatorSettingsPanel {...props} srsDestination="ocean-srs" />);
    expect(screen.queryByLabelText('AnkiConnect URL')).not.toBeInTheDocument();
    expect(screen.getByText(/Ocean SRS stores cards in/i)).toBeInTheDocument();
  });

  it('calls onDestinationChange when the destination select changes', async () => {
    const props = makeProps();
    render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => expect(mockLoadCache).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Card destination' }));
    const option = await screen.findByRole('option', { name: 'Ocean SRS' });
    fireEvent.click(option);
    expect(props.onDestinationChange).toHaveBeenCalledWith('ocean-srs');
  });

  it('calls onChange with defaultNoteType when a note type is selected', async () => {
    const props = makeProps();
    render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => expect(mockGetModelFields).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Note type' }));
    const option = await screen.findByRole('option', { name: 'Cell Video Card' });
    fireEvent.click(option);
    expect(props.onChange).toHaveBeenCalledWith({ defaultNoteType: 'Cell Video Card' });
  });

  it('calls onChange with defaultDeck when a deck is selected', async () => {
    const props = makeProps();
    render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => expect(mockLoadCache).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Deck' }));
    const option = await screen.findByRole('option', { name: 'MyDeck' });
    fireEvent.click(option);
    expect(props.onChange).toHaveBeenCalledWith({ defaultDeck: 'MyDeck' });
  });

  it('persists per-note-type field mapping changes', async () => {
    const props = makeProps();
    render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => expect(mockGetModelFields).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Map Target word to Anki field' }));
    const option = await screen.findByRole('option', { name: 'Front' });
    fireEvent.click(option);

    await waitFor(() => {
      expect(props.onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldMappings: expect.objectContaining({
            Basic: expect.objectContaining({ targetWord: 'Front' }),
          }),
        }),
      );
    });
  });

  it('tests AnkiConnect and refreshes the schema cache', async () => {
    const props = makeProps();
    render(<CardCreatorSettingsPanel {...props} />);
    await waitFor(() => expect(mockLoadCache).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Test AnkiConnect connection again' }));
    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalledWith(props.settings.ankiConnectUrl);
      expect(mockRefreshCache).toHaveBeenCalledWith(props.settings.ankiConnectUrl);
    });
  });
});
