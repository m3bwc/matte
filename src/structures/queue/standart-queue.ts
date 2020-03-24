import LinkedList from '../linked-list/linked-list';

export class Queue<T> {
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

  add(value: T): void {
    this.linkedList.append(value);
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
