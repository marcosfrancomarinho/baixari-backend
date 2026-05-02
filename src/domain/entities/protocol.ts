export class Protocol {
  private constructor(private number: number) {}

  public static create(number: number): Protocol {
    if (number === null || number === undefined) {
      throw new Error('O número do protocolo não pode ser nulo ou indefinido');
    }
    if (number <= 0) {
      throw new Error('O número do protocolo deve ser um inteiro positivo');
    }
    if (isNaN(number)) {
      throw new Error('O número do protocolo deve ser um número válido');
    }
    if (typeof number !== 'number') {
      throw new Error('O número do protocolo deve ser do tipo número');
    }
    if (!Number.isInteger(number)) {
      throw new Error('O número do protocolo deve ser um inteiro');
    }
    return new Protocol(number);
  }

  public getNumber(): number {
    return this.number;
  }
}
