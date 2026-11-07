import './ui/style.css';
import { startApp } from './ui/app';
import { requestPersistence } from './lib/storage';

void startApp(document.getElementById('app')!);

// Ask the browser to keep Hacker's data.
requestPersistence().catch(() => {});
