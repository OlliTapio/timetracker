/** @file A mutable box for the few facts the shell must remember across callbacks. */

export class Cell<T> {
  #value: T

  constructor(initial: T) {
    this.#value = initial
  }

  get(): T {
    return this.#value
  }

  /** Returns the previous value, so a one-shot gate is `cell.swap(true) === false`. */
  swap(next: T): T {
    const previous = this.#value
    this.#value = next
    return previous
  }
}
