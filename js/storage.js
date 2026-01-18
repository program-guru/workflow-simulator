/**
 * Async Storage Wrapper (Requirement #6)
 * Simulates asynchronous database access with delays.
 */
const AppStorage = {
    dbKey: 'workflow_sim_data',

    // Simulate random DB latency (100ms - 300ms)
    _delay() {
        return new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    },

    async save(data) {
        await this._delay();
        try {
            localStorage.setItem(this.dbKey, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error("Storage limit reached or error", e);
            throw new Error("Disk Write Failed");
        }
    },

    async load() {
        await this._delay();
        const raw = localStorage.getItem(this.dbKey);
        return raw ? JSON.parse(raw) : { tasks: [], logs: [] };
    },

    // Specific method to update a single task efficiently in our "DB"
    async updateTask(updatedTask) {
        const data = await this.load();
        const index = data.tasks.findIndex(t => t.id === updatedTask.id);
        
        if (index !== -1) {
            data.tasks[index] = updatedTask;
        } else {
            data.tasks.push(updatedTask);
        }
        
        await this.save(data);
        return updatedTask;
    }
};

// Make available globally
window.AppStorage = AppStorage;