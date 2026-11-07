// Recording guide (placeholder text; finished in milestone 7).
import type { Screen } from '../app';
import { h } from '../dom';

export const guideScreen: Screen = {
  title: 'Recording guide',
  mount(root) {
    root.append(
      h('h1', null, 'Recording guide'),
      h('h2', null, '1. Set up'),
      h('ul', null,
        h('li', null, "Put the iPhone on a small tripod facing your chest (face-on), about 90° to the target line."),
        h('li', null, 'Make sure your whole body and your finish stay in the frame.'),
        h('li', null, 'In the Camera app, choose Slo-mo. In Settings → Camera → Record Slo-mo, choose 1080p at 240 fps.'),
        h('li', null, 'If your PC cannot play the videos, set Settings → Camera → Formats to Most Compatible.'),
      ),
      h('h2', null, '2. Film'),
      h('ul', null,
        h('li', null, 'Record one swing per clip.'),
        h('li', null, 'After each swing, write one short line in the Notes app (shorthand below). Hacker lists clips oldest first, so your lines and the clips line up.'),
      ),
      h('h2', null, 'Swing shorthand'),
      h('p', null, 'Club, then the rating from 1 (worst) to 5 (best), then where the ball went if you like. Anything after that is your own note.'),
      h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'You type'), h('th', null, 'Hacker reads'))),
        h('tbody', null, ([
          ['D 4 slice', 'Drive, rated 4, slice'],
          ['F 3', 'Fairway wood or hybrid, rated 3'],
          ['L 5 solid', '4/5/6 iron, rated 5, solid'],
          ['M 5', '7/8/9 iron, full, rated 5'],
          ['M3/4 4 pull', '7/8/9 iron, three-quarters, rated 4, pull'],
          ['W 2 fat chunked it', 'Wedge, full, rated 2, fat, note "chunked it"'],
          ['C 5', 'Chip, rated 5'],
        ] as const).map(([a, b]) => h('tr', null, h('td', null, h('code', null, a)), h('td', null, b)))),
      ),
      h('ul', null,
        h('li', null, 'Clubs: D drive, F fairway wood or hybrid, L 4/5/6 iron (and 3-iron), M 7/8/9 iron, W wedge, C chip. You can also type driver, 7i, 5i, 3w, hybrid, PW, SW.'),
        h('li', null, 'Three-quarter swing: add 3/4 after M or W, as in M3/4 or W 3/4.'),
        h('li', null, 'Results: solid, pull, push, slice, hook, fat, thin.'),
        h('li', null, 'Capitals, extra spaces, and list numbers from Notes do not matter. Hacker points out any line it cannot read.'),
      ),
      h('p', null, 'At the computer, drop the videos on the Upload screen, open "Paste notes from your phone", and paste all the lines at once.'),
      h('p', { class: 'muted' }, 'You can also try typing the shorthand as the video\'s caption in the Photos app. If the caption travels with the video, Hacker fills in that clip by itself.'),
      h('h2', null, '3. Move the videos'),
      h('p', null, 'At the computer, AirDrop the videos to the Mac (or use a cable, or iCloud Photos on a PC), then drop them on the Upload screen.'),
      h('h2', null, 'On the course, without the frame sheet page'),
      h('p', null, 'Pause the video at address, top, impact, and finish, take a screenshot at each, and attach the four screenshots to your Claude chat.'),
    );
  },
};
