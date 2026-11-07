// First use: name and right or left hand.
import type { Screen } from '../app';
import { go } from '../app';
import { h } from '../dom';
import { setProfile } from '../../lib/store';
import type { Handedness } from '../../lib/ballResult';

export function profileFields(initial?: { name: string; handedness: Handedness }) {
  const name = h('input', { type: 'text', value: initial?.name ?? '', placeholder: 'Your name', required: true });
  const right = h('input', { type: 'radio', name: 'hand', value: 'right', checked: (initial?.handedness ?? 'right') === 'right' });
  const left = h('input', { type: 'radio', name: 'hand', value: 'left', checked: initial?.handedness === 'left' });
  const el = h('div', null,
    h('p', null, h('label', null, 'Name ', name)),
    h('p', null, 'I swing ', h('label', null, right, ' right-handed'), ' ', h('label', null, left, ' left-handed')),
  );
  return {
    el,
    value: () => ({ name: name.value.trim(), handedness: (left.checked ? 'left' : 'right') as Handedness }),
    focus: () => name.focus(),
  };
}

export const welcomeScreen: Screen = {
  title: 'Welcome',
  mount(root) {
    const fields = profileFields();
    const error = h('p', { class: 'error' });
    const form = h('form', {
      class: 'card',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const p = fields.value();
        if (!p.name) {
          error.textContent = 'Please enter your name.';
          return;
        }
        await setProfile(p);
        go('library');
      },
    },
      h('h1', null, 'Welcome to Hacker'),
      h('p', null, 'Hacker keeps everything in this browser. There is no account and nothing is uploaded anywhere.'),
      fields.el,
      error,
      h('button', { type: 'submit', class: 'primary' }, 'Start'),
    );
    root.append(form);
    fields.focus();
  },
};
