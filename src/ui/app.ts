// App shell and hash router. Each screen sits behind the Screen interface,
// so Claude Design's screens can replace these placeholders without touching src/lib.

import { activeProfile, initProfiles, listProfiles } from '../lib/profiles';
import { flushVideoDeletes } from '../lib/store';
import { h } from './dom';
import { welcomeScreen } from './screens/welcome';
import { profilesScreen } from './screens/profiles';
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
  profiles: profilesScreen,
  library: libraryScreen,
  set: setScreen,
  upload: uploadScreen,
  swing: swingScreen,
  settings: settingsScreen,
  guide: guideScreen,
  diagnostics: diagnosticsScreen,
};

/** Screens that work without a golfer profile. */
const OPEN_ROUTES = new Set(['welcome', 'profiles', 'diagnostics', 'guide']);

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

/** Hacker is built for current Chrome and Edge on a computer. Returns a warning for anything else. */
export function browserWarning(): string | null {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Android|Mobile/.test(ua)) {
    return 'Hacker is built for Chrome or Edge on a Mac or Windows computer. On a phone, only the frame sheet page (coming later) is meant to be used.';
  }
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands ?? [];
  const chromium = brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand)) || /Chrome\/|Edg\//.test(ua);
  if (!chromium) {
    return 'Hacker is built for current Chrome or Edge. In this browser some parts, such as keeping videos in a folder, will not work.';
  }
  return null;
}

let cleanup: (() => void) | void = undefined;

export async function startApp(container: HTMLElement): Promise<void> {
  const warning = browserWarning();
  const nav = h('nav', { class: 'nav' });
  const main = h('main', { class: 'main' });
  container.replaceChildren(warning ? h('div', { class: 'banner' }, warning) : '', nav, main);

  try {
    await initProfiles();
  } catch (e) {
    main.append(h('p', { class: 'error' }, `Hacker could not open its storage in this browser: ${e instanceof Error ? e.message : String(e)}. Private or incognito windows may block it.`));
    return;
  }
  flushVideoDeletes().catch(() => {});

  const drawNav = (name: string) => {
    const profile = activeProfile();
    nav.hidden = !profile;
    nav.replaceChildren(
      h('strong', { class: 'brand' }, 'Hacker'),
      ...NAV.map(([path, label]) => h('a', { href: `#/${path}`, class: path === name ? 'active' : '' }, label)),
      h('span', { class: 'spacer' }),
      profile ? h('a', { href: '#/profiles', class: name === 'profiles' ? 'active' : '', title: 'Switch golfer' }, `Golfer: ${profile.name}`) : '',
    );
  };

  // Each navigation gets a number. If the golfer navigates again while a screen is still loading,
  // the older screen is thrown away, so two screens never run at once.
  let latest = 0;
  const render = async () => {
    const mine = ++latest;
    const [name, ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const profile = activeProfile();
    if (!profile && !OPEN_ROUTES.has(name)) {
      const any = (await listProfiles()).length > 0;
      if (mine === latest) go(any ? 'profiles' : 'welcome');
      return;
    }
    const screen = ROUTES[name];
    if (!screen) return go(profile ? 'library' : 'welcome');

    if (cleanup) cleanup();
    cleanup = undefined;
    drawNav(name);
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
  await render();
}
