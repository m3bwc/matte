import LinkedList from '../linked-list/linked-list';
import { WorkerPoolQueueInterface, IQueuedTask } from '../../types/';
import { CompareFunction } from '../comparator';

export class Queue<T extends IQueuedTask> implements WorkerPoolQueueInterface<T> {
  linkedList: LinkedList<T>;
  constructor(compareFunction?: CompareFunction) {
    this.linkedList = new LinkedList<T>(compareFunction || this.compareValue);
  }

  isEmpty(): boolean {
    return !this.linkedList.head;
  }

  peek(): T {
    if (!this.linkedList.head) {
      return null;
    }

    return this.linkedList.head.value;
  }

  add(value: T): this {
    this.linkedList.append(value);
    return this;
  }

  poll(): T {
    const removedHead = this.linkedList.deleteHead();
    return removedHead ? removedHead.value : null;
  }

  toString(callback): string {
    // Return string representation of the queue's linked list.
    return this.linkedList.toString(callback);
  }

  clear(): void {
    this.linkedList = new LinkedList();
  }

  remove(item: T): this {
    this.linkedList.delete(item);
    return this;
  }

  compareValue(a: T, b: T): number {
    if (a.id === b.id) {
      return 0;
    }
    return a.id < b.id ? -1 : 1;
  }
}
