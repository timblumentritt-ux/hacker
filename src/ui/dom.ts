// Tiny helpers for building placeholder screens without a framework.

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: HTMLElement): void {
  el.replaceChildren();
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

/** A simple modal with buttons. Resolves with the chosen button's value, or null if closed with Esc. */
export function choose(title: string, message: string | Node, buttons: { label: string; value: string; primary?: boolean }[]): Promise<string | null> {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog' },
      h('h3', null, title),
      typeof message === 'string' ? h('p', null, message) : message,
      h('div', { class: 'row' }, buttons.map((b) =>
        h('button', { class: b.primary ? 'primary' : '', onclick: () => { dlg.close(b.value); } }, b.label))),
    );
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(dlg.returnValue || null);
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

export async function confirmAction(title: string, message: string | Node, okLabel: string): Promise<boolean> {
  return (await choose(title, message, [
    { label: 'Cancel', value: 'cancel' },
    { label: okLabel, value: 'ok', primary: true },
  ])) === 'ok';
}

export function download(fileName: string, data: Blob): void {
  const url = URL.createObjectURL(data);
  const a = h('a', { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
