import LinkedList from '../linked-list/linked-list';
import { WorkerPoolQueueInterface } from '../../types/queue.type';

export class Queue<T> implements WorkerPoolQueueInterface<T> {
  linkedList: LinkedList<T>;
  constructor() {
    this.linkedList = new LinkedList<T>();
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
}
