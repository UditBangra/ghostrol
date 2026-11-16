import { useEffect, useState } from 'preact/hooks';
import { BRAND } from '../shared/brand';
import { Wordmark } from '../ui/components';
import { useStoredState, useThumb } from '../ui/hooks';
import { CreateView } from './CreateView';
import { GamesView } from './GamesView';
import { PresetsView } from './PresetsView';
import { scrollToTop } from './scroll';
import { SettingsView } from './SettingsView';
import { WelcomeView } from './WelcomeView';

type Route =
  | { view: 'welcome' }
  | { view: 'create' }
  | { view: 'presets'; id?: string }
  | { view: 'games' }
  | { view: 'settings' };

function parseHash(hash: string): Route {
  const [view, ...rest] = hash.replace(/^#/, '').split('/');
  if (view === 'welcome') return { view };
  if (view === 'create') return { view };
  if (view === 'games') return { view };
  if (view === 'settings') return { view };
  const id = rest.join('/');
  return id ? { view: 'presets', id: decodeURIComponent(id) } : { view: 'presets' };
}

export function navigate(hash: string): void {
  location.hash = hash;
}

const NAV = [
  { hash: 'presets', label: 'Presets' },
  { hash: 'create', label: 'Make a preset' },
  { hash: 'games', label: 'Games' },
  { hash: 'settings', label: 'Settings' },
  { hash: 'welcome', label: 'Getting started' },
] as const;

export function Studio() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const state = useStoredState();
  // The highlight behind the current section slides there instead of jumping.
  const railRef = useThumb<HTMLUListElement>('a[aria-current="page"]', route.view);

  useEffect(() => {
    const update = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  // A new section starts at its top. Picking another preset in the list does not move.
  useEffect(() => scrollToTop(), [route.view]);

  return (
    <div class="studio">
      <nav class="rail" aria-label="Sections">
        <a class="rail-brand" href="#presets">
          <img src="icons/128.png" width="38" height="38" alt="" />
          <Wordmark />
        </a>
        <ul ref={railRef}>
          <li class="thumb" aria-hidden="true" />
          {NAV.map((item) => (
            <li key={item.hash}>
              <a
                href={`#${item.hash}`}
                aria-current={route.view === item.hash ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <p class="rail-foot faint">
          Free and open source.{' '}
          <a href={BRAND.repoUrl} target="_blank" rel="noreferrer">
            Source code
          </a>
        </p>
      </nav>
      <div class="stage" key={route.view}>
        {!state ? null : route.view === 'welcome' ? (
          <WelcomeView fire={state.settings.fire ? state.settings.flame : null} />
        ) : route.view === 'create' ? (
          <CreateView state={state} />
        ) : route.view === 'games' ? (
          <GamesView state={state} />
        ) : route.view === 'settings' ? (
          <SettingsView state={state} />
        ) : (
          <PresetsView state={state} selectedId={route.id} />
        )}
      </div>
    </div>
  );
}
