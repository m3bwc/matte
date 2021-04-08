import { IQueuedTask } from '../src/types';
import { PriorityQueue, Queue } from '../src/structures';

describe('Queues', () => {
  it('Queue should adds elements', () => {
    const q = new Queue<IQueuedTask>();
    q.add({ id: 'element', task: undefined });

    expect(q.isEmpty()).toBeFalsy();
  });

  it('Queue should peek elements', () => {
    const q = new Queue<IQueuedTask>();
    const task = { id: 'element', task: undefined };
    q.add(task);

    expect(q.peek()).toEqual(task);
    expect(q.isEmpty());
  });

  it('Queue should adds elements and remove them', () => {
    const q = new Queue<IQueuedTask>();
    const size = 10;
    for (let i = 0; i < size; i++) {
      q.add({ id: i.toString(), task: undefined });
    }
    for (let i = 0; i < size; i++) {
      q.remove({ id: i.toString(), task: undefined });
    }
    expect(q.isEmpty()).toBeTruthy();
  });

  it('Priority Queue should adds elements', () => {
    const q = new PriorityQueue<IQueuedTask>();
    q.add({ id: 'element', task: undefined });

    expect(q.isEmpty()).toBeFalsy();
  });

  it('Priority Queue should peek elements', () => {
    const q = new PriorityQueue<IQueuedTask>();
    const task = { id: 'element', task: undefined };
    q.add(task);

    expect(q.peek()).toEqual(task);
    expect(q.isEmpty());
  });

  it('Priority Queue should adds elements and remove them', () => {
    const q = new PriorityQueue<IQueuedTask>();
    const size = 10;
    for (let i = 0; i < size; i++) {
      q.add({ id: i.toString(), task: undefined });
    }
    for (let i = 0; i < size; i++) {
      q.remove({ id: i.toString(), task: undefined });
    }
    expect(q.isEmpty()).toBeTruthy();
  });
});
