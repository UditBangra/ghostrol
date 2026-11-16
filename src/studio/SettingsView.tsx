import { useMemo, useRef, useState } from 'preact/hooks';
import { BRAND } from '../shared/brand';
import type { FlameColor, HudCorner, HudMode, Settings } from '../shared/settings';
import { exportBackup, importBackup, saveSettings, type StoredState } from '../shared/storage';
import { Reveal, Row, Segmented, Switch } from '../ui/components';
import { presetMap } from '../ui/library';

export function SettingsView({ state }: { state: StoredState }) {
  const { settings } = state;
  const presets = useMemo(() => [...presetMap(state).values()], [state]);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const toggle = (key: keyof Settings) => (value: boolean) => void saveSettings({ [key]: value });

  const backup = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${BRAND.name.toLowerCase()}-backup-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage('Backup saved to your downloads.');
  };

  const restore = async (file: File) => {
    try {
      const count = await importBackup(JSON.parse(await file.text()));
      setMessage(`Restored your settings and ${count} preset${count === 1 ? '' : 's'}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That file could not be read.');
    }
  };

  return (
    <div class="settings">
      <header class="view-head">
        <h1 class="wide">Settings</h1>
      </header>

      <section class="panel">
        <h2>Playing</h2>
        <Row label={`${BRAND.name} is on`} hint="Off means it does nothing on Xbox Cloud Gaming.">
          <Switch checked={settings.enabled} label="On" onChange={toggle('enabled')} />
        </Row>
        <Row
          label="Pick a preset for each game"
          hint="Uses a preset made for the game, or one for its genre."
        >
          <Switch
            checked={settings.autoDetect}
            label="Pick a preset for each game"
            onChange={toggle('autoDetect')}
          />
        </Row>
        <Row label="Default preset" hint="Used when a game is unknown or automatic picking is off.">
          <select
            class="select"
            value={settings.defaultPresetId}
            onChange={(e) =>
              void saveSettings({ defaultPresetId: (e.target as HTMLSelectElement).value })
            }
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Row>
        <Row
          label="Hand over to a controller"
          hint="Pick up a controller and it takes over. Press a key to switch back."
        >
          <Switch
            checked={settings.controllerHandoff}
            label="Hand over to a controller"
            onChange={toggle('controllerHandoff')}
          />
        </Row>
      </section>

      <section class="panel">
        <h2>Mouse and screen</h2>
        <Row
          label="Raw mouse input"
          hint="Skips your system's mouse acceleration for steadier aim."
        >
          <Switch
            checked={settings.rawMouse}
            label="Raw mouse input"
            onChange={toggle('rawMouse')}
          />
        </Row>
        <Row label="Messages over the game" hint="Short notes, such as which preset loaded.">
          <Switch
            checked={settings.hints}
            label="Messages over the game"
            onChange={toggle('hints')}
          />
        </Row>
        <Row
          label="Input display"
          hint="Shows each key you press and the button it pressed, or the sticks and triggers."
        >
          <Choice<HudMode>
            label="Input display"
            value={settings.hud}
            options={[
              ['off', 'Off'],
              ['keys', 'Keys'],
              ['sticks', 'Sticks'],
              ['both', 'Both'],
            ]}
            onChange={(hud) => void saveSettings({ hud })}
          />
        </Row>
        <Reveal open={settings.hud !== 'off'}>
          <Row label="Display corner" hint="Bottom left or bottom right of the game.">
            <Choice<HudCorner>
              label="Display corner"
              value={settings.hudCorner}
              options={[
                ['left', 'Left'],
                ['right', 'Right'],
              ]}
              onChange={(hudCorner) => void saveSettings({ hudCorner })}
            />
          </Row>
        </Reveal>
      </section>

      <section class="panel">
        <h2>Look</h2>
        <Row
          label="Fire around the popup"
          hint="Burns brighter while you play. Ghost fire is pale and cold. Shown still if your system asks for less motion."
        >
          <Choice<'off' | FlameColor>
            label="Fire around the popup"
            value={settings.fire ? settings.flame : 'off'}
            options={[
              ['off', 'Off'],
              ['ember', 'Ember'],
              ['ghost', 'Ghost'],
            ]}
            onChange={(choice) =>
              void saveSettings(choice === 'off' ? { fire: false } : { fire: true, flame: choice })
            }
          />
        </Row>
      </section>

      <section class="panel">
        <h2>Shortcuts</h2>
        <Row
          label="Turn on or off, switch presets, show the keys"
          hint="Defaults are Alt+K, Alt+Period and Alt+C. They also work in full screen."
        >
          <button
            class="btn"
            onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            Change shortcuts
          </button>
        </Row>
      </section>

      <section class="panel">
        <h2>Backup</h2>
        <Row
          label="Save everything to a file"
          hint="Settings, your presets and your per-game picks."
        >
          <div class="row-actions">
            <button class="btn" onClick={backup}>
              Save backup
            </button>
            <button class="btn quiet" onClick={() => fileInput.current?.click()}>
              Restore
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) void restore(file);
                (e.target as HTMLInputElement).value = '';
              }}
            />
          </div>
        </Row>
        {message && (
          <p class="dim small" role="status">
            {message}
          </p>
        )}
      </section>

      <section class="panel about">
        <h2>Privacy</h2>
        <p>
          {BRAND.name} makes no network requests. It has no analytics, no accounts and no tracking.
          Your keys and presets stay in your browser and in Chrome sync if you use it. It only runs
          on Xbox Cloud Gaming pages.
        </p>
        <p class="faint small">
          Version {chrome.runtime.getManifest().version}. Not affiliated with Microsoft or Xbox.{' '}
          <a href={BRAND.repoUrl} target="_blank" rel="noreferrer">
            Source code
          </a>
          {', '}
          <a href={BRAND.issuesUrl} target="_blank" rel="noreferrer">
            report a problem
          </a>
          .
        </p>
      </section>
    </div>
  );
}

function Choice<T extends string>(props: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return <Segmented compact {...props} />;
}
