import './ui/style.css';
import { startApp } from './ui/app';
import { requestPersistence } from './lib/storage';
import { flushVideoDeletes } from './lib/store';

startApp(document.getElementById('app')!);

// Ask the browser to keep Hacker's data, and finish any video deletes left from last time.
requestPersistence().catch(() => {});
flushVideoDeletes().catch(() => {});
