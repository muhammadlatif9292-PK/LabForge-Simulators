// src/instruments/base-instrument.ts
export interface BaseInstrument {
  id: string;
  name: string;
  state: any;

  initialize(): void;
  update(input: any): any;
  validate(input: any): boolean;
  reset(): void;
  updateState(newState: any): void;
}

export abstract class Instrument implements BaseInstrument {
  id: string;
  name: string;
  state: any = {};

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  abstract initialize(): void;
  abstract update(input: any): any;

  validate(input: any): boolean {
    // override in subclass
    return true;
  }

  reset(): void {
    this.state = {};
    this.initialize();
  }

  updateState(newState: any): void {
    this.state = { ...this.state, ...newState };
  }
}