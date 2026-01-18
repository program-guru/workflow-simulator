/**
 * State Machine & Async Engine (Requirements #1, #2, #7, #11)
 * Handles logic, validation, and simulated network delays.
 */

// 1. Define Valid Transitions (Strict State Machine)
const STATE_RULES = {
    'DRAFT': ['SUBMITTED'],
    'SUBMITTED': ['IN_REVIEW'],
    'IN_REVIEW': ['APPROVED', 'REJECTED'],
    'APPROVED': ['COMPLETED'],
    'COMPLETED': [], // Terminal State
    'REJECTED': ['DRAFT'] // Restart loop
};

class WorkflowEngine {
    constructor() {
        this.lockedTasks = new Set(); // Concurrency Control (Req #8)
    }

    /**
     * Checks if a transition is valid per the rules.
     */
    canTransition(currentParams, targetState) {
        const allowed = STATE_RULES[currentParams];
        return allowed && allowed.includes(targetState);
    }

    /**
     * The core Async Transition function.
     * Simulates network latency and random failures.
     * @returns Promise
     */
    transitionTaskAsync(task, targetState) {
        return new Promise((resolve, reject) => {
            
            // 1. Concurrency Check (Req #8)
            if (this.lockedTasks.has(task.id)) {
                return reject(new Error(`Task ${task.id} is currently locked by another operation.`));
            }

            // 2. Lock the task
            this.lockedTasks.add(task.id);
            console.log(`[Workflow] Locked task: ${task.id}`);

            // 3. Simulate Network Delay (500ms - 3000ms) - (Req #2)
            const delay = Math.floor(Math.random() * 2500) + 500;

            setTimeout(() => {
                // 4. Simulate Random Failure (15% chance)
                const shouldFail = Math.random() < 0.15; 

                if (shouldFail) {
                    this.lockedTasks.delete(task.id); // Release Lock
                    console.error(`[Workflow] Transition failed for ${task.id}`);
                    reject(new Error("Network Error: Failed to process state transition."));
                } else {
                    // Success!
                    task.state = targetState;
                    task.history.push({
                        action: `MOVED_TO_${targetState}`,
                        timestamp: Date.now()
                    });
                    
                    this.lockedTasks.delete(task.id); // Release Lock
                    resolve(task);
                }
            }, delay);
        });
    }

    /**
     * Helper to get allowed next states for UI rendering
     */
    getNextStates(currentState) {
        return STATE_RULES[currentState] || [];
    }
}

// Export global instance
window.WorkflowEngine = new WorkflowEngine();