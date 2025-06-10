import { writable, derived, type Writable } from 'svelte/store';

export const globalLoading = writable<boolean>(false);
export const loadingTasks = writable<Set<string>>(new Set());

export const loadingStates = {
  login: writable<boolean>(false),
  logout: writable<boolean>(false),
  
  products: writable<boolean>(false),
  categories: writable<boolean>(false),
  transactions: writable<boolean>(false),
  dashboard: writable<boolean>(false),
  users: writable<boolean>(false),
  settings: writable<boolean>(false),
  
  saving: writable<boolean>(false),
  deleting: writable<boolean>(false),
  uploading: writable<boolean>(false),
  processing: writable<boolean>(false),
  
  checkout: writable<boolean>(false),
  payment: writable<boolean>(false),
  stockUpdate: writable<boolean>(false)
};

export const isAnyLoading = derived(
  Object.values(loadingStates),
  (states) => states.some(state => state)
);

export const loadingManager = {
  start(taskName: string) {
    loadingTasks.update(tasks => {
      const newTasks = new Set(tasks);
      newTasks.add(taskName);
      return newTasks;
    });
    globalLoading.set(true);
    
    if (loadingStates[taskName as keyof typeof loadingStates]) {
      loadingStates[taskName as keyof typeof loadingStates].set(true);
    }
  },

  stop(taskName: string) {
    loadingTasks.update(tasks => {
      const newTasks = new Set(tasks);
      newTasks.delete(taskName);
      
      if (newTasks.size === 0) {
        globalLoading.set(false);
      }
      
      return newTasks;
    });
    
    if (loadingStates[taskName as keyof typeof loadingStates]) {
      loadingStates[taskName as keyof typeof loadingStates].set(false);
    }
  },

  stopAll() {
    loadingTasks.set(new Set());
    globalLoading.set(false);
    
    Object.values(loadingStates).forEach(state => state.set(false));
  },

  isLoading(taskName: string): boolean {
    let isTaskLoading = false;
    loadingTasks.subscribe(tasks => {
      isTaskLoading = tasks.has(taskName);
    })();
    return isTaskLoading;
  },

  async withLoading<T>(
    taskName: string,
    operation: () => Promise<T>,
    options: { minDuration?: number } = {}
  ): Promise<T> {
    const { minDuration = 0 } = options;
    
    this.start(taskName);
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      if (minDuration > 0) {
        const elapsed = Date.now() - startTime;
        if (elapsed < minDuration) {
          await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
        }
      }
      
      return result;
    } finally {
      this.stop(taskName);
    }
  }
};

export function createLoadingState(initialValue: boolean = false): Writable<boolean> {
  return writable(initialValue);
}

export function useLoading(taskName: string) {
  return {
    start: () => loadingManager.start(taskName),
    stop: () => loadingManager.stop(taskName),
    isLoading: () => loadingManager.isLoading(taskName),
    withLoading: <T>(operation: () => Promise<T>, options?: { minDuration?: number }) =>
      loadingManager.withLoading(taskName, operation, options)
  };
} 