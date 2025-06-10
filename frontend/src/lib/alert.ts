export function showAlertMessage(type: 'success' | 'error' | 'warning' | 'info', message: string) {
	if (type === 'error') {
		alert(`Error: ${message}`);
	} else if (type === 'success') {
		alert(`Success: ${message}`);
	} else if (type === 'warning') {
		alert(`Warning: ${message}`);
	} else {
		alert(`Info: ${message}`);
	}
} 