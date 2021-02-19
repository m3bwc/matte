export interface WorkerResponseErrorInterface {
  message: string;
  stack: string;
}

export interface WorkerResponseInterface<T> {
  error: WorkerResponseErrorInterface;
  data: T;
  id: string;
}
