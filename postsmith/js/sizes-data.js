// Social media image & video sizes (reviewed October 2026). Pixels are recommended upload sizes.
// safe: {t,b,l,r} = margins kept clear of UI overlays; center: [w,h] = area visible on every device; circle: avatar crop.
export const UPDATED = 'October 2026';
export const SIZES = [
  { id: 'instagram', name: 'Instagram', items: [
    { id: 'ig-portrait', name: 'Feed post (portrait)', w: 1080, h: 1350, note: 'Best for reach: takes the most screen space. 4:5.' },
    { id: 'ig-grid', name: 'Feed post (3:4 grid)', w: 1080, h: 1440, note: 'Profile grid now shows 3:4 thumbnails, so 3:4 posts aren’t cropped on your profile.' },
    { id: 'ig-square', name: 'Feed post (square)', w: 1080, h: 1080, note: 'Classic 1:1. Gets center-cropped to 3:4 on the profile grid.' },
    { id: 'ig-landscape', name: 'Feed post (landscape)', w: 1080, h: 566, note: '1.91:1. Smallest in the feed.' },
    { id: 'ig-story', name: 'Story / Reel', w: 1080, h: 1920, safe: { t: 250, b: 340, l: 60, r: 120 }, note: 'Keep text out of the top 250 px and bottom 340 px (profile, captions and reply bar).' },
    { id: 'ig-reel-cover', name: 'Reel cover (grid crop)', w: 1080, h: 1920, center: [1080, 1440], note: 'Shown as 3:4 on your profile grid. Keep the subject in the middle.' },
    { id: 'ig-profile', name: 'Profile photo', w: 320, h: 320, circle: true, note: 'Shown as a circle at about 110 px. Upload at least 320 × 320.' },
  ] },
  { id: 'x', name: 'X (Twitter)', items: [
    { id: 'x-post', name: 'Post image (landscape)', w: 1200, h: 675, note: '16:9. Shown uncropped in the timeline.' },
    { id: 'x-post-square', name: 'Post image (square)', w: 1080, h: 1080, note: '1:1 also displays uncropped.' },
    { id: 'x-post-portrait', name: 'Post image (portrait)', w: 1080, h: 1350, note: '4:5. Very tall images may be cropped in some views.' },
    { id: 'x-header', name: 'Header', w: 1500, h: 500, safe: { t: 60, b: 60, l: 0, r: 0 }, note: '3:1. The profile photo overlaps the lower left on mobile.' },
    { id: 'x-profile', name: 'Profile photo', w: 400, h: 400, circle: true, note: 'Circle crop (square for some business accounts).' },
    { id: 'x-card', name: 'Link card image', w: 1200, h: 628, note: 'Uses your page’s Open Graph / Twitter Card image.' },
  ] },
  { id: 'facebook', name: 'Facebook', items: [
    { id: 'fb-post', name: 'Feed post (landscape)', w: 1200, h: 630, note: '1.91:1.' },
    { id: 'fb-post-portrait', name: 'Feed post (portrait)', w: 1080, h: 1350, note: '4:5 takes the most space on mobile.' },
    { id: 'fb-square', name: 'Feed post (square)', w: 1080, h: 1080, note: '1:1.' },
    { id: 'fb-story', name: 'Story / Reel', w: 1080, h: 1920, safe: { t: 250, b: 340, l: 60, r: 60 }, note: 'Keep 14% top and 20% bottom clear.' },
    { id: 'fb-cover', name: 'Page cover photo', w: 851, h: 315, center: [640, 315], note: 'Desktop shows 820 × 312, mobile about 640 × 360 crop. Upload 1640 × 624 for sharpness.' },
    { id: 'fb-event', name: 'Event cover', w: 1920, h: 1005, note: '1.91:1.' },
    { id: 'fb-group', name: 'Group cover', w: 1640, h: 856, note: 'About 1.91:1.' },
    { id: 'fb-profile', name: 'Profile photo', w: 320, h: 320, circle: true, note: 'Shows at 176 px on desktop.' },
  ] },
  { id: 'linkedin', name: 'LinkedIn', items: [
    { id: 'li-post', name: 'Post image (landscape)', w: 1200, h: 627, note: '1.91:1. Also the link preview size.' },
    { id: 'li-square', name: 'Post image (square)', w: 1200, h: 1200, note: '1:1.' },
    { id: 'li-portrait', name: 'Post image (portrait)', w: 1080, h: 1350, note: '4:5 fills more of the mobile feed.' },
    { id: 'li-banner', name: 'Personal banner', w: 1584, h: 396, safe: { t: 0, b: 0, l: 470, r: 0 }, note: '4:1. Profile photo covers the lower left.' },
    { id: 'li-company', name: 'Company page cover', w: 4200, h: 700, note: '6:1.' },
    { id: 'li-profile', name: 'Profile photo', w: 400, h: 400, circle: true, note: 'Circle crop.' },
    { id: 'li-logo', name: 'Company logo', w: 400, h: 400, note: 'Square.' },
  ] },
  { id: 'tiktok', name: 'TikTok', items: [
    { id: 'tt-video', name: 'Video / photo post', w: 1080, h: 1920, safe: { t: 150, b: 440, l: 60, r: 140 }, note: 'Caption, buttons and music bar cover the bottom and right edge.' },
    { id: 'tt-photo', name: 'Photo carousel (portrait)', w: 1080, h: 1440, note: '3:4 is also supported in photo mode.' },
    { id: 'tt-profile', name: 'Profile photo', w: 400, h: 400, circle: true, note: 'Minimum 200 × 200; 400 looks sharper.' },
  ] },
  { id: 'youtube', name: 'YouTube', items: [
    { id: 'yt-thumb', name: 'Video thumbnail', w: 1280, h: 720, safe: { t: 0, b: 90, l: 0, r: 200 }, note: '16:9, under 2 MB. The duration stamp sits bottom right.' },
    { id: 'yt-banner', name: 'Channel banner', w: 2560, h: 1440, center: [1546, 423], note: 'Only the center 1546 × 423 shows on every device. Max 6 MB.' },
    { id: 'yt-shorts', name: 'Shorts', w: 1080, h: 1920, safe: { t: 150, b: 400, l: 60, r: 160 }, note: '9:16.' },
    { id: 'yt-profile', name: 'Profile picture', w: 800, h: 800, circle: true, note: 'Shown as a circle at 98 px.' },
    { id: 'yt-podcast', name: 'Podcast playlist cover', w: 1280, h: 1280, note: '1:1.' },
    { id: 'yt-watermark', name: 'Video watermark', w: 150, h: 150, note: 'PNG with transparency, under 1 MB.' },
  ] },
  { id: 'pinterest', name: 'Pinterest', items: [
    { id: 'pin-standard', name: 'Standard pin', w: 1000, h: 1500, note: '2:3, the recommended pin shape.' },
    { id: 'pin-square', name: 'Square pin', w: 1000, h: 1000, note: '1:1.' },
    { id: 'pin-video', name: 'Video pin / Idea pin', w: 1080, h: 1920, safe: { t: 270, b: 340, l: 65, r: 65 }, note: '9:16.' },
    { id: 'pin-board', name: 'Board cover', w: 600, h: 600, note: '1:1.' },
    { id: 'pin-profile', name: 'Profile photo', w: 280, h: 280, circle: true, note: 'Circle crop.' },
  ] },
  { id: 'threads', name: 'Threads', items: [
    { id: 'th-portrait', name: 'Post image (portrait)', w: 1080, h: 1350, note: '4:5.' },
    { id: 'th-tall', name: 'Post image (tall)', w: 1440, h: 1920, note: '3:4.' },
    { id: 'th-square', name: 'Post image (square)', w: 1080, h: 1080, note: '1:1.' },
    { id: 'th-profile', name: 'Profile photo', w: 640, h: 640, circle: true, note: 'Synced with Instagram by default.' },
  ] },
  { id: 'bluesky', name: 'Bluesky', items: [
    { id: 'bs-post', name: 'Post image', w: 1200, h: 675, note: '16:9. Up to 4 images per post.' },
    { id: 'bs-banner', name: 'Banner', w: 3000, h: 1000, note: '3:1.' },
    { id: 'bs-profile', name: 'Avatar', w: 1000, h: 1000, circle: true, note: 'Circle crop.' },
  ] },
  { id: 'mastodon', name: 'Mastodon', items: [
    { id: 'ma-header', name: 'Header', w: 1500, h: 500, note: '3:1. Instances may downscale.' },
    { id: 'ma-avatar', name: 'Avatar', w: 400, h: 400, note: 'Square; some apps round the corners.' },
    { id: 'ma-post', name: 'Post image', w: 1200, h: 675, note: 'Add alt text: many Mastodon users expect it.' },
  ] },
  { id: 'snapchat', name: 'Snapchat', items: [
    { id: 'sc-story', name: 'Story / Spotlight', w: 1080, h: 1920, safe: { t: 150, b: 340, l: 60, r: 60 }, note: '9:16.' },
    { id: 'sc-profile', name: 'Public profile photo', w: 320, h: 320, circle: true, note: '' },
  ] },
  { id: 'whatsapp', name: 'WhatsApp', items: [
    { id: 'wa-status', name: 'Status', w: 1080, h: 1920, note: '9:16.' },
    { id: 'wa-profile', name: 'Profile photo', w: 500, h: 500, circle: true, note: 'Circle crop.' },
    { id: 'wa-channel', name: 'Channel image', w: 640, h: 640, circle: true, note: '' },
  ] },
  { id: 'twitch', name: 'Twitch', items: [
    { id: 'tw-banner', name: 'Profile banner', w: 1200, h: 480, note: 'Max 10 MB.' },
    { id: 'tw-offline', name: 'Offline screen', w: 1920, h: 1080, note: '16:9.' },
    { id: 'tw-panel', name: 'Info panel', w: 320, h: 160, note: 'Width 320, height up to 300.' },
    { id: 'tw-profile', name: 'Profile picture', w: 256, h: 256, circle: true, note: '' },
  ] },
  { id: 'discord', name: 'Discord', items: [
    { id: 'dc-avatar', name: 'Avatar', w: 512, h: 512, circle: true, note: '' },
    { id: 'dc-banner', name: 'Profile banner', w: 680, h: 240, note: 'Nitro feature.' },
    { id: 'dc-server', name: 'Server banner', w: 960, h: 540, note: '16:9.' },
    { id: 'dc-invite', name: 'Server invite splash', w: 1920, h: 1080, note: '16:9.' },
  ] },
  { id: 'web', name: 'Web & link previews', items: [
    { id: 'og', name: 'Open Graph image', w: 1200, h: 630, safe: { t: 40, b: 40, l: 80, r: 80 }, note: 'Used by Facebook, LinkedIn, Slack, iMessage, Discord and more.' },
    { id: 'favicon', name: 'Favicon / app icon', w: 512, h: 512, note: 'Also export 192 and 180 (Apple touch icon).' },
    { id: 'email-header', name: 'Email header', w: 600, h: 200, note: '600 px is the safe email width.' },
  ] },
];
export const ratio = (w, h) => { const g = (a, b) => (b ? g(b, a % b) : a); const d = g(w, h); const a = w / d, b = h / d; return a <= 32 && b <= 32 ? `${a}:${b}` : `${(w / h).toFixed(2)}:1`; };
export const ALL = SIZES.flatMap((p) => p.items.map((it) => ({ ...it, platform: p.name, pid: p.id })));
