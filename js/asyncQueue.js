/**
 * Background Processing Queue (Requirement #3)
 * Manages async jobs sequentially to prevent browser overload.
 */

class AsyncQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        
        // UI Elements (Cached)
        this.uiQueueCount = document.getElementById('queueCount');
        this.uiActiveJob = document.getElementById('activeJob');
    }

    /**
     * Add a job to the queue.
     * @param {Function} taskFn - An async function that returns a Promise.
     * @param {String} description - Description for the UI.
     */
    enqueue(taskFn, description) {
        this.queue.push({ fn: taskFn, desc: description });
        this.updateUI();
        this.processNext();
    }

    async processNext() {
        // Stop if already busy or empty
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const job = this.queue.shift(); // FIFO
        this.updateUI(job.desc);

        try {
            await job.fn(); // Execute the actual async workflow
        } catch (error) {
            console.error("Background Job Failed:", error);
            // Error handling is delegated to the caller/app logic usually,
            // but we log it here for the "System" view.
        } finally {
            this.isProcessing = false;
            this.updateUI();
            this.processNext(); // Recursive call for next item
        }
    }

    updateUI(activeDesc = null) {
        if (this.uiQueueCount) {
            this.uiQueueCount.innerText = this.queue.length;
        }
        if (this.uiActiveJob) {
            this.uiActiveJob.innerText = activeDesc || "Idle";
            this.uiActiveJob.className = activeDesc ? "highlight-active" : "";
        }
    }
}

// Export global instance
window.AppQueue = new AsyncQueue();