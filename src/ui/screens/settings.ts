// Settings: profile, storage, video folder, and exports.
import type { Screen } from '../app';
import { confirmAction, download, h } from '../dom';
import { profileFields } from './welcome';
import {
  allSwings, flushVideoDeletes, getProfile, getSettings, setKeepVideo, setProfile, videosOutsideModels,
} from '../../lib/store';
import { formatBytes, requestPersistence, storageInfo } from '../../lib/storage';
import { metricsCsv } from '../../lib/csv';
import * as folder from '../../lib/videoFolder';

export const settingsScreen: Screen = {
  title: 'Settings',
  async mount(root) {
    const remount = () => { root.replaceChildren(); void settingsScreen.mount(root, []); };

    // Profile
    const profile = await getProfile();
    const fields = profileFields(profile);
    const profileMsg = h('span', { class: 'good' });
    const profileCard = h('div', { class: 'card' },
      h('h2', null, 'Profile'),
      fields.el,
      h('div', { class: 'row' },
        h('button', {
          class: 'primary',
          onclick: async () => {
            const p = fields.value();
            if (!p.name) { profileMsg.textContent = 'Please enter a name.'; return; }
            await setProfile(p);
            profileMsg.textContent = 'Saved.';
          },
        }, 'Save profile'),
        profileMsg),
    );

    // Storage
    const info = await storageInfo();
    const storageCard = h('div', { class: 'card' },
      h('h2', null, 'Storage in this browser'),
      h('p', null, `Used: ${formatBytes(info.usageBytes)} of about ${formatBytes(info.quotaBytes)} available.`),
      info.persisted
        ? h('p', { class: 'good' }, 'Persistent storage is on: the browser will not clear Hacker\'s data on its own.')
        : h('div', null,
            h('p', { class: 'warn' }, 'Persistent storage is not on yet. Chrome and Edge decide this themselves; bookmarking Hacker and using it often usually turns it on.'),
            h('button', { onclick: async () => { await requestPersistence(); remount(); } }, 'Ask the browser again')),
    );

    // Video folder
    const st = await folder.getStatus();
    const settings = await getSettings();
    const folderCard = h('div', { class: 'card' }, h('h2', null, 'Video folder'));
    if (st.state === 'unsupported') {
      folderCard.append(h('p', { class: 'warn' }, st.message), h('p', null, 'Without a folder, no video is kept and playback will use skeleton figures.'));
    } else {
      const sizeLine = h('p', { class: 'muted' });
      folderCard.append(
        h('p', null, 'Hacker can keep each saved swing\'s video in a folder on this computer. It creates a subfolder named ',
          h('strong', null, folder.SUBFOLDER), ' and never touches any other file.'),
        st.state === 'none' ? h('p', null, 'No folder chosen, so no video is kept.') : '',
        st.state === 'ready' ? h('p', { class: 'good' }, `Connected: "${st.name}/${folder.SUBFOLDER}".`) : '',
        st.state === 'needs-permission' ? h('p', { class: 'warn' }, `"${st.name}" needs permission again (browsers ask on a new visit).`) : '',
        st.state === 'error' ? h('p', { class: 'error' }, `"${st.name}" cannot be opened: ${st.message}`) : '',
        sizeLine,
        h('div', { class: 'row' },
          h('button', { class: st.state === 'none' ? 'primary' : '', onclick: async () => { await folder.chooseFolder(); await flushVideoDeletes(); remount(); } },
            st.state === 'none' ? 'Choose video folder' : 'Choose a different folder'),
          st.state === 'needs-permission' || st.state === 'error'
            ? h('button', { class: 'primary', onclick: async () => { await folder.reconnect(); await flushVideoDeletes(); remount(); } }, 'Reconnect folder')
            : '',
          st.state !== 'none'
            ? h('button', { onclick: async () => {
                if (await confirmAction('Stop using this folder?', 'Hacker will stop keeping videos. Files already in the folder are left where they are.', 'Stop using folder')) {
                  await folder.forgetFolder();
                  remount();
                }
              } }, 'Stop using folder')
            : '',
        ),
        h('h3', null, 'Which videos to keep'),
        h('label', null, h('input', {
          type: 'radio', name: 'keep', checked: settings.keepVideo === 'all',
          onchange: async () => { await setKeepVideo('all'); remount(); },
        }), ' All saved swings (about 5 to 10 GB at most)'),
        h('br'),
        h('label', null, h('input', {
          type: 'radio', name: 'keep', checked: settings.keepVideo === 'model-only',
          onchange: async (e: Event) => {
            const extra = await videosOutsideModels();
            if (extra.length && !(await confirmAction('Keep only model 5 videos?',
              `This deletes the kept videos of ${extra.length} swing${extra.length > 1 ? 's' : ''} that are not model 5 swings. The swings themselves stay.`, 'Delete those videos'))) {
              (e.target as HTMLInputElement).checked = false;
              remount();
              return;
            }
            await setKeepVideo('model-only');
            remount();
          },
        }), ' Only model 5 swings (about 200 to 400 MB)'),
      );
      if (st.state === 'ready') {
        sizeLine.textContent = 'Measuring folder size…';
        folder.folderSize().then((s) => (sizeLine.textContent = s ? `The folder holds ${s.files} file${s.files === 1 ? '' : 's'}, ${formatBytes(s.bytes)}.` : ''));
      }
    }

    // Exports
    const exportCard = h('div', { class: 'card' },
      h('h2', null, 'Backup and exports'),
      h('div', { class: 'row' },
        h('button', {
          onclick: async () => {
            const csv = metricsCsv(await allSwings(), []);
            download(`hacker-metrics-${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv' }));
          },
        }, 'Download metrics CSV'),
      ),
      h('p', { class: 'muted' }, 'Metrics arrive in milestone 3; for now the CSV has one row per swing with its labels and ball result. Backup and restore arrive in milestone 5.'),
    );

    root.append(h('h1', null, 'Settings'), profileCard, storageCard, folderCard, exportCard);
  },
};
