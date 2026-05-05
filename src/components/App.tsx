import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FormEvent } from 'react';

import { Heading } from './Heading';
import styles from './App.module.css';

type TimerModeCategory = 'focus' | 'break';

type TimerMode = {
  id: string;
  label: string;
  duration: number;
  description: string;
  category: TimerModeCategory;
  isCustom?: boolean;
};

type FocusSession = {
  id: string;
  modeId: string;
  modeLabel: string;
  duration: number;
  completedAt: string;
};

const MINUTE_IN_SECONDS = 60;
const CUSTOM_MODES_STORAGE_KEY = 'chronos-pomodoro:custom-modes';
const FOCUS_SESSIONS_STORAGE_KEY = 'chronos-pomodoro:focus-sessions';
const MAX_CUSTOM_MODE_MINUTES = 180;
const MAX_STORED_FOCUS_SESSIONS = 200;

const DEFAULT_TIMER_MODES: TimerMode[] = [
  {
    id: 'pomodoro',
    label: 'Pomodoro',
    duration: 25 * MINUTE_IN_SECONDS,
    description: 'Foco profundo',
    category: 'focus',
  },
  {
    id: 'shortBreak',
    label: 'Pausa curta',
    duration: 5 * MINUTE_IN_SECONDS,
    description: 'Recuperacao rapida',
    category: 'break',
  },
  {
    id: 'longBreak',
    label: 'Pausa longa',
    duration: 15 * MINUTE_IN_SECONDS,
    description: 'Recarregar energia',
    category: 'break',
  },
];

function createStorageId(prefix: string) {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / MINUTE_IN_SECONDS)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % MINUTE_IN_SECONDS).toString().padStart(2, '0');

  return `${minutes}:${seconds}`;
}

function formatSessionDate(isoDate: string) {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponivel';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function isSameLocalDay(isoDate: string) {
  const date = new Date(isoDate);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getModeById(modeId: string, modes: TimerMode[]) {
  return modes.find((mode) => mode.id === modeId) ?? DEFAULT_TIMER_MODES[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function loadCustomModes() {
  try {
    const storedModes = window.localStorage.getItem(CUSTOM_MODES_STORAGE_KEY);

    if (!storedModes) {
      return [];
    }

    const parsedModes: unknown = JSON.parse(storedModes);

    if (!Array.isArray(parsedModes)) {
      return [];
    }

    return parsedModes.flatMap((mode): TimerMode[] => {
      if (!isRecord(mode)) {
        return [];
      }

      const label = typeof mode.label === 'string' ? mode.label.trim() : '';
      const description =
        typeof mode.description === 'string' ? mode.description.trim() : '';
      const duration =
        typeof mode.duration === 'number' && Number.isFinite(mode.duration)
          ? mode.duration
          : 0;

      if (!label || duration < MINUTE_IN_SECONDS) {
        return [];
      }

      return [
        {
          id: typeof mode.id === 'string' ? mode.id : createStorageId('custom'),
          label,
          duration,
          description: description || 'Concentracao personalizada',
          category: 'focus',
          isCustom: true,
        },
      ];
    });
  } catch {
    return [];
  }
}

function loadFocusSessions() {
  try {
    const storedSessions = window.localStorage.getItem(FOCUS_SESSIONS_STORAGE_KEY);

    if (!storedSessions) {
      return [];
    }

    const parsedSessions: unknown = JSON.parse(storedSessions);

    if (!Array.isArray(parsedSessions)) {
      return [];
    }

    return parsedSessions.flatMap((session): FocusSession[] => {
      if (!isRecord(session)) {
        return [];
      }

      const id = typeof session.id === 'string' ? session.id : createStorageId('focus');
      const modeId = typeof session.modeId === 'string' ? session.modeId : 'pomodoro';
      const modeLabel =
        typeof session.modeLabel === 'string' ? session.modeLabel.trim() : 'Pomodoro';
      const duration =
        typeof session.duration === 'number' && Number.isFinite(session.duration)
          ? session.duration
          : 0;
      const completedAt =
        typeof session.completedAt === 'string' ? session.completedAt : '';

      if (!modeLabel || duration < MINUTE_IN_SECONDS || Number.isNaN(Date.parse(completedAt))) {
        return [];
      }

      return [
        {
          id,
          modeId,
          modeLabel,
          duration,
          completedAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function createAudioContext() {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

function playBellSound(audioContext: AudioContext) {
  const now = audioContext.currentTime;
  const bellTones = [
    { frequency: 880, gain: 0.22, duration: 1.35 },
    { frequency: 1320, gain: 0.12, duration: 1.6 },
    { frequency: 1760, gain: 0.07, duration: 1.85 },
  ];

  bellTones.forEach(({ duration, frequency, gain }) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, now + duration);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  });
}

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [customModes, setCustomModes] = useState<TimerMode[]>(loadCustomModes);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>(loadFocusSessions);
  const [activeModeId, setActiveModeId] = useState(DEFAULT_TIMER_MODES[0].id);
  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_TIMER_MODES[0].duration,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [customModeName, setCustomModeName] = useState('');
  const [customModeMinutes, setCustomModeMinutes] = useState('30');
  const [customModeDescription, setCustomModeDescription] = useState('');
  const [customModeError, setCustomModeError] = useState('');

  const timerModes = useMemo(
    () => [...DEFAULT_TIMER_MODES, ...customModes],
    [customModes],
  );
  const activeMode = getModeById(activeModeId, timerModes);
  const completedFocuses = focusSessions.length;
  const todaysFocuses = useMemo(
    () => focusSessions.filter((session) => isSameLocalDay(session.completedAt)).length,
    [focusSessions],
  );
  const focusedMinutes = useMemo(
    () =>
      focusSessions.reduce(
        (total, session) => total + Math.round(session.duration / MINUTE_IN_SECONDS),
        0,
      ),
    [focusSessions],
  );
  const latestFocusSessions = focusSessions.slice(0, 4);
  const progressPercentage =
    ((activeMode.duration - remainingSeconds) / activeMode.duration) * 100;
  const isTimerFinished = remainingSeconds === 0;
  const timerLabel = formatTime(remainingSeconds);
  const primaryActionLabel = isRunning
    ? 'Pausar'
    : remainingSeconds === activeMode.duration
      ? 'Iniciar'
      : 'Continuar';
  const statusText = isTimerFinished
    ? 'Sessao finalizada'
    : isRunning
      ? 'Sessao em andamento'
      : 'Pronto para focar';

  const getAudioContext = useCallback(() => {
    audioContextRef.current ??= createAudioContext();

    return audioContextRef.current;
  }, []);

  const prepareBellSound = useCallback(() => {
    const audioContext = getAudioContext();

    if (audioContext?.state === 'suspended') {
      void audioContext.resume();
    }
  }, [getAudioContext]);

  const playCompletionBell = useCallback(() => {
    const audioContext = getAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume().then(() => playBellSound(audioContext));
      return;
    }

    playBellSound(audioContext);
  }, [getAudioContext]);

  useEffect(() => {
    saveToStorage(CUSTOM_MODES_STORAGE_KEY, customModes);
  }, [customModes]);

  useEffect(() => {
    saveToStorage(FOCUS_SESSIONS_STORAGE_KEY, focusSessions);
  }, [focusSessions]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(intervalId);
          playCompletionBell();
          setIsRunning(false);

          if (activeMode.category === 'focus') {
            const completedSession: FocusSession = {
              id: createStorageId('focus'),
              modeId: activeMode.id,
              modeLabel: activeMode.label,
              duration: activeMode.duration,
              completedAt: new Date().toISOString(),
            };

            setFocusSessions((currentSessions) =>
              [completedSession, ...currentSessions].slice(0, MAX_STORED_FOCUS_SESSIONS),
            );
          }

          return 0;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeMode, isRunning, playCompletionBell]);

  useEffect(() => {
    document.title = `${timerLabel} - ${activeMode.label}`;

    return () => {
      document.title = 'Chronos Pomodoro';
    };
  }, [activeMode.label, timerLabel]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
    };
  }, []);

  function handleModeChange(modeId: string) {
    const nextMode = getModeById(modeId, timerModes);

    setActiveModeId(modeId);
    setRemainingSeconds(nextMode.duration);
    setIsRunning(false);
  }

  function handleTimerToggle() {
    if (isTimerFinished) {
      prepareBellSound();
      setRemainingSeconds(activeMode.duration);
      setIsRunning(true);
      return;
    }

    if (!isRunning) {
      prepareBellSound();
    }

    setIsRunning((currentState) => !currentState);
  }

  function handleTimerReset() {
    setRemainingSeconds(activeMode.duration);
    setIsRunning(false);
  }

  function handleCustomModeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = customModeName.trim();
    const minutes = Number(customModeMinutes);
    const description = customModeDescription.trim();

    if (!label) {
      setCustomModeError('Informe um nome para o modo.');
      return;
    }

    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_CUSTOM_MODE_MINUTES) {
      setCustomModeError(`Use uma duracao entre 1 e ${MAX_CUSTOM_MODE_MINUTES} minutos.`);
      return;
    }

    const newMode: TimerMode = {
      id: createStorageId('custom'),
      label,
      duration: minutes * MINUTE_IN_SECONDS,
      description: description || 'Concentracao personalizada',
      category: 'focus',
      isCustom: true,
    };

    setCustomModes((currentModes) => [...currentModes, newMode]);
    setActiveModeId(newMode.id);
    setRemainingSeconds(newMode.duration);
    setIsRunning(false);
    setCustomModeName('');
    setCustomModeMinutes('30');
    setCustomModeDescription('');
    setCustomModeError('');
  }

  function handleRemoveCustomMode(modeId: string) {
    setCustomModes((currentModes) => currentModes.filter((mode) => mode.id !== modeId));

    if (activeModeId === modeId) {
      const fallbackMode = DEFAULT_TIMER_MODES[0];

      setActiveModeId(fallbackMode.id);
      setRemainingSeconds(fallbackMode.duration);
      setIsRunning(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <section className={styles.hero} aria-labelledby="app-title">
        <Heading
          subtitle="Uma experiencia minimalista para proteger blocos de foco, pausas e ritmo de trabalho."
          title="Chronos Pomodoro"
        />
      </section>

      <section className={styles.timerCard} aria-label="Timer Pomodoro">
        <div className={styles.modeSwitcher} aria-label="Selecionar modo">
          {timerModes.map((mode) => {
            const isActive = mode.id === activeModeId;

            return (
              <div className={styles.modeItem} key={mode.id}>
                <button
                  aria-pressed={isActive}
                  className={`${styles.modeButton} ${isActive ? styles.modeButtonActive : ''}`}
                  onClick={() => handleModeChange(mode.id)}
                  type="button"
                >
                  <span>{mode.label}</span>
                  <small>{mode.description}</small>
                </button>

                {mode.isCustom ? (
                  <button
                    aria-label={`Remover modo ${mode.label}`}
                    className={styles.removeModeButton}
                    onClick={() => handleRemoveCustomMode(mode.id)}
                    type="button"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className={styles.timerDisplay}>
          <span className={styles.statusBadge}>{statusText}</span>
          <strong aria-live="polite" className={styles.timerValue}>
            {timerLabel}
          </strong>
          <p>{activeMode.description}</p>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${progressPercentage}%` }} />
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            onClick={handleTimerToggle}
            type="button"
          >
            {primaryActionLabel}
          </button>

          <button
            className={styles.secondaryButton}
            disabled={remainingSeconds === activeMode.duration && !isRunning}
            onClick={handleTimerReset}
            type="button"
          >
            Resetar
          </button>
        </div>

        <dl className={styles.sessionStats}>
          <div>
            <dt>Modo atual</dt>
            <dd>{activeMode.label}</dd>
          </div>
          <div>
            <dt>Focos hoje</dt>
            <dd>{todaysFocuses}</dd>
          </div>
          <div>
            <dt>Total salvo</dt>
            <dd>{completedFocuses}</dd>
          </div>
          <div>
            <dt>Minutos focados</dt>
            <dd>{focusedMinutes}</dd>
          </div>
        </dl>

        <div className={styles.managementGrid}>
          <section className={styles.panelSection} aria-labelledby="custom-mode-title">
            <div className={styles.panelHeader}>
              <span>Modos</span>
              <h2 id="custom-mode-title">Novo modo de concentracao</h2>
            </div>

            <form className={styles.customModeForm} onSubmit={handleCustomModeSubmit}>
              <label>
                Nome
                <input
                  maxLength={28}
                  onChange={(event) => setCustomModeName(event.target.value)}
                  placeholder="Leitura profunda"
                  value={customModeName}
                />
              </label>

              <label>
                Minutos
                <input
                  inputMode="numeric"
                  max={MAX_CUSTOM_MODE_MINUTES}
                  min="1"
                  onChange={(event) => setCustomModeMinutes(event.target.value)}
                  type="number"
                  value={customModeMinutes}
                />
              </label>

              <label className={styles.fullField}>
                Descricao
                <input
                  maxLength={42}
                  onChange={(event) => setCustomModeDescription(event.target.value)}
                  placeholder="Bloco de foco personalizado"
                  value={customModeDescription}
                />
              </label>

              {customModeError ? (
                <p className={styles.formError} role="alert">
                  {customModeError}
                </p>
              ) : null}

              <button className={styles.addModeButton} type="submit">
                Adicionar modo
              </button>
            </form>
          </section>

          <section className={styles.panelSection} aria-labelledby="focus-history-title">
            <div className={styles.panelHeader}>
              <span>Historico</span>
              <h2 id="focus-history-title">Focos concluidos</h2>
            </div>

            {latestFocusSessions.length > 0 ? (
              <ol className={styles.focusHistory}>
                {latestFocusSessions.map((session) => (
                  <li key={session.id}>
                    <strong>{session.modeLabel}</strong>
                    <span>
                      {formatSessionDate(session.completedAt)} -{' '}
                      {Math.round(session.duration / MINUTE_IN_SECONDS)} min
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyHistory}>
                Seus focos concluidos aparecem aqui quando o timer chega a zero.
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
