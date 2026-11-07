// App shell and hash router. Each screen sits behind the Screen interface,
// so Claude Design's screens can replace these placeholders without touching src/lib.

import { getProfile } from '../lib/store';
import { h } from './dom';
import { welcomeScreen } from './screens/welcome';
import { libraryScreen } from './screens/library';
import { setScreen } from './screens/set';
import { uploadScreen } from './screens/upload';
import { swingScreen } from './screens/swing';
import { settingsScreen } from './screens/settings';
import { guideScreen } from './screens/guide';
import { diagnosticsScreen } from './screens/diagnostics';

/** A screen draws into root. It may return a cleanup function that runs when the golfer leaves. */
export interface Screen {
  title: string;
  mount(root: HTMLElement, params: string[]): void | (() => void) | Promise<void | (() => void)>;
}

const ROUTES: Record<string, Screen> = {
  welcome: welcomeScreen,
  library: libraryScreen,
  set: setScreen,
  upload: uploadScreen,
  swing: swingScreen,
  settings: settingsScreen,
  guide: guideScreen,
  diagnostics: diagnosticsScreen,
};

const NAV: [string, string][] = [
  ['library', 'Library'],
  ['upload', 'Upload'],
  ['settings', 'Settings'],
  ['guide', 'Recording guide'],
  ['diagnostics', 'Diagnostics'],
];

export function go(path: string): void {
  location.hash = `#/${path}`;
}

let cleanup: (() => void) | void = undefined;

export function startApp(container: HTMLElement): void {
  const nav = h('nav', { class: 'nav' },
    h('strong', { class: 'brand' }, 'Hacker'),
    NAV.map(([path, label]) => h('a', { href: `#/${path}`, 'data-path': path }, label)),
  );
  const main = h('main', { class: 'main' });
  container.replaceChildren(nav, main);

  // Each navigation gets a number. If the golfer navigates again while a screen is still loading,
  // the older screen is thrown away, so two screens never run at once.
  let latest = 0;
  const render = async () => {
    const mine = ++latest;
    const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const profile = await getProfile();
    if (mine !== latest) return;
    if (!profile && name !== 'welcome' && name !== 'diagnostics') return go('welcome');
    if (profile && name === 'welcome') return go('library');
    const screen = ROUTES[name];
    if (!screen) return go(profile ? 'library' : 'welcome');

    if (cleanup) cleanup();
    cleanup = undefined;
    for (const a of nav.querySelectorAll('a')) a.classList.toggle('active', a.dataset.path === name);
    nav.hidden = !profile;
    const page = h('div');
    main.replaceChildren(page);
    document.title = `${screen.title} – Hacker`;
    try {
      const done = await screen.mount(page, params);
      if (mine === latest) cleanup = done;
      else if (done) done();
    } catch (e) {
      page.append(h('p', { class: 'error' }, `Something went wrong: ${e instanceof Error ? e.message : String(e)}`));
      console.error(e);
    }
  };
  window.addEventListener('hashchange', render);
  render();
}
