// Uninstall feedback from ghostrol.com/uninstalled, sent without any account.
// Each answer becomes an issue in a private repository only the owner can see.
// Nothing about the sender is kept: no IP address, browser details or cookies (D33).

const REPO = 'UditBangra/ghostrol-feedback';
const ORIGIN = 'https://ghostrol.com';
const REASONS = new Set([
  'A game did not play right',
  'The mouse felt wrong',
  'It felt slow or laggy',
  'Setting up keys was confusing',
  'I switched to something else',
  'I only wanted to try it',
  'Something else',
]);

const back = (path) => new Response(null, { status: 303, headers: { Location: `${ORIGIN}${path}` } });

/** Keeps text plain: no control characters, a length cap, and no way to end the code fence. */
function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/`{3,}/g, '``')
    .trim()
    .slice(0, max);
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return back('/uninstalled');
    if (request.headers.get('origin') !== ORIGIN) return new Response('Forbidden', { status: 403 });

    let form;
    try {
      form = await request.formData();
    } catch {
      return back('/uninstalled');
    }

    // A hidden field people never see. Bots that fill every field are thanked and ignored.
    if (clean(form.get('website'), 200)) return back('/uninstalled/thanks');

    const reason = clean(form.get('reason'), 60);
    const game = clean(form.get('game'), 80);
    const details = clean(form.get('details'), 2000);
    if (!REASONS.has(reason) && !details) return back('/uninstalled');

    const token = process.env.GHOSTROL_FEEDBACK_TOKEN;
    if (!token) return back('/uninstalled/sorry');

    const title = `Removed: ${REASONS.has(reason) ? reason : 'no reason picked'}`;
    const body = [
      `**Reason:** ${REASONS.has(reason) ? reason : 'not picked'}`,
      `**Game:** ${game ? '`' + game.replace(/`/g, "'") + '`' : 'not given'}`,
      '',
      details ? '**What happened**\n\n```text\n' + details + '\n```' : '_No details written._',
      '',
      '_Sent from ghostrol.com/uninstalled. No sender details are kept._',
    ].join('\n');

    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'ghostrol-feedback',
        },
        body: JSON.stringify({ title, body, labels: ['uninstall'] }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.error('feedback: GitHub answered', res.status);
        return back('/uninstalled/sorry');
      }
    } catch (error) {
      console.error('feedback: request failed', error?.name);
      return back('/uninstalled/sorry');
    }
    return back('/uninstalled/thanks');
  },
};
