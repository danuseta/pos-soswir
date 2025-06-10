import { showAlert as storeShowAlert } from '$lib/stores/alertStore';

export function useAlert() {
  const showAlertMessage = (type: 'success' | 'error' | 'info', message: string) => {
    storeShowAlert(type, message);
  };

  return {
    showAlertMessage
  };
} 