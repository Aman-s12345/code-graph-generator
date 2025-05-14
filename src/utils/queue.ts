/**
 * Task queue for controlled concurrency
 */
export class TaskQueue {
    private concurrency: number;
    private running: number;
    private taskQueue: Array<() => Promise<void>>;
    private completionPromises: Array<{
        resolve: () => void;
        reject: (error: Error) => void;
    }>;

    constructor(concurrency: number) {
        this.concurrency = concurrency;
        this.running = 0;
        this.taskQueue = [];
        this.completionPromises = [];
    }

    /**
     * Add a task to the queue and get a promise that resolves when it completes
     */
    push(task: () => Promise<void>): Promise<void> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push(async () => {
                try {
                    await task();
                    resolve();
                } catch (error) {
                    reject(error as Error);
                }
            });

            this.runNext();
        });
    }

    /**
     * Run the next task if there's capacity
     */
    private runNext(): void {
        if (this.running < this.concurrency && this.taskQueue.length > 0) {
            const nextTask = this.taskQueue.shift();
            if (nextTask) {
                this.running++;

                nextTask().finally(() => {
                    this.running--;
                    this.runNext();

                    // Check if all tasks are done
                    if (this.running === 0 && this.taskQueue.length === 0) {
                        this.completionPromises.forEach(({ resolve }) => resolve());
                        this.completionPromises = [];
                    }
                });
            }
        }
    }

    /**
     * Wait for all current tasks to complete
     */
    waitForAll(): Promise<void> {
        if (this.running === 0 && this.taskQueue.length === 0) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.completionPromises.push({ resolve, reject });
        });
    }
}