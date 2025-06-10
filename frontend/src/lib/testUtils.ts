import { BACKEND_URL, api } from './apiConfig';
import { handleApiError, ERROR_TYPES } from './errorHandler';
import { loadingManager } from './loadingStore';

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
}

export async function testApiConfig(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  results.push({
    name: 'Backend URL Configuration',
    passed: !!BACKEND_URL && BACKEND_URL.length > 0,
    message: BACKEND_URL ? `✅ Backend URL: ${BACKEND_URL}` : '❌ Backend URL not configured'
  });
  
  results.push({
    name: 'API Object Configuration',
    passed: !!api && typeof api === 'object',
    message: api ? '✅ API object properly configured' : '❌ API object not found'
  });
  
  const apiMethods = ['get', 'post', 'put', 'delete', 'upload'];
  const missingMethods = apiMethods.filter(method => typeof api[method] !== 'function');
  
  results.push({
    name: 'API Methods',
    passed: missingMethods.length === 0,
    message: missingMethods.length === 0 
      ? '✅ All API methods available' 
      : `❌ Missing methods: ${missingMethods.join(', ')}`
  });
  
  return results;
}

export async function testErrorHandling(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  const networkError = handleApiError(new TypeError('fetch failed'));
  results.push({
    name: 'Network Error Handling',
    passed: networkError.code === ERROR_TYPES.NETWORK,
    message: networkError.code === ERROR_TYPES.NETWORK 
      ? '✅ Network errors properly handled' 
      : '❌ Network error handling failed'
  });
  
  const authError = handleApiError({ status: 401, message: 'Unauthorized' });
  results.push({
    name: 'Auth Error Handling',
    passed: authError.code === ERROR_TYPES.AUTH,
    message: authError.code === ERROR_TYPES.AUTH 
      ? '✅ Auth errors properly handled' 
      : '❌ Auth error handling failed'
  });
  
  const validationError = handleApiError({ status: 422, message: 'Validation failed' });
  results.push({
    name: 'Validation Error Handling',
    passed: validationError.code === ERROR_TYPES.VALIDATION,
    message: validationError.code === ERROR_TYPES.VALIDATION 
      ? '✅ Validation errors properly handled' 
      : '❌ Validation error handling failed'
  });
  
  const serverError = handleApiError({ status: 500, message: 'Internal server error' });
  results.push({
    name: 'Server Error Handling',
    passed: serverError.code === ERROR_TYPES.SERVER,
    message: serverError.code === ERROR_TYPES.SERVER 
      ? '✅ Server errors properly handled' 
      : '❌ Server error handling failed'
  });
  
  return results;
}

export async function testLoadingStates(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  results.push({
    name: 'Loading Manager',
    passed: !!loadingManager && typeof loadingManager === 'object',
    message: loadingManager ? '✅ Loading manager available' : '❌ Loading manager not found'
  });
  
  const loadingMethods = ['start', 'stop', 'stopAll', 'isLoading', 'withLoading'];
  const missingLoadingMethods = loadingMethods.filter(method => typeof loadingManager[method] !== 'function');
  
  results.push({
    name: 'Loading Methods',
    passed: missingLoadingMethods.length === 0,
    message: missingLoadingMethods.length === 0 
      ? '✅ All loading methods available' 
      : `❌ Missing methods: ${missingLoadingMethods.join(', ')}`
  });
  
  const testTaskName = 'test-task';
  loadingManager.start(testTaskName);
  const isLoadingAfterStart = loadingManager.isLoading(testTaskName);
  loadingManager.stop(testTaskName);
  const isLoadingAfterStop = loadingManager.isLoading(testTaskName);
  
  results.push({
    name: 'Loading State Management',
    passed: isLoadingAfterStart && !isLoadingAfterStop,
    message: isLoadingAfterStart && !isLoadingAfterStop 
      ? '✅ Loading states work correctly' 
      : '❌ Loading state management failed'
  });
  
  return results;
}

export async function testApiConnectivity(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    
    const duration = Date.now() - startTime;
    
    results.push({
      name: 'Backend Connectivity',
      passed: response.ok,
      message: response.ok 
        ? `✅ Backend reachable (${duration}ms)` 
        : `❌ Backend not reachable (Status: ${response.status})`,
      duration
    });
    
  } catch (error) {
    results.push({
      name: 'Backend Connectivity',
      passed: false,
      message: `❌ Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
  
  return results;
}

export async function runAllTests(): Promise<TestSuite> {
  const startTime = Date.now();
  
  const [
    apiConfigResults,
    errorHandlingResults,
    loadingStateResults,
    connectivityResults
  ] = await Promise.all([
    testApiConfig(),
    testErrorHandling(),
    testLoadingStates(),
    testApiConnectivity()
  ]);
  
  const allResults = [
    ...apiConfigResults,
    ...errorHandlingResults,
    ...loadingStateResults,
    ...connectivityResults
  ];
  
  const totalTests = allResults.length;
  const passedTests = allResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  const duration = Date.now() - startTime;
  
  return {
    name: 'API System Tests',
    results: allResults,
    totalTests,
    passedTests,
    failedTests,
    duration
  };
}

export function printTestResults(testSuite: TestSuite): void {
  console.group(`🧪 ${testSuite.name}`);
  console.log(`📊 Results: ${testSuite.passedTests}/${testSuite.totalTests} passed (${testSuite.duration}ms)`);
  console.log('');
  
  testSuite.results.forEach(result => {
    if (result.passed) {
      console.log(`✅ ${result.name}: ${result.message}`);
    } else {
      console.error(`❌ ${result.name}: ${result.message}`);
    }
  });
  
  if (testSuite.failedTests === 0) {
    console.log('');
    console.log('🎉 All tests passed! API system is working perfectly.');
  } else {
    console.log('');
    console.warn(`⚠️ ${testSuite.failedTests} test(s) failed. Please check the configuration.`);
  }
  
  console.groupEnd();
} 