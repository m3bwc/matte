import Heap from './heap';

export default class MinHeap<T> extends Heap<T> {
  pairIsInCorrectOrder(firstElement: unknown, secondElement: unknown): boolean {
    return this.compare.lessThanOrEqual(firstElement, secondElement);
  }
}
