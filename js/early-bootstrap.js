        window.__p3dEarlyLogs = [];
        window.addEventListener('error', (e) => {
            let msg;
            if (e.target && e.target !== window && (e.target.src || e.target.href)) {
                msg = `Failed to load resource: ${(e.target.src || e.target.href).split('/').pop()}`;
            } else {
                msg = `JS Error: ${e.message || e.type} (${e.filename ? e.filename.split('/').pop() : 'inline'}:${e.lineno || 0})`;
            }
            window.__p3dEarlyLogs.push(msg);
            const el = document.getElementById('mobileDebugLog');
            if (el) el.textContent += `\n[ERR] ${msg}`;
        }, true);
        window.addEventListener('unhandledrejection', (e) => {
            const msg = `Promise Error: ${e.reason && (e.reason.message || e.reason)}`;
            window.__p3dEarlyLogs.push(msg);
            const el = document.getElementById('mobileDebugLog');
            if (el) el.textContent += `\n[ERR] ${msg}`;
        });
        (() => {
            const p = new URLSearchParams(window.location.search);
            if (p.has('phone-steer') || p.has('steer')) {
                document.documentElement.classList.add('phone-steer-mode');
            }
        })();
