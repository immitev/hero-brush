import { useMemo, useState } from 'react';
import { setVolumes } from '../../audio/engine';
import { setVoiceLevel, setVoiceMuted } from '../../audio/voice';
import { useStore } from '../../game/store';
import { formatClock } from '../../game/segments';
import { ENABLED_LANGS, LANG_NAME, useT } from '../../i18n';
import { StarIcon } from '../components/Icons';
import { Gate } from './ParentGate';

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
  const { t, heroName } = useT();

  const recent = useMemo(() => [...sessions].sort((x, y) => y.startedAt - x.startedAt).slice(0, 30), [sessions]);
  const completedCount = sessions.filter((s) => s.completed).length;

  return (
    <div className="screen parent">
      <div className="parent-top">
        <button className="btn btn-ghost btn-small" onClick={() => go('hub')}>
          {t('parent.back')}
        </button>
        <h2>{t('parent.title')}</h2>
        <span />
      </div>
      {!passed ? (
        <Gate onPass={() => setPassed(true)} />
      ) : (
        <div className="parent-body">
          <section className="card">
            <h3>{t('parent.howTitle')}</h3>
            <p className="muted">{t('parent.how')}</p>
          </section>
          <section className="card">
            <h3>{t('parent.summary')}</h3>
            <div className="summary">
              <div>
                <strong>{streak.current}</strong>
                <span>{t('parent.dayStreak')}</span>
              </div>
              <div>
                <strong>{streak.best}</strong>
                <span>{t('parent.bestStreak')}</span>
              </div>
              <div>
                <strong>{completedCount}</strong>
                <span>{t('parent.fullSessions')}</span>
              </div>
              <div>
                <strong>{totalStars}</strong>
                <span>{t('parent.stars')}</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>{t('parent.settings')}</h3>
            {ENABLED_LANGS.length > 1 && (
              <div className="row">
                <span>{t('parent.language')}</span>
                <div className="segmented no-caps">
                  {ENABLED_LANGS.map((l) => (
                    <button key={l} lang={l} className={settings.lang === l ? 'active' : ''} onClick={() => updateSettings({ lang: l })}>
                      {LANG_NAME[l]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="row">
              <span>{t('parent.musicVolume')}</span>
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
              <span>{t('parent.sfxVolume')}</span>
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
              <span>{t('parent.voiceVolume')}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.voiceVolume}
                disabled={settings.voiceMuted}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateSettings({ voiceVolume: v });
                  setVoiceLevel(v);
                }}
              />
            </label>
            <label className="row">
              <span>{t('parent.muteVoice')}</span>
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
              <span>{t('parent.quality')}</span>
              <div className="segmented">
                {(['low', 'high'] as const).map((q) => (
                  <button key={q} className={settings.quality === q ? 'active' : ''} onClick={() => updateSettings({ quality: q })}>
                    {t(`parent.quality.${q}`)}
                  </button>
                ))}
              </div>
            </div>
            <small>{t('parent.qualityHint')}</small>
          </section>

          <section className="card">
            <h3>{t('parent.history')}</h3>
            {recent.length === 0 ? (
              <p className="muted">{t('parent.noSessions')}</p>
            ) : (
              <table className="history">
                <thead>
                  <tr>
                    <th>{t('parent.col.date')}</th>
                    <th>{t('parent.col.slot')}</th>
                    <th>{t('parent.col.hero')}</th>
                    <th>{t('parent.col.time')}</th>
                    <th>{t('parent.col.stars')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id ?? s.startedAt} className={s.completed ? '' : 'partial'}>
                      <td>{s.dateKey}</td>
                      <td>{t(s.slot === 'morning' ? 'parent.slot.morning' : 'parent.slot.evening')}</td>
                      <td>{heroName(s.heroId)}</td>
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
            <h3>{t('parent.data')}</h3>
            <p className="muted">{t('parent.dataNote')}</p>
            {!confirmReset ? (
              <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>
                {t('parent.delete')}
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
                  {t('parent.deleteConfirm')}
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                  {t('parent.cancel')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
