import { InvalidInputError } from './invalid.input.error.js';

export class DocumentInput {
  private constructor(public readonly number: number, public readonly kind: 'protocol' | 'certificate') {
    Object.freeze(this);
  }

  public static create(number: unknown, kind: unknown): DocumentInput {
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0) {
      throw new InvalidInputError('Numero invalido. Use um inteiro positivo.');
    }
    if (kind !== 'protocol' && kind !== 'certificate') {
      throw new InvalidInputError('Tipo invalido. Use protocol ou certificate.');
    }
    return new DocumentInput(number, kind);
  }

  public static fromRoute(number: unknown, kind: unknown): DocumentInput {
    if (typeof number !== 'string' || !/^\d+$/.test(number)) {
      throw new InvalidInputError('Numero invalido. Use apenas digitos.');
    }
    return DocumentInput.create(Number(number), kind);
  }
}
