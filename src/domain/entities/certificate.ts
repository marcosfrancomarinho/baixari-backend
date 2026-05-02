export class Certificate {
  private constructor(private number: number) {}

  public static create(number: number): Certificate {
    if (number === null || number === undefined) {
      throw new Error('O número da certidao não pode ser nulo ou indefinido');
    }
    if (number <= 0) {
      throw new Error('O número da certidao deve ser um inteiro positivo');
    }
    if (isNaN(number)) {
      throw new Error('O número da certidao deve ser um número válido');
    }
    if (typeof number !== 'number') {
      throw new Error('O número da certidao deve ser do tipo número');
    }
    if (!Number.isInteger(number)) {
      throw new Error('O número da certidao deve ser um inteiro');
    }
    return new Certificate(number);
  }

  public getNumber(): number {
    return this.number;
  }
}