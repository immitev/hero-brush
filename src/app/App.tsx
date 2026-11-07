import { useEffect } from 'react';
import { setVolumes } from '../audio/engine';
import { setVoiceMuted } from '../audio/voice';
import { useStore } from '../game/store';
import { UpdatePrompt } from './components/UpdatePrompt';
import { HeroSelect } from './screens/HeroSelect';
import { Hub } from './screens/Hub';
import { Parent } from './screens/Parent';
import { Play } from './screens/Play';

export function App() {
  const ready = useStore((s) => s.ready);
  const screen = useStore((s) => s.screen);
  const hydrate = useStore((s) => s.hydrate);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    setVolumes(settings.musicVolume, settings.sfxVolume);
    setVoiceMuted(settings.voiceMuted);
  }, [settings.musicVolume, settings.sfxVolume, settings.voiceMuted]);

  if (!ready) {
    return (
      <div className="screen loading">
        <div className="spinner" />
      </div>
    );
  }
  return (
    <>
      {screen === 'hub' && <Hub />}
      {screen === 'select' && <HeroSelect />}
      {screen === 'play' && <Play />}
      {screen === 'parent' && <Parent />}
      <UpdatePrompt />
    </>
  );
}
