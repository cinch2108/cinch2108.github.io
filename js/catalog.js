// Single source of truth for tool pages (used by the browser and by the static build script).
export const PAGES = [
  { slug: 'merge-pdf', name: 'Merge PDF', tool: 'merge', icon: 'merge', group: 'Organize', blurb: 'Combine PDFs and images in any order.' },
  { slug: 'split-pdf', name: 'Split PDF', tool: 'split', mode: 'ranges', icon: 'split', group: 'Organize', blurb: 'Split by ranges, every page or every N pages.' },
  { slug: 'extract-pdf-pages', name: 'Extract pages', tool: 'split', mode: 'extract', icon: 'layers', group: 'Organize', blurb: 'Pull selected pages into a new PDF.' },
  { slug: 'organize-pdf', name: 'Organize PDF', tool: 'organize', mode: 'organize', icon: 'grid', group: 'Organize', blurb: 'Drag to reorder, rotate or delete pages.' },
  { slug: 'rotate-pdf', name: 'Rotate PDF', tool: 'organize', mode: 'rotate', icon: 'rotate', group: 'Organize', blurb: 'Rotate one page or the whole document.' },
  { slug: 'delete-pdf-pages', name: 'Delete PDF pages', tool: 'organize', mode: 'delete', icon: 'trash', group: 'Organize', blurb: 'Remove the pages you don\u2019t need.' },
  { slug: 'compress-pdf', name: 'Compress PDF', tool: 'compress', icon: 'compress', group: 'Optimize', blurb: 'Shrink PDFs, or hit an exact target size.' },
  { slug: 'jpg-to-pdf', name: 'JPG to PDF', tool: 'img2pdf', icon: 'image', group: 'Convert', blurb: 'Turn JPG, PNG and WebP images into a PDF.' },
  { slug: 'pdf-to-jpg', name: 'PDF to JPG', tool: 'pdf2img', mode: 'jpg', icon: 'download', group: 'Convert', blurb: 'Save every page as a high-quality JPG.' },
  { slug: 'pdf-to-png', name: 'PDF to PNG', tool: 'pdf2img', mode: 'png', icon: 'download', group: 'Convert', blurb: 'Lossless PNG images of each page, up to 300 DPI.' },
  { slug: 'sign-pdf', name: 'Fill & sign PDF', tool: 'sign', icon: 'pen', group: 'Edit', blurb: 'Draw, type or upload a signature and add text.' },
  { slug: 'add-page-numbers', name: 'Add page numbers', tool: 'numbers', icon: 'hash', group: 'Edit', blurb: 'Number pages in any position and format.' },
  { slug: 'watermark-pdf', name: 'Watermark PDF', tool: 'watermark', icon: 'drop', group: 'Edit', blurb: 'Stamp text or a logo on every page.' },
  { slug: 'edit-pdf-metadata', name: 'Edit PDF metadata', tool: 'metadata', icon: 'tag', group: 'Edit', blurb: 'Change or wipe title, author and keywords.' },
  { slug: 'protect-pdf', name: 'Protect PDF', tool: 'protect', mode: 'protect', icon: 'lock', group: 'Security', blurb: 'Add an AES-256 password and permissions.' },
  { slug: 'unlock-pdf', name: 'Unlock PDF', tool: 'protect', mode: 'unlock', icon: 'unlock', group: 'Security', blurb: 'Remove a password you know.' },
  { slug: 'pdf-viewer', name: 'PDF viewer', tool: 'viewer', icon: 'book', group: 'View', blurb: 'Read PDFs privately with zoom and page jump.' },
];
export const bySlug = (s) => PAGES.find((p) => p.slug === s);
export const url = (slug) => `/${slug}/`;
