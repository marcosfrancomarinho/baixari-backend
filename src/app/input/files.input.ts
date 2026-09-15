import { DirectoryInput } from './directory.input.js';
import { InvalidInputError } from './invalid.input.error.js';

export class FilesInput {
  private constructor(public readonly directory: DirectoryInput, public readonly files: readonly string[]) {
    Object.freeze(this);
  }

  public static create(directory: DirectoryInput, files: readonly string[]): FilesInput {
    if (!(directory instanceof DirectoryInput) || !Array.isArray(files) || files.length === 0) {
      throw new InvalidInputError('Arquivos invalidos. Informe um diretorio e uma lista nao vazia.');
    }
    const paths = Array.from(files, file => {
      if (typeof file !== 'string' || !file.trim() || file.includes('\0')) {
        throw new InvalidInputError('Caminho de arquivo invalido. Use uma string nao vazia.');
      }
      return file.trim();
    });
    return new FilesInput(directory, Object.freeze(paths));
  }
}
