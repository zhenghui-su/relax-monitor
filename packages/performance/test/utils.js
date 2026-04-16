const logEl = document.getElementById('log');

window.log = function (msg, data) {
	const entry = document.createElement('div');
	entry.className = 'log-entry';
	const time = new Date().toLocaleTimeString();
	const dataStr = data ? ` ${JSON.stringify(data)}` : '';
	entry.textContent = `[${time}] ${msg}${dataStr}`;

	if (logEl) {
		logEl.appendChild(entry);
		logEl.scrollTop = logEl.scrollHeight;
	}
	console.log(`[TestPage] ${msg}`, data || '');
};

// --- SDK Initialization ---
function initSDK() {
	try {
		if (window.relaxworkPerformanceMonitor) {
			const PerformanceMonitor = window.relaxworkPerformanceMonitor;
			const monitor = new PerformanceMonitor({
				log: true,
			});
			monitor.init();

			const statusEl = document.getElementById('status');
			if (statusEl) {
				statusEl.textContent = '✅ SDK 初始化成功';
				statusEl.className = 'status-ok';
			}
			window.log('SDK initialized.');
		} else {
			throw new Error('window.relaxworkPerformanceMonitor is undefined');
		}
	} catch (e) {
		const statusEl = document.getElementById('status');
		if (statusEl) {
			statusEl.textContent = '❌ SDK 初始化失败: ' + e.message;
			statusEl.className = 'status-err';
		}
		window.log('Error initializing SDK:', e);
	}
}

// Initialize immediately
initSDK();
