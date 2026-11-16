// The extension manifest, generated so the version always matches package.json.

const XBOX_PAGES = [
  'https://www.xbox.com/*/play*',
  'https://www.xbox.com/play*',
  'https://play.xbox.com/*',
];
// web_accessible_resources only accepts whole-origin patterns (path must be /*).
const XBOX_ORIGINS = ['https://www.xbox.com/*', 'https://play.xbox.com/*'];

export function manifest(version) {
  return {
    manifest_version: 3,
    name: '__MSG_name__',
    short_name: '__MSG_shortName__',
    description: '__MSG_description__',
    version,
    default_locale: 'en',
    minimum_chrome_version: '111',
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
    action: {
      default_popup: 'popup.html',
      default_title: '__MSG_actionTitle__',
      default_icon: { 16: 'icons/16.png', 32: 'icons/32.png' },
    },
    options_page: 'studio.html',
    background: { service_worker: 'background.js' },
    permissions: ['storage'],
    content_scripts: [
      // The bridge goes first so it is listening before the page script says hello.
      { matches: XBOX_PAGES, js: ['bridge.js'], run_at: 'document_start' },
      { matches: XBOX_PAGES, js: ['page.js'], run_at: 'document_start', world: 'MAIN' },
    ],
    // The overlay over the game uses the extension's font and skull icon.
    web_accessible_resources: [{ resources: ['fonts/*', 'icons/*'], matches: XBOX_ORIGINS }],
    commands: {
      toggle: {
        suggested_key: { default: 'Alt+K' },
        description: '__MSG_commandToggle__',
      },
      'next-preset': {
        suggested_key: { default: 'Alt+Period' },
        description: '__MSG_commandNextPreset__',
      },
      controls: {
        suggested_key: { default: 'Alt+C' },
        description: '__MSG_commandControls__',
      },
    },
  };
}
