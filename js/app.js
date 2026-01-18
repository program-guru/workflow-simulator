/**
 * Main Application Logic
 * Coordinates UI, State Machine, Queue, and Storage.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // --- State Management ---
    let allTasks = [];
    const uiColumns = {
        'DRAFT': document.getElementById('col-draft'),
        'SUBMITTED': document.getElementById('col-submitted'),
        'IN_REVIEW': document.getElementById('col-review'),
        'APPROVED': document.getElementById('col-approved'),
        'COMPLETED': document.getElementById('col-completed'),
        'REJECTED': document.getElementById('col-rejected')
    };

    // --- DOM Elements ---
    const searchInput = document.getElementById('searchInput');
    const priorityFilter = document.getElementById('priorityFilter');
    const modal = document.getElementById('taskModal');
    const createBtn = document.getElementById('createTaskBtn');
    const saveBtn = document.getElementById('saveTaskBtn');
    const cancelBtn = document.getElementById('cancelTaskBtn');
    const errorLog = document.getElementById('errorLog');

    // --- Initialization ---
    init();

    async function init() {
        try {
            const data = await window.AppStorage.load();
            allTasks = data.tasks || [];
            renderBoard();
            startAutoAutomations(); 
        } catch (e) {
            logError("System Error", "Failed to load initial data.");
        }
    }

    // --- Rendering Engine ---
    
    /**
     * Renders the board based on current state and filters.
     * (Requirement #9: Search & Filtering)
     */
    function renderBoard() {
        // 1. Clear Columns
        Object.values(uiColumns).forEach(col => col.innerHTML = '');

        // 2. Get Filter Values
        const term = searchInput.value.toLowerCase();
        const priority = priorityFilter.value;

        // 3. Filter & Sort
        const filtered = allTasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(term);
            const matchesPriority = priority === 'ALL' || task.priority === priority;
            return matchesSearch && matchesPriority;
        });

        // 4. Update Counts & Render Cards
        filtered.forEach(task => {
            const card = createTaskElement(task);
            if (uiColumns[task.state]) {
                uiColumns[task.state].appendChild(card);
            }
        });

        updateColumnCounts(filtered);
    }

    function createTaskElement(task) {
        const card = document.createElement('div');
        card.className = `task-card priority-${task.priority}`;
        card.id = `task-${task.id}`; // Critical for finding DOM elements later
        
        // 1. Check valid next steps from State Machine
        const nextStates = window.WorkflowEngine.getNextStates(task.state);
        
        let buttonsHtml = '';
        nextStates.forEach(state => {
            // Helper to make button labels readable (e.g., IN_REVIEW -> "In Review")
            const label = state.replace(/_/g, ' '); 
            buttonsHtml += `<button class="action-btn" onclick="window.TaskApp.handleMove('${task.id}', '${state}')">${label}</button>`;
        });

        card.innerHTML = `
            <div class="card-header">
                <strong>${task.title}</strong>
                <span style="font-size:0.8em; color: #666;">${task.priority}</span>
            </div>
            <div class="card-meta">ID: ${task.id}</div>
            <div class="card-actions" style="margin-top:8px; display:flex; gap:5px;">
                ${buttonsHtml}
            </div>
        `;
        return card;
    }

    function updateColumnCounts(visibleTasks) {
        // Reset counts
        document.querySelectorAll('.column-header .count').forEach(span => span.innerText = '0');
        
        // Calculate
        const counts = {};
        
        visibleTasks.forEach(t => {
            const currentCount = counts[t.state] || 0;
            counts[t.state] = currentCount + 1;
        });
        
        // Update DOM
        Object.keys(counts).forEach(state => {
            const col = document.querySelector(`.column[data-status="${state}"] .count`);
            if (col) col.innerText = counts[state];
        });
    }

    // --- Core Logic: Optimistic Updates & Rollback ---

    window.TaskApp = {
        handleMove: (taskId, targetState) => {
            const task = allTasks.find(t => t.id === taskId);
            if (!task) return;

            // 1. Lock UI In-Place: Don't move yet, just show loading
            setCardLoadingState(taskId, true);

            // 2. Enqueue Async Operation
            window.AppQueue.enqueue(async () => {
                try {
                    // 3. Call Simulator
                    const updatedTask = await window.WorkflowEngine.transitionTaskAsync(task, targetState);
                    
                    // 4. Persist Success
                    await window.AppStorage.updateTask(updatedTask);
                    
                    // Update internal memory
                    const idx = allTasks.findIndex(t => t.id === taskId);
                    allTasks[idx] = updatedTask;

                    // 5. Success: Re-render board (This effectively moves the card)
                    renderBoard(); 

                } catch (error) {
                    // 6. Failure: Unlock UI In-Place (Don't move)
                    console.warn("Operation failed", error);
                    setCardLoadingState(taskId, false); // Remove loading stripes
                    logError(taskId, error.message);
                }
            }, `Moving task ${taskId} to ${targetState}`);
        }
    };

    // Helper: Toggles loading state without moving DOM
    function setCardLoadingState(taskId, isLoading) {
        const card = document.getElementById(`task-${taskId}`);
        if (!card) return;

        if (isLoading) {
            card.classList.add('loading');
            const btns = card.querySelectorAll('button');
            btns.forEach(b => b.disabled = true);
        } else {
            card.classList.remove('loading');
            const btns = card.querySelectorAll('button');
            btns.forEach(b => b.disabled = false);
        }
    }

    // --- Task Creation ---

    createBtn.onclick = () => {
        document.getElementById('newTaskTitle').value = '';
        modal.classList.remove('hidden');
    };

    cancelBtn.onclick = () => modal.classList.add('hidden');

    saveBtn.onclick = async () => {
        const title = document.getElementById('newTaskTitle').value;
        const priority = document.getElementById('newTaskPriority').value;
        
        if (!title) return alert("Title required");

        const newTask = {
            id: Date.now().toString(),
            title,
            priority,
            state: 'DRAFT',
            history: [],
            createdAt: Date.now()
        };

        modal.classList.add('hidden');

        // Immediate add for creation is okay (or you can make this async too)
        allTasks.push(newTask);
        renderBoard();

        // Async Save
        window.AppQueue.enqueue(async () => {
            await window.AppStorage.updateTask(newTask);
        }, "Creating new task");
    };

    // --- Search & Filter ---
    
    const debouncedRender = debounce(() => renderBoard(), 300);
    searchInput.addEventListener('input', debouncedRender);
    priorityFilter.addEventListener('change', renderBoard);

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function logError(context, msg) {
        const div = document.createElement('div');
        div.style.color = '#ff5630';
        div.style.fontSize = '0.8em';
        div.innerText = `[${new Date().toLocaleTimeString()}] ${context}: ${msg}`;
        errorLog.prepend(div);
        setTimeout(() => div.remove(), 5000);
    }

    function startAutoAutomations() {
        setInterval(() => {
            // Background automation placeholder
        }, 5000);
    }
});