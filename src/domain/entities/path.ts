export class Path {
  private constructor(private path: string) {}

  public static create(path: string): Path {
    if (path === null || path === undefined) {
      throw new Error('O caminho não pode ser nulo ou indefinido');
    }
    if (typeof path !== 'string') {
      throw new Error('O caminho deve ser uma string');
    }
    if (path.trim().length === 0) {
      throw new Error('O caminho não pode ser uma string vazia');
    }
    return new Path(path.trim());
  }

  public getPath(): string {
    return this.path;
  }
}
