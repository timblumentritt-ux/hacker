// Profiles: the golfers using this browser. Switch between them or add one.
import type { Screen } from '../app';
import { go } from '../app';
import { h } from '../dom';
import { activeProfile, listProfiles, switchProfile } from '../../lib/profiles';
import { flushVideoDeletes } from '../../lib/store';
import { resetUploadBatch, uploadBusy } from './upload';

export const profilesScreen: Screen = {
  title: 'Profiles',
  async mount(root) {
    const profiles = await listProfiles();
    const current = activeProfile();
    const message = h('p', { class: 'warn' });

    const use = async (id: string) => {
      if (uploadBusy()) {
        message.textContent = 'An upload is still running for the current golfer. Wait for it to finish, then switch.';
        return;
      }
      resetUploadBatch();
      await switchProfile(id);
      flushVideoDeletes().catch(() => {});
      go('library');
    };

    root.append(
      h('h1', null, 'Who is swinging?'),
      profiles.length === 0
        ? h('p', null, 'No golfers yet. ', h('a', { href: '#/welcome' }, 'Add the first one'))
        : h('table', null,
            h('thead', null, h('tr', null, h('th', null, 'Golfer'), h('th', null, 'Hand'), h('th', null, ''))),
            h('tbody', null, profiles.map((p) => h('tr', null,
              h('td', null, p.name),
              h('td', null, p.handedness === 'left' ? 'Left-handed' : 'Right-handed'),
              h('td', null, p.id === current?.id
                ? h('strong', null, 'Current golfer')
                : h('button', { class: 'primary', onclick: () => use(p.id) }, `Use ${p.name}`)),
            ))),
          ),
      message,
      h('p', null, h('a', { href: '#/welcome' }, '+ Add a golfer')),
      h('p', { class: 'muted' },
        "Each golfer's swings are kept apart. Profiles have no password, so anyone using this browser can open them. ",
        'To delete a profile, switch to it and use Settings.'),
    );
  },
};
