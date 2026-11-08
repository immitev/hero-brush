import { useEffect } from 'react';
import { setVolumes } from '../audio/engine';
import { setVoiceLang, setVoiceLevel, setVoiceMuted } from '../audio/voice';
import { LANG_TAG, useT } from '../i18n';
import { useStore } from '../game/store';
import { UpdatePrompt } from './components/UpdatePrompt';
import { HeroSelect } from './screens/HeroSelect';
import { Hub } from './screens/Hub';
import { Parent } from './screens/Parent';
import { Play } from './screens/Play';
import { Wardrobe } from './screens/Wardrobe';

export function App() {
  const ready = useStore((s) => s.ready);
  const screen = useStore((s) => s.screen);
  const hydrate = useStore((s) => s.hydrate);
  const settings = useStore((s) => s.settings);
  const { t } = useT();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    setVolumes(settings.musicVolume, settings.sfxVolume);
    setVoiceLevel(settings.voiceVolume);
    setVoiceMuted(settings.voiceMuted);
  }, [settings.musicVolume, settings.sfxVolume, settings.voiceVolume, settings.voiceMuted]);

  useEffect(() => {
    setVoiceLang(settings.lang);
    document.documentElement.lang = LANG_TAG[settings.lang].slice(0, 2);
  }, [settings.lang]);

  if (!ready) {
    return (
      <div className="screen loading">
        <div className="spinner" role="status" aria-label={t('app.loading')} />
      </div>
    );
  }
  return (
    <>
      {screen === 'hub' && <Hub />}
      {screen === 'select' && <HeroSelect />}
      {screen === 'wardrobe' && <Wardrobe />}
      {screen === 'play' && <Play />}
      {screen === 'parent' && <Parent />}
      <UpdatePrompt />
    </>
  );
}
