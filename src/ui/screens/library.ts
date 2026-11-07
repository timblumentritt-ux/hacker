// Library: the eight swing types by the five ratings, with how full each set is.
import type { Screen } from '../app';
import { h } from '../dom';
import { allSwings, uploadCounts, UNLOCK_UPLOADS } from '../../lib/store';
import { RATINGS, SWING_TYPES } from '../../lib/swingTypes';
import { SET_SIZE } from '../../lib/rolling';

export const libraryScreen: Screen = {
  title: 'Library',
  async mount(root) {
    const [swings, counts] = await Promise.all([allSwings(), uploadCounts()]);
    const ratingsHigh = [...RATINGS].reverse();

    const rows = SWING_TYPES.map((t) => {
      const ofType = swings.filter((s) => s.swingType === t.id);
      const uploads = counts[t.id];
      const unlocked = uploads >= UNLOCK_UPLOADS;
      return h('tr', null,
        h('th', null, t.label),
        ratingsHigh.map((r) => {
          const inSet = ofType.filter((s) => s.rating === r);
          const hasModel = inSet.some((s) => s.isModel);
          return h('td', { class: `cell ${inSet.length === SET_SIZE ? 'full' : ''}` },
            h('a', { href: `#/set/${t.id}/${r}`, title: `${t.label}, rated ${r}` },
              `${inSet.length}/${SET_SIZE}`, hasModel ? ' ★' : ''));
        }),
        h('td', null, String(uploads)),
        h('td', { class: unlocked ? 'good' : 'muted' },
          unlocked ? 'Compare and export unlocked' : `${UNLOCK_UPLOADS - uploads} more upload${UNLOCK_UPLOADS - uploads === 1 ? '' : 's'} to unlock`),
      );
    });

    root.append(
      h('h1', null, 'Library'),
      h('p', { class: 'muted' }, `Hacker keeps the ${SET_SIZE} newest swings for each swing type at each rating. ★ marks the set holding the model 5 swing.`),
      h('table', { class: 'grid' },
        h('thead', null, h('tr', null, h('th', null, 'Swing type'), ratingsHigh.map((r) => h('th', null, `Rated ${r}`)), h('th', null, 'Uploads'), h('th', null, 'Status'))),
        h('tbody', null, rows),
      ),
      h('p', null, `${swings.length} swings stored. `, h('a', { href: '#/upload' }, 'Upload swings')),
    );
  },
};
