// First use, and adding another golfer: name and right or left hand.
import type { Screen } from '../app';
import { go } from '../app';
import { h } from '../dom';
import { createProfile, listProfiles } from '../../lib/profiles';
import type { Handedness } from '../../lib/ballResult';
import { resetUploadBatch, uploadBusy } from './upload';

export function profileFields(initial?: { name: string; handedness: Handedness }) {
  const name = h('input', { type: 'text', value: initial?.name ?? '', placeholder: 'Your name', required: true, maxLength: 60 });
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
  title: 'New golfer',
  async mount(root) {
    const others = await listProfiles();
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
        if (uploadBusy()) {
          error.textContent = 'Wait for the current upload to finish first.';
          return;
        }
        resetUploadBatch();
        await createProfile(p);
        go('library');
      },
    },
      others.length ? h('p', null, h('a', { href: '#/profiles' }, '← Profiles')) : '',
      h('h1', null, others.length ? 'Add a golfer' : 'Welcome to Hacker'),
      others.length ? '' : h('p', null, 'Hacker helps you compare each swing with your own best swings, and prepares a briefing for a Claude chat before a round.'),
      h('p', null, 'Your swings stay on this computer, in this browser. Nothing is uploaded and there is no account or password.'),
      fields.el,
      error,
      h('button', { type: 'submit', class: 'primary' }, others.length ? 'Add golfer' : 'Start'),
      h('p', { class: 'muted' }, 'Sharing this computer? Each golfer can add a profile and switch between them. Profiles have no password, so anyone using this browser can open them.'),
    );
    root.append(form);
    fields.focus();
  },
};
