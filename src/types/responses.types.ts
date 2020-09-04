export interface WorkerResponseInterface<T> {
  error: {
    message: string;
    stack: string;
  };
  data: T;
  id: string;
}
