/**
 * Task queue for controlled concurrency with error handling and timeout protection
 */
export class TaskQueue {
    private concurrency: number;
    private running: number;
    private taskQueue: Array<{
        task: () => Promise<void>;
        resolve: () => void;
        reject: (error: Error) => void;
        timeout?: NodeJS.Timeout;
    }>;
    private completionPromises: Array<{
        resolve: () => void;
        reject: (error: Error) => void;
    }>;
    private errors: Error[] = [];
    private isShutdown: boolean = false;
    private taskTimeout: number = 0; // 0 means no timeout

    /**
     * Creates a new TaskQueue
     * @param concurrency Maximum number of concurrent tasks
     * @param options Additional options for the queue
     */
    constructor(concurrency: number, options?: {
        maxQueueSize?: number;
        taskTimeout?: number; // milliseconds
    }) {
        this.concurrency = Math.max(1, concurrency);
        this.running = 0;
        this.taskQueue = [];
        this.completionPromises = [];

        if (options?.taskTimeout) {
            this.taskTimeout = options.taskTimeout;
        }
    }

    /**
     * Add a task to the queue and get a promise that resolves when it completes
     * @param task Function to execute
     * @param priority If true, add to front of queue instead of back
     * @returns Promise that resolves when the task completes
     */
    push(task: () => Promise<void>, priority: boolean = false): Promise<void> {
        if (this.isShutdown) {
            return Promise.reject(new Error('Task queue has been shut down'));
        }

        return new Promise((resolve, reject) => {
            const taskItem = { task, resolve, reject };

            if (priority) {
                this.taskQueue.unshift(taskItem);
            } else {
                this.taskQueue.push(taskItem);
            }

            // Run next tasks in a separate cycle to avoid reentrancy issues
            setTimeout(() => this.runNext(), 0);
        });
    }

    /**
     * Run the next task if there's capacity
     */
    private runNext(): void {
        if (this.isShutdown) return;

        // Process as many tasks as we have capacity for
        while (this.running < this.concurrency && this.taskQueue.length > 0) {
            const taskItem = this.taskQueue.shift();
            if (!taskItem) continue;

            this.running++;

            let timeoutId: NodeJS.Timeout | undefined;

            // Set up timeout if configured
            if (this.taskTimeout > 0) {
                timeoutId = setTimeout(() => {
                    const error = new Error(`Task timed out after ${this.taskTimeout}ms`);
                    this.errors.push(error);
                    taskItem.reject(error);
                }, this.taskTimeout);
                taskItem.timeout = timeoutId;
            }

            // Execute the task
            Promise.resolve().then(() => taskItem.task())
                .then(() => {
                    if (timeoutId) clearTimeout(timeoutId);
                    taskItem.resolve();
                })
                .catch(error => {
                    if (timeoutId) clearTimeout(timeoutId);
                    this.errors.push(error as Error);
                    taskItem.reject(error as Error);
                })
                .finally(() => {
                    this.running--;
                    this.runNext();

                    // Check if all tasks are done
                    this.checkCompletion();
                });
        }
    }

    /**
     * Check if all tasks are complete and resolve/reject completion promises
     */
    private checkCompletion(): void {
        if (this.running === 0 && this.taskQueue.length === 0) {
            // Copy before resolving in case new ones are added during resolution
            const promises = [...this.completionPromises];
            this.completionPromises = [];

            if (this.errors.length > 0) {
                // Create a combined error with all error messages
                const errorMessage = this.errors.length === 1
                    ? this.errors[0].message
                    : `Multiple errors occurred (${this.errors.length}): ${this.errors.map(e => e.message).join('; ')}`;

                const combinedError = new Error(errorMessage);
                // Store original errors as a property (won't show in stack trace but can be inspected)
                (combinedError as any).errors = [...this.errors];

                promises.forEach(({ reject }) => reject(combinedError));
            } else {
                promises.forEach(({ resolve }) => resolve());
            }

            this.errors = [];
        }
    }

    /**
     * Wait for all current tasks to complete
     * @returns Promise that resolves when all tasks are done, or rejects if any fail
     */
    waitForAll(): Promise<void> {
        if (this.running === 0 && this.taskQueue.length === 0) {
            if (this.errors.length > 0) {
                const errorMessage = this.errors.length === 1
                    ? this.errors[0].message
                    : `Multiple errors occurred (${this.errors.length}): ${this.errors.map(e => e.message).join('; ')}`;

                const combinedError = new Error(errorMessage);
                (combinedError as any).errors = [...this.errors];

                this.errors = [];
                return Promise.reject(combinedError);
            }
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.completionPromises.push({ resolve, reject });
        });
    }

    /**
     * Get the number of running tasks
     */
    getRunningCount(): number {
        return this.running;
    }

    /**
     * Get the number of pending tasks
     */
    getPendingCount(): number {
        return this.taskQueue.length;
    }

    /**
     * Shut down the queue, rejecting any pending tasks
     */
    shutdown(): void {
        this.isShutdown = true;

        // Reject all pending tasks
        const error = new Error('Task queue was shut down');

        this.taskQueue.forEach(taskItem => {
            if (taskItem.timeout) clearTimeout(taskItem.timeout);
            taskItem.reject(error);
        });

        this.taskQueue = [];

        // Resolve completion promises if no tasks are running
        if (this.running === 0) {
            this.completionPromises.forEach(({ resolve }) => resolve());
            this.completionPromises = [];
        }
    }
}