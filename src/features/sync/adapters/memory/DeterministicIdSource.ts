import type { IdSource } from '../../ports/idSource';

export class DeterministicIdSource implements IdSource {
  private seq = 0;

  uuid(): string {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }
}
