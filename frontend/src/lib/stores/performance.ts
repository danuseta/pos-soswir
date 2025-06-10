import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface PerformanceMetrics {
  pageLoadTime: number;
  componentRenderTime: number;
  networkLatency: number;
  memoryUsage: number;
  cacheHitRate: number;
}

interface PerformanceState {
  metrics: PerformanceMetrics;
  isMonitoring: boolean;
  optimizationEnabled: boolean;
}

const initialState: PerformanceState = {
  metrics: {
    pageLoadTime: 0,
    componentRenderTime: 0,
    networkLatency: 0,
    memoryUsage: 0,
    cacheHitRate: 0
  },
  isMonitoring: false,
  optimizationEnabled: true
};

function createPerformanceStore() {
  const { subscribe, set, update } = writable<PerformanceState>(initialState);

  return {
    subscribe,
    
    startMonitoring: () => {
      if (!browser) return;
      
      update(state => ({ ...state, isMonitoring: true }));
      
      if (performance && performance.timing) {
        const navigationStart = performance.timing.navigationStart;
        const loadComplete = performance.timing.loadEventEnd;
        const pageLoadTime = loadComplete - navigationStart;
        
        update(state => ({
          ...state,
          metrics: { ...state.metrics, pageLoadTime }
        }));
      }
      
      if ('memory' in performance) {
        const memoryInfo = (performance as any).memory;
        const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
        
        update(state => ({
          ...state,
          metrics: { ...state.metrics, memoryUsage: memoryUsage * 100 }
        }));
      }
    },
    
    recordRenderTime: (componentName: string, renderTime: number) => {
      if (!browser) return;
      
      update(state => ({
        ...state,
        metrics: { ...state.metrics, componentRenderTime: renderTime }
      }));
      
      if (renderTime > 100) {
        console.warn(`Slow render detected: ${componentName} took ${renderTime}ms`);
      }
    },
    
    recordNetworkLatency: (latency: number) => {
      update(state => ({
        ...state,
        metrics: { ...state.metrics, networkLatency: latency }
      }));
    },
    
    updateCacheHitRate: (hitRate: number) => {
      update(state => ({
        ...state,
        metrics: { ...state.metrics, cacheHitRate: hitRate }
      }));
    },
    
    setOptimizationEnabled: (enabled: boolean) => {
      update(state => ({ ...state, optimizationEnabled: enabled }));
    },
    
    getRecommendations: () => {
      return new Promise<string[]>((resolve) => {
        update(state => {
          const recommendations: string[] = [];
          
          if (state.metrics.pageLoadTime > 3000) {
            recommendations.push('Consider implementing code splitting');
          }
          
          if (state.metrics.componentRenderTime > 100) {
            recommendations.push('Optimize component rendering with memoization');
          }
          
          if (state.metrics.networkLatency > 500) {
            recommendations.push('Implement request caching or CDN');
          }
          
          if (state.metrics.memoryUsage > 80) {
            recommendations.push('Check for memory leaks and optimize large objects');
          }
          
          if (state.metrics.cacheHitRate < 70) {
            recommendations.push('Improve caching strategy');
          }
          
          resolve(recommendations);
          return state;
        });
      });
    },
    
    reset: () => {
      set(initialState);
    }
  };
}

export const performanceStore = createPerformanceStore();

export class PerformanceTimer {
  private startTime: number;
  private label: string;
  
  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
  }
  
  end(): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    console.log(`⚡ ${this.label}: ${duration.toFixed(2)}ms`);
    
    return duration;
  }
}

export function measurePerformance(component: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      const timer = new PerformanceTimer(`${component}.${propertyKey}`);
      const result = originalMethod.apply(this, args);
      const duration = timer.end();
      
      performanceStore.recordRenderTime(component, duration);
      
      return result;
    };
    
    return descriptor;
  };
}

export function trackWebVitals() {
  if (!browser) return;
  
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.startTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
    }
  }
  
  if ('addEventListener' in window) {
    ['mousedown', 'keydown', 'touchstart', 'pointerdown'].forEach(type => {
      addEventListener(type, function(e) {
        const fid = performance.now() - e.timeStamp;
        if (fid > 100) {
          console.warn('High FID detected:', fid);
        }
      }, { once: true, passive: true });
    });
  }
} 