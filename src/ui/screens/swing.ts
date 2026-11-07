// Swing detail: labels, ball result, note, model swing, delete, and the kept video.
import type { Screen } from '../app';
import { go } from '../app';
import { confirmAction, formatDate, h } from '../dom';
import {
  allSwings, applyLabelChange, clearModel, deleteSwing, getProfile, getSettings, getSwing, previewLabelChange, setModel,
  flushVideoDeletes, type LabelChange,
} from '../../lib/store';
import { RATINGS, SWING_TYPES, parseSwingTypeId, type Rating, isSwingTypeId } from '../../lib/swingTypes';
import { BALL_RESULTS, ballResultHint, ballResultLabel, isBallResult } from '../../lib/ballResult';
import { codecName } from '../../lib/mp4';
import { tierFor, tierLabel } from '../../lib/quality';
import * as folder from '../../lib/videoFolder';
import type { Swing } from '../../lib/types';

async function videoSection(swing: Swing, remount: () => void): Promise<Node> {
  const box = h('div', { class: 'card' }, h('h2', null, 'Video'));
  if (!swing.videoFileName) {
    const settings = await getSettings();
    box.append(h('p', { class: 'muted' },
      settings.keepVideo === 'model-only' && !swing.isModel
        ? 'Not kept: Settings keeps video only for model 5 swings.'
        : 'No video kept for this swing. Skeleton playback arrives in milestone 4.'));
    return box;
  }
  const st = await folder.getStatus();
  if (st.state !== 'ready') {
    box.append(
      h('p', { class: 'warn' }, 'The video folder is not connected, so the video cannot be shown.'),
      st.state === 'needs-permission' || st.state === 'error'
        ? h('button', { onclick: async () => { await folder.reconnect(); await flushVideoDeletes(); remount(); } }, 'Reconnect folder')
        : '',
    );
    return box;
  }
  const file = await folder.readFile(swing.videoFileName);
  if (!file) {
    box.append(h('p', { class: 'warn' }, `The video file ${swing.videoFileName} is missing from the video folder. Skeleton playback arrives in milestone 4.`));
    return box;
  }
  const url = URL.createObjectURL(file);
  const video = h('video', { src: url, controls: true, muted: true, playsInline: true, style: 'max-width: 100%; max-height: 520px; background: #000' });
  video.addEventListener('error', () => box.append(h('p', { class: 'warn' }, 'This browser cannot play this video.')));
  const speed = h('select', { onchange: () => (video.playbackRate = Number(speed.value)) },
    ['1', '0.5', '0.25', '0.125'].map((s) => h('option', { value: s }, `${s}×`)));
  box.append(video, h('div', { class: 'row' }, 'Speed ', speed));
  return box;
}

export const swingScreen: Screen = {
  title: 'Swing',
  async mount(root, [id]) {
    const swing = await getSwing(id);
    if (!swing) {
      root.append(h('p', null, 'This swing is no longer stored. ', h('a', { href: '#/library' }, 'Back to the Library')));
      return;
    }
    const remount = () => { root.replaceChildren(); void swingScreen.mount(root, [id]); };
    const hand = (await getProfile())?.handedness ?? 'right';
    const type = parseSwingTypeId(swing.swingType);
    const message = h('p', { class: 'warn' });

    // Label editor
    const typeSel = h('select', null, SWING_TYPES.map((t) => h('option', { value: t.id, selected: t.id === swing.swingType }, t.label)));
    const ratingSel = h('select', null, RATINGS.map((r) => h('option', { value: String(r), selected: r === swing.rating }, String(r))));
    const resultSel = h('select', null,
      h('option', { value: '' }, '—'),
      BALL_RESULTS.map((r) => h('option', { value: r.id, selected: r.id === swing.ballResult, title: ballResultHint(r.id, hand) }, r.label)));
    const noteInput = h('input', { type: 'text', value: swing.note, style: 'width: 320px' });

    const saveLabels = async () => {
      if (!isSwingTypeId(typeSel.value)) return;
      const change: LabelChange = {
        swingType: typeSel.value,
        rating: Number(ratingSel.value) as Rating,
        ballResult: isBallResult(resultSel.value) ? resultSel.value : null,
        note: noteInput.value.trim(),
      };
      const plan = await previewLabelChange(id, change);
      const warnings: string[] = [];
      if (plan.losesModel) warnings.push('This swing stops being the model 5 swing for its swing type.');
      if (plan.selfDropped) warnings.push('The new set already holds five newer swings, so this swing will be deleted.');
      if (plan.evicted.length) warnings.push(`The new set is full, so the oldest swing${plan.evicted.length > 1 ? 's' : ''} there (${plan.evicted.map((s) => formatDate(s.recordedAt)).join(', ')}) will be deleted, with ${plan.evicted.length > 1 ? 'their videos' : 'its video'}.`);
      if (warnings.length && !(await confirmAction('Change this swing?', warnings.join(' '), plan.selfDropped || plan.evicted.length ? 'Change and delete' : 'Change'))) return;
      await applyLabelChange(id, change);
      if (plan.selfDropped) go(`set/${change.swingType}/${change.rating}`);
      else remount();
    };

    // Model swing
    const modelBox = h('div', { class: 'row' });
    if (swing.isModel) {
      modelBox.append(h('strong', null, `★ This is your model 5 swing for ${type.label}.`),
        h('button', { onclick: async () => { await clearModel(id); remount(); } }, 'Stop using as model swing'));
    } else if (swing.rating === 5) {
      modelBox.append(h('button', {
        onclick: async () => {
          const current = (await allSwings()).find((s) => s.swingType === swing.swingType && s.isModel);
          if (current && !(await confirmAction('Make this your model swing?',
            `This replaces your current model 5 swing for ${type.label}, recorded ${formatDate(current.recordedAt)}. That swing becomes an ordinary 5-rated swing and can be replaced by newer ones.`,
            'Make this my model swing'))) return;
          await setModel(id);
          remount();
        },
      }, 'Make this my model swing'));
    } else {
      modelBox.append(h('span', { class: 'muted' }, 'Only a 5-rated swing can be the model swing.'));
    }

    const tier = tierFor(swing.frameRate);
    root.append(
      h('p', null, h('a', { href: `#/set/${swing.swingType}/${swing.rating}` }, `← ${type.label}, rated ${swing.rating}`)),
      h('h1', null, `${type.label}, rated ${swing.rating}${swing.isModel ? ' ★' : ''}`),
      h('dl', { class: 'facts' },
        h('dt', null, 'Recorded'), h('dd', null, formatDate(swing.recordedAt), swing.recordedAtSource === 'file-date' ? h('span', { class: 'muted' }, ' (file date)') : ''),
        h('dt', null, 'Uploaded'), h('dd', null, formatDate(swing.uploadedAt)),
        h('dt', null, 'File'), h('dd', null, swing.fileName),
        h('dt', null, 'Ball result'), h('dd', null, swing.ballResult ? `${ballResultLabel(swing.ballResult)}: ${ballResultHint(swing.ballResult, hand)}` : '—'),
        h('dt', null, 'Note'), h('dd', null, swing.note || '—'),
        h('dt', null, 'Video'), h('dd', null, `${swing.width ?? '?'}×${swing.height ?? '?'}, ${codecName(swing.codec)}, ${swing.frameRate ? Math.round(swing.frameRate) + ' fps' : 'fps unknown'} (${tierLabel(tier)}), ${swing.durationSec ?? '?'} s`),
        h('dt', null, 'Camera'), h('dd', null, 'Face-on'),
      ),
      h('div', { class: 'card' }, h('h2', null, 'Model swing'), modelBox),
      h('div', { class: 'card' },
        h('h2', null, 'Change labels'),
        h('div', { class: 'row' },
          h('label', null, 'Swing type ', typeSel), h('label', null, 'Rating ', ratingSel),
          h('label', null, 'Result ', resultSel), h('label', null, 'Note ', noteInput),
          h('button', { class: 'primary', onclick: saveLabels }, 'Save changes')),
        message),
      await videoSection(swing, remount),
      h('div', { class: 'card muted' }, 'Frame sheet and metrics arrive in milestones 2 and 3.'),
      h('div', { class: 'card' },
        h('button', {
          onclick: async () => {
            if (!(await confirmAction('Delete this swing?',
              `This permanently deletes the swing${swing.videoFileName ? ' and its kept video' : ''}. The original video on your phone or computer is not touched.`,
              'Delete'))) return;
            await deleteSwing(id);
            go(`set/${swing.swingType}/${swing.rating}`);
          },
        }, 'Delete swing')),
    );
  },
};
