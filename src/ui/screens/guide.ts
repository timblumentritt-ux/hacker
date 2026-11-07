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
        h('li', null, 'After each swing, jot the swing type and rating (1 to 5) in the Notes app, plus where the ball went if you like. Hacker lists clips oldest first, so they line up with your notes.'),
      ),
      h('h2', null, '3. Move the videos'),
      h('p', null, 'At the computer, AirDrop the videos to the Mac (or use a cable, or iCloud Photos on a PC), then drop them on the Upload screen.'),
      h('h2', null, 'On the course, without the frame sheet page'),
      h('p', null, 'Pause the video at address, top, impact, and finish, take a screenshot at each, and attach the four screenshots to your Claude chat.'),
    );
  },
};
