import { InvalidInputError } from './invalid.input.error.js';

export class DirectoryInput {
  private constructor(public readonly path: string) {
    Object.freeze(this);
  }

  public static create(path: unknown): DirectoryInput {
    if (typeof path !== 'string' || !path.trim() || path.includes('\0')) {
      throw new InvalidInputError('Caminho invalido. Use uma string nao vazia.');
    }
    return new DirectoryInput(path.trim());
  }
}
