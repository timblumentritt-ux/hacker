# Hacker: Golf Swing Coach Web App, Project Spec for Claude Code

Project spec for Claude Code, written with the owner (Tim)

## The gist

Build a web app called Hacker that runs in a desktop browser on a MacBook or PC. The golfer films swings with his iPhone's Camera app and, later, uploads the videos at a computer. Hacker measures each swing's body motion, keeps a small rolling set of swings, and prepares a briefing that he pastes into a Claude chat before a round. During the round he sends Claude one image from a new swing and gets a quick review of what he is doing right and wrong.

- **Who:** built first for the owner and designed for golfers with 10 to 20 handicaps, who can fix a problem once they see it but are not yet consistent. The site is public, so any golfer can use it; each golfer's swings stay in their own browser. The owner has no web development background and wants Claude Code to write and build the app.
- **Why a web app:** an iPhone app on a free Apple account must be reinstalled every week, which the owner will not accept. A web app has nothing to install or sign.
- **How swings get in:** the golfer records with the iPhone Camera app in slow motion (1080p, 240 fps), face-on. At a computer he uploads the videos and labels each one with a swing type and a rating from 1 to 5 (5 best).
- **Analysis:** it all happens in the browser on the computer, with no server. A pose model finds the body joints in every frame, and the app finds the swing phases and computes a handful of body metrics.
- **Rolling sets:** for each swing type and each rating, the app keeps the five newest swings. It keeps each swing's data and a picture sheet. If the owner chooses a video folder on his computer, it also keeps each swing's video there.
- **Model 5 swing:** for each swing type, one 5-rated swing is the best example of a great swing. Hacker suggests it, and the golfer can change it.
- **Before a round:** the golfer exports a briefing: for each swing type, the model 5 swing's data and picture, plus his typical misses. He pastes it into a new Claude chat.
- **On the course:** he films a swing, turns the video into one image (a frame sheet) on his iPhone, attaches it to the Claude chat, and asks for a review. Claude compares it with the model 5 swing, likens it to one of his typical misses, and suggests adjustments and a swing thought. Hacker keeps nothing from this step.
- **Why an image, not the video:** Claude chat cannot read video files. It reads images, so a frame sheet bridges the gap.
- **Known limits:** ratings reflect the shot result, not only the swing. Claude judges from still frames, so its review is guidance, not measurement. The first versions track the body only, not the club.

## Goals and non-goals

The app succeeds if a batch of swings goes from iPhone to analyzed in minutes at a computer, and a Claude chat primed with the briefing gives a useful review between shots.

**Goals**

- Turn iPhone slow-motion videos into compact swing data, with no server and nothing leaving the computer.
- Keep only a small rolling set: the five newest swings for each swing type at each rating.
- Show the golfer how any swing differs from his typical 5, and play any two swings side by side in slow motion with the differences pointed out.
- Pick a model 5 swing for each swing type.
- Export a briefing and images that make a Claude chat an on-course swing reviewer.
- Let the golfer make a frame sheet from a new swing on his iPhone, with nothing kept by Hacker.
- Back up and restore all data with one file.

**Non-goals (for now)**

- No iPhone app, App Store release, or Apple developer account.
- No server, online accounts, passwords, or cloud sync. Golfers create local profiles in the browser, and several golfers can share one browser.
- No live recording in the web app. It only imports videos.
- No distance, wind, or yardage input.
- No universal ideal swing: the golfer's own best swings are the target.
- No club or ball tracking in the first versions.

## Decisions already made

The owner has settled these. Claude Code should not reopen them without asking.

- The app is called Hacker. It is a web app for desktop browsers (current Chrome and Edge) on a Mac or a PC, from one codebase. Safari and other desktop browsers are not supported. There is no iPhone app.
- The app runs entirely in the browser: no server, no accounts, and no uploads of videos or data. It is hosted as a public static website on GitHub Pages, open to anyone.
- Video comes from the iPhone Camera app in slow motion, 1080p at 240 fps, one swing per clip. Swings saved into the library need that kind of video (120 fps or more). For checking one particular swing, Hacker also accepts lower frame rates and lower resolution, and saves nothing (see Video quality).
- The phone is placed face-on only. There is one camera angle.
- There is no yardage. The six club categories are Drive (with a tee), Fairway wood (no tee), 4/5/6 iron, 7/8/9 iron, Wedge, and Chip. Drive, Fairway wood, and 4/5/6 iron are full power only. 7/8/9 iron and Wedge can be full or three-quarters. Chip has no power setting. A hybrid goes in Fairway wood, and a 3-iron goes in 4/5/6 iron.
- The golfer enters the swing type, a 1 to 5 rating, and optionally the ball's result for each clip when he uploads it, and can do all of it from the keyboard.
- Hacker keeps up to five swings for each swing type at each rating. The newest replace the oldest.
- For each swing type, one 5-rated swing is the model 5 swing.
- Comparison and export for a swing type unlock after five swings of that type have been uploaded, at any rating.
- The export is a text briefing to paste into Claude, plus images. A backup is one JSON file.
- Video can be kept in a folder on the owner's computer, chosen in Settings. Without a folder, no video is kept and playback uses skeleton figures.
- On the course, the golfer sends Claude a frame sheet image, not video, because Claude chat cannot read video. The frame sheet is made on the iPhone, and Hacker keeps nothing from it.
- Each golfer creates a profile in the browser, with a name and right or left hand, and no login or password. Several profiles can share one browser, and each profile's swings are stored apart from the others. Profiles are not private from other people who use the same browser, and the app says so. (Changed 2026-11-06: Hacker is now for any golfer, not only the owner. Online accounts were considered and turned down to keep the no-server design.)
- The database uses versioned schemas, so changes migrate the golfer's data.
- Claude Design provides the screens. Claude Code builds the logic and placeholder screens.

## Glossary

| Term | Meaning |
| --- | --- |
| Club category | One of six groups of clubs: Drive (with a tee), Fairway wood (no tee), 4/5/6 iron, 7/8/9 iron, Wedge, and Chip |
| Power | Full or three-quarters. Only 7/8/9 iron and Wedge offer both. Drive, Fairway wood, and 4/5/6 iron are full only, and Chip has no power setting |
| Swing type | A club category plus its power level. There are eight swing types |
| Rolling set | The five newest swings stored for one swing type at one rating |
| Typical 5 | For a swing type, the median of each metric across its stored 5-rated swings |
| Model 5 swing | The single 5-rated swing chosen as the best example of a great swing for a swing type |
| Typical miss | For a swing type and a rating of 1 to 4, how its stored swings usually differ from the typical 5 |
| Briefing | The text file the golfer pastes into a Claude chat before a round |
| Frame sheet | One image showing eight frames of one swing in order, with labels |
| Joint data | The position and confidence of each tracked body joint in every frame of a swing |
| Metric | A number measured from a swing, such as tempo ratio or head movement |
| Swing phases | Address, top of backswing, impact, and finish |
| Lead and trail | The lead arm is the one nearer the target at address (the left arm for a right-handed golfer). The trail arm is the other |

## Environment and starting point

The owner has two Macs to build on, a PC to test on, and an iPhone 16 for filming.

| Device | Details | Role |
| --- | --- | --- |
| MacBook Pro | 2023, Apple M2, macOS Tahoe 26.7.1 | Main development machine |
| MacBook Air | 2020, Apple M1, macOS Tahoe 26.6.2 | Backup machine, and a speed test on the slower Mac |
| PC | Details not yet known | Test machine for uploads and speed |
| iPhone 16 | Running iOS 26 | Camera, and the frame sheet page on the course |

**Owner background**

- No web development experience. Explain steps in plain terms and do as much as possible from the terminal.
- Wants to build with Claude Code rather than hire a developer.
- Personal project, so rough edges are acceptable.

**Not yet confirmed (Claude Code should check at the start)**

- Whether Node.js and Git are installed on the MacBook Pro, and their versions.
- The PC's Windows version, and which browser the owner uses on it.
- Whether the iPhone's slow-motion videos play in Chrome and Edge on the PC. Some Windows setups cannot play the iPhone's default video format (HEVC).
- The iPhone's Camera settings: Slo-mo at 1080p and 240 fps, and the Formats setting (High Efficiency or Most Compatible).

## Project basics

The app is called Hacker. It is a static website that does all of its work in the browser.

| Item | Decision |
| --- | --- |
| App name | Hacker |
| Type | Static website that runs entirely in the browser |
| Browsers | Current Chrome and Edge, on a Mac and on a PC. Safari is not supported on desktop. The frame sheet page also runs in Safari on the iPhone |
| Language | TypeScript (suggested) |
| Build tool | Vite (suggested) |
| Pose model | MediaPipe Pose Landmarker running in the browser (suggested). Claude Code tests it and confirms it or proposes a better fit |
| Storage | IndexedDB in the browser, with persistent storage requested |
| Hosting | GitHub Pages, from a public GitHub repository (chosen by the owner on 2026-11-06). `npm run deploy` runs the tests, builds the site, and publishes it to the gh-pages branch. The site holds code and the pose model, and no user data |
| Dependencies | As few as possible. Claude Code asks before adding one |

- Host the pose model files with the app, so the browser contacts no third-party servers. Add no analytics, trackers, or third-party scripts.
- No camera or microphone permission is needed, because the app imports files.
- Ask the browser for persistent storage, so it does not clear the golfer's data, and show how much storage is used.
- The iPhone's default video format (HEVC) does not play in every browser on every PC. Claude Code tests this in milestone 0. The fix is the iPhone's Most Compatible setting (Settings, Camera, Formats), or letting Photos convert on transfer.

## How a swing gets in

1. **Set up.** Put the iPhone on a small tripod facing the golfer's chest (face-on), with the whole body and the finish in frame. In the Camera app choose Slo-mo, at 1080p and 240 fps.
2. **Film.** Record one swing per clip. After each swing, jot the swing type and rating in the phone's Notes app, because the web app cannot ask on the course. A note about where the ball went helps later.
3. **Move the videos.** At a computer, bring the videos over: AirDrop to a Mac, a USB cable, or iCloud Photos on a PC.
4. **Upload and label.** Drag the videos into Hacker. For each clip choose the swing type and the rating, optionally the ball's result, and add a short note if wanted. Everything can be done from the keyboard (see Fast labeling below).
5. **Analyze and save.** Hacker analyzes each clip in the browser, with progress shown, saves the swing into its rolling set, and copies the video into the video folder if one is chosen, or otherwise forgets it. The original stays on the owner's own devices.

A Recording guide page inside Hacker repeats steps 1 and 2.

Videos with a lower frame rate or resolution are also accepted, to check a single swing without saving it. See Video quality under Analysis in the browser.

**Ball result.** Each clip can carry one optional result: Solid, Pull, Push, Slice, Hook, Fat, or Thin. The words follow the golfer's handedness, so a pull for a left-hander starts right of the target, and a tooltip says so. The result is stored with the swing, can be changed in Swing detail, is shown under each figure in Compare and Side by side, and goes into the metrics CSV and the Claude briefing, where it links what the body did to where the ball went.

**Swing shorthand.** (Added 2026-11-06.) After each swing the golfer types one short line in the phone's Notes app: club letter (D, F, L, M, W, C, the same as the keyboard keys, or words such as driver, 7i, PW), an optional 3/4, the rating 1 to 5, an optional result word, and then any note, for example `W 5 push` or `M3/4 4 pull felt quick`. On the Upload screen the golfer pastes all the lines at once, and line 1 fills the first waiting clip, line 2 the second, and so on, in recording order. Lines that cannot be read are listed, and a different number of lines and clips is pointed out. If a video carries a caption or description in its own metadata (for example a Photos caption, if Photos includes it when sharing), Hacker reads it with the same shorthand and fills in that clip. Whether Photos captions travel with AirDropped videos is checked with the owner's first real videos.

**Fast labeling.** Every label can be set without the mouse, because a range session can mean 20 or more clips. The Upload table lists clips by recording time, oldest first, so the rows follow the order of the notes jotted on the phone. Claude Code may change a key that clashes with a browser shortcut, but every label must stay reachable from the keyboard, and the key list shows on screen.

| Key | Action |
| --- | --- |
| Up and Down | Move between clips |
| 1 to 5 | Set the rating |
| D, F, L, M, W, C | Set the swing type: Drive, Fairway wood, Long iron (4/5/6), Mid iron (7/8/9), Wedge, Chip |
| Q | Switch between full and three-quarters, where allowed |
| Shift + S, P, U, L, H, F, T | Set the result: Solid, Pull, Push, sLice, Hook, Fat, Thin |
| = | Copy the previous clip's swing type, power, and result |
| O | Switch between Save and Check only |
| Space | Play or pause the preview |
| Cmd or Ctrl + Enter | Start analysis |
| ? | Show this list |

## Club categories and power

There is no yardage. A shot is described by a club category and, where it applies, a power level. The six club categories are Drive (with a tee), Fairway wood (no tee), 4/5/6 iron, 7/8/9 iron, Wedge, and Chip. Drive, Fairway wood, and 4/5/6 iron have one power level, full. 7/8/9 iron and Wedge can be full or three-quarters. Chip has no power setting. A hybrid goes in Fairway wood, and a 3-iron goes in 4/5/6 iron. A club category together with its power level is a swing type, so there are eight swing types.

**Camera angle.** The app requires face-on placement: the phone faces the golfer's chest, at about 90 degrees to the target line. Face-on cannot see depth, so checks that need a view down the target line are out of scope. Camera angle stays a stored field, so a second angle can be added later.

**Golfer profiles.** On first use the app asks for the golfer's name and whether they are right- or left-handed, and creates a profile. More golfers can add their own profiles on the Profiles screen and switch between them, so a family or a golf group can share one computer. Each profile has its own swings, upload counters, upload log, settings, and video folder, kept in its own database in the browser. There is no login or password, so anyone using the same browser can open any profile; the app says so. A golfer can change their name and hand in Settings, and delete their profile, which deletes its swings after confirmation. Handedness decides which arm is the lead arm (the one nearer the target at address) and which is the trail arm. The analysis mirrors left-handed swings so one set of metric definitions works for both. Joint data is stored as captured, so changing handedness later only means recomputing the metrics.

## Rolling sets

Hacker keeps a small set of swings, not a history.

- For each swing type at each rating from 1 to 5, Hacker keeps the five newest swings. With eight swing types, that is at most 200 swings.
- When a sixth swing arrives for the same swing type and rating, the oldest swing in that set is deleted. "Newest" means the video's recording date: the file's creation date, or its last-modified time if there is none.
- The model 5 swing is pinned. While a swing is the model, the rolling rule never deletes it, and it counts as one of the five.
- Changing a swing's rating or swing type moves it to the new set, and the rolling rule applies there.
- Swings leave only by the rolling rule or when the golfer deletes them. Deleting asks for confirmation.
- Each stored swing has its record, joint data, metrics, and frame sheet image. The video is not stored in the browser. If a video folder is chosen, the video is kept there instead (see Video folder).
- Hacker counts every successful upload for each swing type. Comparison and export for a swing type unlock when that count reaches five, at any rating. Until then the swings are saved and show only their own data. A clip that is only checked is never saved and does not count.

## Video folder

Hacker can keep each saved swing's video in a folder on the owner's computer, so videos stay out of the browser's storage and Side by side can play real video.

- **Choosing the folder.** Settings has a Choose video folder button, using the browser's folder access (the File System Access API). Chrome and Edge both have it. Hacker still checks for it, and if it is missing or the folder cannot be opened, works with no video kept and says why in Settings.
- **Where Hacker writes.** Hacker creates one subfolder named Hacker Data inside the chosen folder, and inside it one folder per profile, named when the profile is created. It reads, writes, and deletes only inside Hacker Data. It never touches other files. Each profile chooses its own video folder, and two profiles may choose the same one.
- **What goes in.** After a swing is analyzed and saved, Hacker copies its video into the subfolder, named by the swing's id. A checked clip is never copied. Nothing leaves the computer.
- **The rolling rule applies.** When a swing leaves its set, by the rolling rule or by deletion, its video file is deleted with it. The model 5 swing's video is pinned along with the swing. A setting chooses Keep video for all saved swings (the default) or only for model 5 swings. For all 200 swings the folder can reach about 5 to 10 GB; for the eight model 5 swings alone, about 200 to 400 MB. Settings shows the folder's size.
- **Playback.** When both swings in Side by side have a kept video, the golfer can switch to real video, with the skeleton drawn over it if wanted. The video runs on the same clock as the skeleton, so sync modes, speeds, frame step, and phase jumps work the same. Claude Code chooses how (seeking every frame, or varying the playback rate) and tests it in milestone 4. A video that cannot play, such as HEVC on a PC without support, or that is missing, falls back to the skeleton for that side with a short message.
- **Automatic backup.** After each upload batch and each change to a swing, Hacker writes its backup JSON into the subfolder, replacing the last copy and keeping the one before it. If the browser's data is ever cleared, Hacker finds the folder, offers to restore from the backup, and links each video back to its swing by id.
- **Permission.** Browsers may ask again for folder permission on a new visit. Settings and Upload show a Reconnect folder button. If the folder is not reachable when analysis starts, Hacker offers Reconnect or Continue without keeping video, and never blocks analysis.

## Analysis in the browser

1. **Read the video.** Read every frame with accurate timestamps, using WebCodecs where the browser has it and falling back to seeking. Measure the real frame rate and the golfer's size in the frame, and place the video in a quality tier (see Video quality below). A slower or smaller video is never rejected for that reason alone. Process one frame at a time and never hold a whole clip in memory.
2. **Pose per frame.** Run the pose model on every frame, or every second frame if that is too slow. Mirror left-handed swings. Save the joint data compactly, at no less than 60 poses per second, because side-by-side playback draws from it.
3. **Find the swing phases.** Detect address (body still before the swing), top of backswing (wrists reverse direction), impact (fastest wrist speed), and finish.
4. **Compute metrics** from those positions (table below). Normalize distances by shoulder width so they do not depend on how far the camera is from the golfer.
5. **Make the frame sheet.** One image with eight frames in a 4 by 2 grid, cropped around the golfer: address, halfway to the top, top, halfway down, impact, just after impact, halfway to the finish, and finish. Label each frame. Use the same rule for every swing so sheets line up, and make the sheet about 1,500 pixels wide so body positions are clear.
6. **Save** the record, joint data, metrics, and frame sheet into the swing's rolling set.

**Speed.** Analysis runs in the background while the golfer keeps working, with a progress display. Starting target: under about 60 seconds per clip on the MacBook Air. Claude Code measures this in milestone 2 on both Macs and the PC, and reports options, such as analyzing every second frame, before changing anything.

**Starting metrics**

| Metric | Definition | Unit |
| --- | --- | --- |
| Tempo ratio | Backswing time divided by downswing time | ratio |
| Backswing duration | Start of backswing to top | seconds |
| Shoulder turn at top | Rotation of the shoulder line from address | degrees |
| Hip turn at top | Rotation of the hip line from address | degrees |
| Head movement | Head shift from address to impact, sideways and vertical | shoulder widths |
| Hip sway or slide | Sideways hip shift from address to the top and to impact | shoulder widths |
| Hand position at top | Wrist position at the top relative to the head and shoulders, height and sideways distance | shoulder widths |
| Hand position at impact | Wrist position at impact compared with address, toward or away from the target, and height | shoulder widths |
| Finish position | Chest turn toward the target, hip shift toward the target, and wrist height at the finish | degrees; shoulder widths |
| Trail elbow fold | Trail elbow bend at the top and early in the downswing | degrees |
| Lead arm straightness and elevation | Lead elbow bend, and the lead arm's angle above horizontal, at the top and at impact | degrees |

All metrics are measured from the face-on view. Rotation angles are rough in 2D, so use the pose model's 3D estimates where they help. The pose model tracks wrists, not the club, so hand position means wrist position.

**Video quality.** Hacker accepts any video it can read. After reading the real frame rate, it places the clip in one of two tiers. Frame rate decides the tier because it controls how well timing and the moment of impact can be measured. Picture size is handled by the pose model: if the golfer is too small to track, the "pose not reliable" case below applies, and Hacker shows the golfer's height in pixels so the reason is clear.

| Tier | Video | What Hacker does |
| --- | --- | --- |
| Full | 120 fps or higher, at any size the pose model can follow. The target is 1080p at 240 fps. | Computes every metric. The swing can be saved into its rolling set. |
| Reduced | Under 120 fps, such as an ordinary 30 or 60 fps clip | Computes every metric, marks the timing ones as approximate, and lets the golfer check this one swing. Nothing is saved. |

- **Approximate metrics.** On a Reduced clip, tempo ratio, backswing duration, and every value measured at impact or early in the downswing show a "\~" and are never marked inside or outside the range of the 5s. At 30 fps the downswing lasts only a few frames, so impact can be off by a frame or more. Positions at address, at the top, and at the finish stay as exact as the pose model allows.
- **Check one swing.** In Upload, each clip has a Save or Check only choice. A Full clip defaults to Save. A Reduced clip offers Check only. A checked swing opens the Compare view against the typical 5 and the model 5 for the swing type the golfer picks, as long as five swings of that type have been uploaded; before that it shows only its own metrics and frame sheet. Closing the view discards it. A checked swing is not stored, is not counted toward the five uploads, and does not touch the rolling sets.
- **Frame sheet.** A Reduced clip gets the same eight-frame sheet, made at the clip's own size and never enlarged, so the sheet is smaller. The iPhone frame sheet page accepts any clip for the same reason.
- **Test clip.** The owner's IMG\_6630.mov (512 by 910 pixels, 30 fps, HEVC, golfer about 270 pixels tall) is a real Reduced clip. Keep it in the test videos and use it to test this path.

**Failure behavior.** Every problem with a clip is handled the same way: Hacker saves no swing, records the file name and the problem in the upload log, and tells the golfer what to do. The original video is untouched, so he can fix the issue and upload again. The three video folder cases at the bottom of the table are the exception: the swing is still saved.

| Case | What the app does |
| --- | --- |
| Nobody in frame | Logs "no golfer found" |
| A second person in frame | Logs "second person in frame" |
| Low-confidence pose | Logs "pose not reliable" |
| No swing found | Logs "no swing found" |
| Video cannot be read | Logs "video format not supported" and explains the iPhone's Most Compatible setting |
| Duplicate upload | Skips the file and logs "already uploaded" when the same name, size, and date were uploaded before |
| Storage full or blocked | Stops, saves nothing partial, tells the golfer, and offers a backup export |
| Page closed during analysis | Nothing partial is saved. The clip is simply uploaded again |
| Video folder not available | Offers Reconnect, or Continue without keeping video, and never blocks analysis |
| Disk full when copying a video | Saves the swing without its video, says so, and shows how much space the folder uses |
| A swing's video file is missing | Shows skeleton figures for that swing and says the video is missing |

## Compare view

The golfer opens any stored swing and sees how it compares with his typical 5 for that swing type.

- A table gives each metric's value for this swing, the typical 5's value, and the difference.
- When the rolling set holds at least three 5-rated swings, each row is marked inside or outside the range of those 5s. Inside means it matches his 5s. Before that, the rows show numbers only.
- Two lists, "matches your 5s" and "differs from your 5s", hold up to three rows each, with the largest differences first.
- The frame sheets of this swing and the model 5 swing sit side by side.
- Compare unlocks for a swing type only after five swings of that type have been uploaded.
- Check one swing opens this same view for a lower-quality clip without saving it (see Video quality). Rows measured at impact show numbers only, marked approximate.

Side-by-side playback, below, adds short written commentary on the differences. Fuller coaching, with swing thoughts, is left to Claude in chat.

## Side-by-side playback

The golfer can play any two swings next to each other, including the model 5, in sync and in slow motion, and Hacker points out where they differ and says what that usually means.

- **Choosing the swings.** The left side starts as the model 5 for the swing type. Either side can be changed to any saved swing of an unlocked swing type, or to a checked clip. The view opens from Compare, from Swing detail, and from the Library. If the two swings are different swing types, Hacker says so, because the differences will be large.
- **What is drawn.** Each side is a skeleton figure drawn from the stored joint data. When a swing's video is kept in the video folder, the golfer can switch that side to real video, with the skeleton drawn over it if wanted. The figures sit side by side, or can be overlaid in two colors, lined up at the midpoint between the ankles at address and scaled by shoulder width. Left-handed swings are mirrored, as everywhere else. In skeleton view no club is drawn, because the pose model does not track it; real video shows it. The two frame sheets stay available beside the figures.
- **Playback controls.** Play and pause; normal, half, quarter, and eighth speed; frame step forward and back; one scrub bar for both sides with markers at address, top, impact, and finish; buttons that jump to each phase; and a loop switch. The two sides always move together.
- **Two sync modes.** Match the phases (the default) adjusts speed between phases so both swings reach the top and impact at the same moment, which makes position differences easy to see. Real time starts both at address and runs them at true speed, which makes tempo differences visible.
- **Smooth slow motion.** Poses are interpolated between stored frames and drawn at the screen's refresh rate. A swing from a Reduced clip looks steppier when slowed, and is labeled that way.
- **Differences.** At each phase Hacker compares the two figures and their metrics. A side panel lists up to five differences, largest first, each tied to a phase and a body part, for example "At the top, the trail wrist is higher and farther from the head." Selecting one jumps both sides to that phase and circles the body part on both figures. Small differences are not listed: when the comparison is against the model 5 and three or more 5-rated swings exist, "small" means inside the range of the 5s; otherwise Claude Code picks a fixed tolerance and shows it. Approximate metrics from Reduced clips carry a "\~" and rank lower.
- **Commentary.** Under each listed difference sit one or two short golf sentences saying what it usually means and a common cause, for example "Your head slides toward the target on the way down. Swings that stay behind the ball tend to strike it more solidly." The sentences come from one text file in the project, with an entry for each metric and direction, written from accepted coaching wisdom and worded as "tends to", never as a diagnosis. Claude Code drafts the file and the owner reviews it. The commentary is rule-based, with no AI call inside the app, because the app has no server. For fuller coaching, the golfer exports to Claude.
- **What it cannot see.** The view is face-on, so depth problems such as swing path or early extension are not visible, and the app does not comment on them.

## Export for Claude

Hacker makes two exports.

**Claude briefing.** This is what the golfer pastes into a new Claude chat before a round.

- The golfer picks the swing types he expects to use. Hacker builds one Markdown text file, with a Copy button and a Download button.
- It starts with instructions to Claude (below), then a short key to the metrics and units, then the golfer's name and handedness.
- For each chosen swing type it gives the model 5 swing's data (phase timings, and each metric's value in words and numbers) and the golfer's typical misses.
- Typical misses come from the stored swings at ratings 1 to 4. For each rating that has swings, list the three metrics that differ most from the typical 5, and the golfer's own notes on those swings, such as "pushed right".
- When swings carry a ball result, the briefing also lists, for each result that appears on at least two swings of the swing type, the three metrics that differ most from the typical 5 on those swings, for example "Pushes, 4 swings". This ties what the body did to where the ball went.
- Images go with it: each swing type's model 5 frame sheet, and optionally the newest frame sheet from a low rating as a miss example. Claude chat accepts up to 20 files, so Hacker lists the images to attach and warns if there are more than 20.
- The briefing must stay comfortable to paste. Claude Code aims for roughly 500 words per swing type and reports the total for eight.

**Model 5 swing.** For each swing type, Hacker suggests the stored 5-rated swing closest to the median of the 5-rated set. The golfer can pick another with Make this my model swing. A swing type with no 5-rated swing is left out of the briefing, with a note.

**Instructions at the top of the briefing** (starting text, which the owner can edit):

```
You are my golf swing reviewer. Below is data from my own best swings (my model 5 swings) and my typical misses, for each swing type. During my round I will attach one image, a frame sheet of eight frames from a face-on slow-motion video of a swing, and tell you the swing type. I may also tell you where the ball went. Some of my typical misses are labeled with the ball result they usually produce, such as a push or a slice, so you can link what my body did to where the ball goes.

For each swing I send:
1. Compare it with my model 5 swing for that swing type. Say what matches and what differs.
2. Say which of my typical misses it most resembles, and what that miss usually does to the ball.
3. Give one or two adjustments, and one short swing thought I can use on the next shot.

Keep each answer short enough to read on a phone between shots. If the image is too unclear to judge, say so.
```

**Backup file.** One JSON file per profile with everything Hacker stores for it: the profile, all swings with their joint data, metrics, and frame sheets, and the upload counters. Restore reads it back, so the golfer can move to another computer or recover from a cleared browser. Hacker shows the days since the last backup. A separate CSV export has one row per swing and metric, with the swing type, rating, and ball result on each row. With a video folder chosen, the same backup file is also written there automatically (see Video folder). The video files are not inside the JSON; they are matched to swings by id.

## On-course review

The golfer gets a review of a new swing in the Claude chat that holds his briefing.

1. **Film** the swing with the iPhone Camera app, in slow motion, face-on.
2. **Make a frame sheet.** Open the Hacker frame sheet page in Safari on the iPhone, choose the video from Photos, and wait for one image. Save it to Photos or share it straight to the Claude app.
3. **Attach** the image to the Claude chat that has the briefing. Say the swing type, and where the ball went if known.
4. **Read the review.** Claude compares the swing with the model 5 swing, says which typical miss it resembles, and gives adjustments and a swing thought.

**The frame sheet page**

- It is a page of the Hacker website, built for the iPhone, with one large button.
- It reuses the same analysis code at a reduced frame rate (every fourth frame) to find the phases and pick the same eight frames, so its sheets line up with the stored ones.
- It runs entirely on the phone. It saves no swing, writes nothing to storage, and sends nothing anywhere. After the sheet is made, Hacker holds no trace of the video.
- Starting target: under about 30 seconds on the iPhone 16. If pose analysis is too slow there, fall back to picking frames spread evenly across the motion, and add a line to the briefing saying so. Claude Code measures this in milestone 6.
- Without the page, the golfer can pause the video at address, top, impact, and finish and take four screenshots to attach instead. The Recording guide explains this.

**Why an image.** Claude chat cannot read video files. Its supported uploads are images, PDFs, and documents. A frame sheet is one image that carries the whole swing.

**Privacy.** Hacker keeps nothing from this step. Claude keeps the chat under the owner's Claude settings, so the owner should review his privacy settings and delete the chat when he wants.

**Expectations.** Claude sees still frames. It can judge positions and sequence well, but it cannot measure angles precisely or see the ball, so treat its review as guidance.

## Technical architecture

How the parts fit: the golfer's iPhone camera films swings and the videos reach the computer by AirDrop or cable. Inside Hacker, in the browser, the steps run in order: Upload and label, then Analysis, then Rolling sets, then Export. The Export step feeds a Claude chat. Separately, the on-course frame sheet page on the iPhone makes one image for the same Claude chat.

Videos come in at the computer and are analyzed in the browser. Hacker keeps the five newest swings for each swing type and rating, and exports a briefing and images to paste and attach in a Claude chat. On the course, the frame sheet page makes the one image.

- **Static website:** TypeScript, built with Vite, hosted on a free static host. There is no server.
- **Three parts:** the screens, an analysis library (video reading, pose, phases, metrics, frame sheets, rolling sets, and export), and the data layer (IndexedDB).
- **Pose:** a pose model running in the browser, with its files hosted alongside the app.
- **Storage:** IndexedDB with versioned schemas and a migration for every change. The browser is asked for persistent storage.
- **Video folder:** optional, through the browser's folder access (Chrome and Edge). It holds the kept videos and an automatic backup, inside one subfolder Hacker owns.
- **Exports:** Markdown text and JPEG images for the briefing, a JSON file for backup, and CSV for metrics.
- **No network calls carry the golfer's data,** and there are no analytics or trackers.

**Project layout and testing**

- The analysis library has no screen code, so Claude Code can test its math from the terminal with a test runner such as Vitest.
- Video and pose code is tested in a headless browser (such as Playwright) on saved test videos.
- iPhone videos are HEVC, which a test browser may not decode. If so, test with the installed Chrome, or with H.264 copies of the test videos, and report which was needed.
- Test videos live in a `TestVideos` folder listed in `.gitignore`, because they are large. Move videos from the iPhone to the Mac by AirDrop and save them in that folder.
- Keep a short README with the exact commands to run, test, build, and deploy.
- Never change the stored data layout without a migration, and test each migration on a copy of real data.

## Data model

The app keeps one record per stored swing, and nothing else from the swing's source.

| Entity | Fields | Notes |
| --- | --- | --- |
| Golfer profile | id, name, handedness (right or left), database name, video subfolder name, created date | Any number per browser, kept in a small profile list. Each profile's other records live in its own database |
| Swing | id, swing type (club category and power), rating 1 to 5, recording date, upload date, original file name, note, ball result (optional), video file name (if kept), camera angle, frame rate, phase times (address, top, impact, finish), metrics version, model 5 flag | One per stored swing. At most five per swing type and rating |
| Joint data | swing, per-frame position and confidence of each tracked joint | About 0.5 MB per swing, stored compactly. Lets metrics be recomputed without the video |
| Metrics | swing, metric name, value, unit | One row per metric per swing, so metrics can be added without changing the layout |
| Frame sheet | swing, JPEG image | About 0.4 MB. Used in Compare view and the briefing |
| Upload counter | swing type, number of successful uploads | Drives the five-upload unlock |
| Upload log | file name, time, result (saved, or the problem) | Records failures and prevents duplicate uploads |

**Storage choices**

- Use IndexedDB with versioned schemas from the first release.
- Store joint data as captured. Handedness mirroring and metrics are applied on top, so changing either only means recomputing.
- A metrics version on each swing lets Hacker recompute all metrics from joint data when definitions change.
- Back up before any migration.
- Keep the video folder's access handle in IndexedDB, and check it at each launch.

## Storage budget

Expect up to about 200 MB of swing data, plus the app. These are estimates to check in milestone 2.

| Item | Estimate | Basis |
| --- | --- | --- |
| One stored swing | About 1 MB | Joint data about 0.5 MB and frame sheet about 0.4 MB |
| All swings at the limit | About 200 MB | 8 swing types, 5 ratings, 5 swings each is 200 swings |
| App and pose model | Under 50 MB | Cached by the browser |
| Video | 0 MB in the browser; about 25 to 50 MB per swing in the video folder | Kept on the computer's disk, not in the browser: about 5 to 10 GB for all 200 swings, or 200 to 400 MB for model 5 swings only |

Browsers on a computer allow far more than this, but they can clear stored data. That is why persistent storage is requested and backups are encouraged. Settings shows the storage used.

## Interface handoff

The visual design comes from Claude Design, not Claude Code. Claude Code builds the logic first with plain placeholder screens, then fits the Claude Design screens over them.

**Screens to design**

- **First use:** asks for the golfer's name and right or left hand, and says that swings stay on this computer.
- **Profiles:** lists the golfers in this browser, switches between them, and adds a new one. Says that profiles have no password.
- **Library:** a grid of the eight swing types by the five ratings, showing how many of the five slots are filled, with a way into any set.
- **Upload:** drop videos, then a table with one row per clip: preview frame, swing type, rating, and note. A button starts analysis, with progress and a result for each clip. Each clip shows its frame rate and a Full or Reduced label, with a Save or Check only choice and an optional ball result. Everything can be set from the keyboard, with a key list shown on screen.
- **Swing detail:** the frame sheet, the video if kept, the metrics, the ball result, the note, Make this my model swing, change rating or swing type, and delete.
- **Compare:** the swing against the typical 5, with the two frame sheets side by side.
- **Side by side:** two skeleton figures, or real video when it is kept, play controls with slow motion, the sync mode, and a list of differences with short commentary.
- **Export:** choose swing types, see what will be included, then Copy briefing, Download briefing, and Download images.
- **Settings:** profile (including Delete profile), storage used, backup and restore, metrics CSV, days since the last backup, and the video folder (choose or reconnect, size used, keep all videos or only model 5 videos).
- **Recording guide:** how to set up and film, and the screenshot fallback.
- **Frame sheet (iPhone):** one large Choose video button, progress, and the finished image with Save and Share.

**Design rules.** Desktop first for everything except the frame sheet page. The frame sheet page must work one-handed in bright sun, with large touch targets and high contrast.

**Rule for Claude Code.** Keep every screen behind a simple interface so the Claude Design screens can replace the placeholders without touching the analysis code. Do not spend time on visual polish.

## Build order and milestones

Build in eight small milestones, each usable on its own.

**0. Setup**

- [ ] Node.js and Git are installed, and an empty project named Hacker builds and runs in the browser.
- [ ] The project is under Git version control, with this spec saved in it as SPEC.md.
- [ ] A `TestVideos` folder exists and is listed in `.gitignore`, and tests run from the terminal.
- [ ] The owner's iPhone slow-motion videos play in the browsers on the MacBook and on the PC, and the result is reported. If they do not, the fix is documented.
- [ ] Folder access works in Chrome and Edge on the MacBook and the PC: a test file is written, read, and deleted in a chosen folder, and the result after closing the browser is reported.
- [ ] Free static hosting options are proposed, and the owner chooses one before anything is deployed.

**1. Upload, label, and rolling sets**

- [ ] First use asks for the golfer's name and right or left hand, and Settings can change them.
- [ ] Videos can be dropped in several at a time, and each is labeled with a swing type (club category and power), a rating, and an optional note.
- [ ] Swing types follow this spec: six club categories, full or three-quarters where allowed, eight swing types, and no yardage.
- [ ] Swing records are stored in IndexedDB with a versioned schema and survive closing the browser.
- [ ] The rolling rule keeps the five newest swings per swing type and rating, protects the model swing, and is covered by tests.
- [ ] Persistent storage is requested, and storage used is shown in Settings.
- [ ] The Library screen shows the sets and how full they are.
- [ ] The upload log and duplicate detection work.
- [ ] Each clip can be given a ball result, which shows in Swing detail and in the CSV.
- [ ] Every label can be set from the keyboard with the keys in this spec, rows follow recording order, and a key list shows on screen.
- [ ] A video folder can be chosen in Chrome or Edge, each saved swing's video is copied into its Hacker Data subfolder, and the rolling rule and deleting a swing remove the video file.
- [ ] After the owner chooses hosting, milestone 1 is deployed, and the owner confirms it opens and works in Chrome and Edge on the PC.

**2. Video reading and pose**

- [ ] Every frame is read with accurate timestamps, and the real frame rate is checked and reported.
- [ ] Pose detection runs on uploaded clips, with a skeleton overlay on a preview.
- [ ] Address, top, impact, and finish markers look right when 10 videos are watched.
- [ ] Each swing's joint data is saved compactly, and the skeleton can be redrawn from it.
- [ ] Time per clip is measured on both Macs and the PC and reported, along with the real size of a stored swing.
- [ ] Clips under 120 fps are accepted and labeled Reduced, and the owner's 30 fps test clip runs end to end as Check only.
- [ ] The pose and phase code runs in a headless browser against test videos.

**3. Metrics, frame sheets, and compare**

- [ ] All starting metrics are stored for each swing and can be recomputed from joint data with no video.
- [ ] The frame sheet is generated with the same eight frames for every swing and stored.
- [ ] Every case in the failure table is handled.
- [ ] Compare view shows the swing against the typical 5, with inside or outside the range once three 5-rated swings exist.
- [ ] Comparison and export for a swing type unlock only after five successful uploads of it.
- [ ] Check only works for Reduced clips: approximate metrics are marked, nothing is saved, and the unlock count does not change.

**4. Side by side**

- [ ] Side by side plays any two saved swings in sync, in both sync modes, at normal, half, quarter, and eighth speed, with frame step and jumps to each phase.
- [ ] The side-by-side view lists up to five differences, circles the body part on both figures, and shows short commentary from an editable text file.
- [ ] When both swings have a kept video, Side by side can switch to real video, in sync, with the same controls.

**5. Export and backup**

- [ ] The model 5 swing is suggested and can be changed.
- [ ] The Claude briefing is built for the chosen swing types, with the instructions at the top, and can be copied or downloaded.
- [ ] The model 5 frame sheets download as images, and the briefing lists which to attach.
- [ ] Backup and restore round-trip with no loss, and a CSV of metrics exports.
- [ ] With a video folder chosen, the backup file is written there automatically, and a cleared browser can be restored from it with the videos linked back.
- [ ] The owner pastes a real briefing into a new Claude chat, attaches a frame sheet, and judges whether the review is useful. Changes to the briefing follow.

**6. On-course frame sheet**

- [ ] The frame sheet page works in Safari on the iPhone 16: choose a video, get one image, and save or share it.
- [ ] It stores nothing and makes no network requests while running, and this is checked.
- [ ] The time to make a sheet is measured. If it is over about 30 seconds, the fallback is built.
- [ ] The Recording guide includes the screenshot fallback.

**7. Polish**

- [ ] The Recording guide is finished, and the days-since-backup reminder works.
- [ ] Claude Design's screens replace the placeholders.
- [ ] The README covers running, testing, building, and deploying.

## Left for later

- A coaching library with sourced pointers, and recurring-problem cards with links to general information. For now, the written commentary in Side by side, and Claude in chat, cover this.
- Impact detection from the video's audio track.
- A second camera angle, which would bring back checks such as early extension and the elbow's distance from the body.
- A consistency view and progress charts.
- Club tracking, which needs a custom-trained model.

## Risks and open questions

The biggest risks are in the video: whether browsers can read the iPhone's files, and how fast and accurate a pose model is in a browser.

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| The iPhone video will not play in a browser | The default HEVC format fails on some PCs, so uploads fail | Test in milestone 0. Use the Most Compatible camera setting, or let Photos convert on transfer. Show a clear message |
| Slow-motion timing is misread | Tempo and impact depend on true frame timing | Check frame timestamps against 240 fps in milestone 2, and report any mismatch; lower-rate clips are labeled Reduced, not rejected |
| The pose model is slow or noisy in a browser | Long waits, or bad joint positions | Measure on both Macs and the PC, analyze every second frame if needed, and flag low-confidence clips |
| The browser clears stored data | The rolling sets are lost | Request persistent storage, encourage backups, and show days since the last backup |
| Ratings are entered later from notes | Memory errors add noise to the sets | Jot swing type and rating on the phone after each swing, and allow rating changes later |
| Claude judges from still frames | It cannot measure angles or see the ball | Tell Claude where the ball went, and treat the review as guidance |
| On-course frame sheets differ from stored ones | Claude may read a different layout as a different swing | Use the same frame rule and layout, and say so in the briefing if the fallback is used |
| Claude keeps the uploaded swing in the chat | The owner wants it used for nothing else | Hacker keeps nothing. The owner reviews his Claude privacy settings and deletes chats |
| Data spreads thin across swing types | Few swings per type early on | Upload a backlog, and unlock comparison at five swings |
| A public web page | Anyone can reach it | It holds only code and the pose model, and no personal data |

**Open questions for the owner**

- ~~Which free static host?~~ Answered 2026-11-06: GitHub Pages, public, open to anyone.
- Should the on-course frame sheet page be built, or is the screenshot fallback enough? Starting rule: build it in milestone 6.
- Which PC will the owner use, and does it run Windows 10 or Windows 11? Chrome or Edge is needed on the PC and on the Macs.
- Should "newest" use the video's recording date? Starting rule: yes.
- Which phone mount or tripod will be used on the course? It must hold the phone facing the golfer's chest.

## Working agreement for Claude Code

Work one milestone at a time, keep the app always runnable, and explain anything that needs the owner's hands in plain terms.

- **Start by checking the environment.** Confirm Node.js, Git, and the browsers on the MacBook, and ask about the PC. Report what is missing and how to fix it.
- **Support the Mac and the PC from the start.** Keep one codebase for Chrome and Edge on macOS and Windows, and avoid code that works on only one. At the end of each milestone, tell the owner what to try on the PC.
- **Keep dependencies few.** Use web standards where possible, and ask before adding a library.
- **Build from the terminal** where possible, and keep a README with the exact commands.
- **Tell the owner exactly what to click** for anything that needs a browser setting, the iPhone, or a hosting account.
- **Test without swinging.** Run the math tests from the terminal and the video and pose tests in a headless browser on saved test videos. See Project layout and testing.
- **Delete only what the rules say.** Only the rolling rule and the golfer's own delete remove a swing. Test the rolling rule well, back up before any migration, and never delete data without confirmation.
- **Never send data anywhere.** No analytics, trackers, or third-party calls. Videos and swing data stay on the owner's computer, in the browser or in the chosen video folder.
- **Keep analysis separate from the interface.** Put video reading, pose, phases, metrics, frame sheets, rolling sets, and export in the analysis library, with no screen code.
- **Make small commits** with clear messages at the end of each working step.
- **Ask before big decisions,** such as adding dependencies, changing the data model, choosing hosting, or changing the briefing format.
- **Keep the screens simple.** Placeholders only. The design comes from Claude Design.

## First prompt for Claude Code

The owner pastes this as the first message of the first Claude Code session, in the project folder that holds this spec saved as SPEC.md.

```
Read SPEC.md in this folder from start to finish before you do anything else.

I am the owner. I have no web development experience, so explain in plain words anything I have to do myself, such as changing a browser setting or creating a hosting account.

Work on milestones 0 and 1 only:
1. Check my setup (Node.js, Git, my browsers) and tell me what is missing. Ask about my PC.
2. Create the Hacker project, get an empty page running in my browser, and set up tests and a TestVideos folder that Git ignores.
3. Test whether my iPhone slow-motion videos play in my browsers, and tell me what you find.
4. Propose free hosting options and wait for my choice. Do not deploy until I choose.
5. Build milestone 1 with plain placeholder screens. The visual design will come later from Claude Design.
6. After I choose hosting, deploy milestone 1 so I can open it on my PC in Chrome and Edge, and tell me exactly what to try there.
7. Save your work in Git after each working step.

When milestone 1 works, stop. Tell me exactly how to try it, and do not start milestone 2 until I say so.
```
