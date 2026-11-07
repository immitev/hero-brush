import { useMemo, useState } from 'react';
import { setVolumes } from '../../audio/engine';
import { setVoiceMuted } from '../../audio/voice';
import { useStore } from '../../game/store';
import { formatClock } from '../../game/zones';
import { getHero } from '../../heroes';
import { StarIcon } from '../components/Icons';

function Gate({ onPass }: { onPass: () => void }) {
  const [a, b] = useMemo(() => [3 + Math.floor(Math.random() * 7), 3 + Math.floor(Math.random() * 7)], []);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(answer) === a * b) onPass();
    else {
      setWrong(true);
      setAnswer('');
    }
  };
  return (
    <form className="card gate" onSubmit={check}>
      <h2>Parents only</h2>
      <p>
        What is {a} × {b}?
      </p>
      <input type="number" inputMode="numeric" value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus aria-label="Answer" />
      {wrong && <small className="error">Not quite, try again.</small>}
      <button className="btn" type="submit">
        Enter
      </button>
    </form>
  );
}

export function Parent() {
  const go = useStore((s) => s.go);
  const [passed, setPassed] = useState(false);
  const sessions = useStore((s) => s.sessions);
  const streak = useStore((s) => s.streak);
  const totalStars = useStore((s) => s.totalStars);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetAllData = useStore((s) => s.resetAllData);
  const [confirmReset, setConfirmReset] = useState(false);

  const recent = useMemo(() => [...sessions].sort((x, y) => y.startedAt - x.startedAt).slice(0, 30), [sessions]);
  const completedCount = sessions.filter((s) => s.completed).length;

  return (
    <div className="screen parent">
      <div className="parent-top">
        <button className="btn btn-ghost btn-small" onClick={() => go('hub')}>
          Back
        </button>
        <h2>Parent area</h2>
        <span />
      </div>
      {!passed ? (
        <Gate onPass={() => setPassed(true)} />
      ) : (
        <div className="parent-body">
          <section className="card">
            <h3>Summary</h3>
            <div className="summary">
              <div>
                <strong>{streak.current}</strong>
                <span>day streak</span>
              </div>
              <div>
                <strong>{streak.best}</strong>
                <span>best streak</span>
              </div>
              <div>
                <strong>{completedCount}</strong>
                <span>full sessions</span>
              </div>
              <div>
                <strong>{totalStars}</strong>
                <span>stars</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Settings</h3>
            <label className="row">
              <span>Music volume</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.musicVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateSettings({ musicVolume: v });
                  setVolumes(v, settings.sfxVolume);
                }}
              />
            </label>
            <label className="row">
              <span>Sound effects</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateSettings({ sfxVolume: v });
                  setVolumes(settings.musicVolume, v);
                }}
              />
            </label>
            <label className="row">
              <span>Mute voice prompts</span>
              <input
                type="checkbox"
                checked={settings.voiceMuted}
                onChange={(e) => {
                  updateSettings({ voiceMuted: e.target.checked });
                  setVoiceMuted(e.target.checked);
                }}
              />
            </label>
            <div className="row">
              <span>Graphics quality</span>
              <div className="segmented">
                {(['low', 'high'] as const).map((q) => (
                  <button key={q} className={settings.quality === q ? 'active' : ''} onClick={() => updateSettings({ quality: q })}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
            <small>Low quality turns off glow effects and uses fewer particles. Use it if the game stutters.</small>
          </section>

          <section className="card">
            <h3>History</h3>
            {recent.length === 0 ? (
              <p className="muted">No sessions yet.</p>
            ) : (
              <table className="history">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Slot</th>
                    <th>Hero</th>
                    <th>Time</th>
                    <th>Stars</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id ?? s.startedAt} className={s.completed ? '' : 'partial'}>
                      <td>{s.dateKey}</td>
                      <td>{s.slot}</td>
                      <td>{getHero(s.heroId).name}</td>
                      <td>{formatClock(s.elapsed)}</td>
                      <td>
                        <span className="stars-inline">
                          {Array.from({ length: s.stars }, (_, i) => (
                            <StarIcon key={i} size={14} />
                          ))}
                          {s.stars === 0 && '–'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card danger">
            <h3>Data</h3>
            <p className="muted">Everything is stored only on this device. No accounts, no analytics.</p>
            {!confirmReset ? (
              <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                Delete all data
              </button>
            ) : (
              <div className="row">
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    void resetAllData();
                    setConfirmReset(false);
                  }}
                >
                  Yes, delete everything
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
