import MinHeap from '../heap/min-heap';
import Comparator from '../comparator';

export class PriorityQueue<T> extends MinHeap<T> {
  private priorities: Map<T, number>;

  constructor() {
    super();
    this.priorities = new Map();
    this.compare = new Comparator(this.comparePriority.bind(this));
  }

  add(item: T, priority = 0): this {
    this.priorities.set(item, priority);
    super.add(item);
    return this;
  }

  remove(item: T, customFindingComparator: Comparator): this {
    super.remove(item, customFindingComparator);
    this.priorities.delete(item);
    return this;
  }

  changePriority(item: T, priority: number): this {
    this.remove(item, new Comparator(this.compareValue));
    this.add(item, priority);
    return this;
  }

  findByValue(item: T): number[] {
    return this.find(item, new Comparator(this.compareValue));
  }

  hasValue(item: T): boolean {
    return this.findByValue(item).length > 0;
  }

  comparePriority(a: T, b: T): number {
    if (this.priorities.get(a) === this.priorities.get(b)) {
      return 0;
    }
    return this.priorities.get(a) < this.priorities.get(b) ? -1 : 1;
  }

  compareValue(a: T, b: T): number {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  }

  clear(): void {
    this.priorities.clear();
  }
}
