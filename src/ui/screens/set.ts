// One rolling set: the swings stored for one swing type at one rating.
import type { Screen } from '../app';
import { formatDate, h } from '../dom';
import { allSwings } from '../../lib/store';
import { isRating, isSwingTypeId, parseSwingTypeId } from '../../lib/swingTypes';
import { newestFirst, SET_SIZE } from '../../lib/rolling';
import { ballResultLabel } from '../../lib/ballResult';

export const setScreen: Screen = {
  title: 'Set',
  async mount(root, [typeId, ratingText]) {
    const rating = Number(ratingText);
    if (!isSwingTypeId(typeId) || !isRating(rating)) {
      root.append(h('p', { class: 'error' }, 'Unknown set.'));
      return;
    }
    const type = parseSwingTypeId(typeId);
    const swings = (await allSwings()).filter((s) => s.swingType === typeId && s.rating === rating).sort(newestFirst);
    root.append(
      h('p', null, h('a', { href: '#/library' }, '← Library')),
      h('h1', null, `${type.label}, rated ${rating} (${swings.length}/${SET_SIZE})`),
      swings.length === 0
        ? h('p', { class: 'muted' }, 'No swings in this set yet.')
        : h('table', null,
            h('thead', null, h('tr', null, ['Recorded', 'File', 'Result', 'Note', 'Video', 'Model'].map((t) => h('th', null, t)))),
            h('tbody', null, swings.map((s) => h('tr', null,
              h('td', null, h('a', { href: `#/swing/${s.id}` }, formatDate(s.recordedAt))),
              h('td', null, s.fileName),
              h('td', null, ballResultLabel(s.ballResult)),
              h('td', null, s.note),
              h('td', null, s.videoFileName ? 'kept' : ''),
              h('td', null, s.isModel ? '★ model 5' : ''),
            ))),
          ),
    );
  },
};
