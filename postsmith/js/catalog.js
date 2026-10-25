// Tool catalog shared by the site build (Node) and the browser.
export const PAGES = [
  { slug: 'fancy-text-generator', tool: 'fancy', icon: 'sparkle', name: 'Fancy Text Generator', short: 'Fancy text', blurb: '40+ Unicode font styles for bios and posts, with one-click copy.' },
  { slug: 'character-counter', tool: 'counter', icon: 'ruler', name: 'Character Counter', short: 'Counter', blurb: 'Live limits for X, Instagram, TikTok, LinkedIn, YouTube and more.' },
  { slug: 'hashtag-generator', tool: 'hashtags', icon: 'hash', name: 'Hashtag Generator', short: 'Hashtags', blurb: 'Broad and niche hashtags from your keywords, sized per platform.' },
  { slug: 'emoji-picker', tool: 'emoji', icon: 'smile', name: 'Emoji Picker', short: 'Emoji', blurb: 'Every Unicode emoji with search, skin tones and multi-copy.' },
  { slug: 'social-media-image-sizes', tool: 'sizes', icon: 'frame', name: 'Image Size Guide', short: 'Image sizes', blurb: 'Current image sizes for every platform, plus blank templates.' },
  { slug: 'link-in-bio-builder', tool: 'bio', icon: 'link', name: 'Link in Bio Builder', short: 'Link in bio', blurb: 'Design a link-in-bio page and export one self-contained HTML file.' },
];
export const bySlug = (s) => PAGES.find((p) => p.slug === s);
