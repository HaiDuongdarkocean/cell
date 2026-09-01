/** Domain error for SRS operations. */
export class SrsError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'INVALID_INPUT' | 'DUPLICATE' | 'CONSTRAINT',
    message: string,
  ) {
    super(message);
    this.name = 'SrsError';
  }
}
