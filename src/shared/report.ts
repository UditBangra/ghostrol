// Builds the link behind "Report a problem". It opens a new GitHub issue with the bug
// form already filled in. The user sees everything before sending; Ghostrol itself sends
// nothing.

import { BRAND } from './brand';

export interface ReportDetails {
  /** Ghostrol's version, from the manifest. */
  version: string;
  /** navigator.userAgent. */
  userAgent: string;
  game?: string | undefined;
  preset?: string | undefined;
}

/** "Chrome 142 on Windows", or as close as the user agent allows. */
export function describeBrowser(userAgent: string): string {
  const edge = /Edg\/(\d+)/.exec(userAgent);
  const chrome = /Chrome\/(\d+)/.exec(userAgent);
  const browser = edge ? `Edge ${edge[1]}` : chrome ? `Chrome ${chrome[1]}` : 'Unknown browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /CrOS/.test(userAgent)
      ? 'ChromeOS'
      : /Mac OS X/.test(userAgent)
        ? 'macOS'
        : /Android/.test(userAgent)
          ? 'Android'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

/** Field ids match .github/ISSUE_TEMPLATE/bug_report.yml. */
export function problemReportUrl(details: ReportDetails): string {
  const params = new URLSearchParams({ template: 'bug_report.yml' });
  params.set('title', details.game ? `${details.game}: ` : '');
  if (details.game) params.set('game', details.game);
  if (details.preset) params.set('preset', details.preset);
  params.set('version', details.version);
  params.set('browser', describeBrowser(details.userAgent));
  return `${BRAND.repoUrl}/issues/new?${params.toString()}`;
}
