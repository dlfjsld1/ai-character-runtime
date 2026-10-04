const decimalCounter = /^(0|[1-9]\d*)$/;

export function parseWireCounter(value: unknown): bigint {
  if (typeof value !== 'string' || !decimalCounter.test(value)) {
    throw new TypeError('Expected a non-negative decimal counter string');
  }
  return BigInt(value);
}

export function serializeWireCounter(value: bigint): string {
  if (value < 0n) {
    throw new RangeError('Counter cannot be negative');
  }
  return value.toString(10);
}
