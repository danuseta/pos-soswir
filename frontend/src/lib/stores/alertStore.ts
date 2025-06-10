import { writable } from 'svelte/store';

export interface AlertState {
  show: boolean;
  type: 'success' | 'error' | 'info';
  message: string;
}

const initialState: AlertState = {
  show: false,
  type: 'info',
  message: ''
};

export const alertStore = writable<AlertState>(initialState);

export const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
  alertStore.set({
    show: true,
    type,
    message
  });
};

export const hideAlert = () => {
  alertStore.update(state => ({
    ...state,
    show: false
  }));
}; 