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
type TimerModeEffect = 'code' | 'study' | 'reading' | 'rest';
type CompletionSoundStyle = 'bell' | 'pulse' | 'soft';
type OverlayView = 'sound' | 'task' | 'metrics' | null;

type TimerMode = {
  id: string;
  label: string;
  duration: number;
  description: string;
  category: TimerModeCategory;
  effect?: TimerModeEffect;
  isCustom?: boolean;
};

type FocusSession = {
  id: string;
  modeId: string;
  modeLabel: string;
  duration: number;
  completedAt: string;
};

type TaskStatus = 'idle' | 'running' | 'paused' | 'finished';

type FocusTask = {
  id: string;
  title: string;
  duration: number;
  remainingSeconds: number;
  createdAt: string;
  status: TaskStatus;
};

type DocumentPictureInPictureController = {
  requestWindow: (options?: {
    disallowReturnToOpener?: boolean;
    height?: number;
    preferInitialWindowPlacement?: boolean;
    width?: number;
  }) => Promise<Window>;
  window?: Window | null;
};

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureController;
};

const MINUTE_IN_SECONDS = 60;
const CUSTOM_MODES_STORAGE_KEY = 'focuss-pomodoro:custom-modes';
const FOCUS_SESSIONS_STORAGE_KEY = 'focuss-pomodoro:focus-sessions';
const FOCUS_TASKS_STORAGE_KEY = 'focuss-pomodoro:tasks';
const COMPLETION_SOUND_STORAGE_KEY = 'focuss-pomodoro:completion-sound';
const PICTURE_IN_PICTURE_PERMISSION_STORAGE_KEY =
  'focuss-pomodoro:picture-in-picture-permission';
const MAX_CUSTOM_MODE_MINUTES = 180;
const MAX_TASK_MINUTES = 240;
const MAX_STORED_FOCUS_SESSIONS = 200;
const PICTURE_IN_PICTURE_WIDTH = 142;
const PICTURE_IN_PICTURE_HEIGHT = 48;
const PICTURE_IN_PICTURE_SCALE = 3;
const PICTURE_IN_PICTURE_CANVAS_WIDTH =
  PICTURE_IN_PICTURE_WIDTH * PICTURE_IN_PICTURE_SCALE;
const PICTURE_IN_PICTURE_CANVAS_HEIGHT =
  PICTURE_IN_PICTURE_HEIGHT * PICTURE_IN_PICTURE_SCALE;
const DAILY_FOCUS_GOAL = 4;
const MODE_RITUALS: Record<TimerModeEffect, string> = {
  code: 'Feche abas, abra o editor e defina uma entrega pequena.',
  reading: 'Deixe uma anotação pronta e marque uma ideia por bloco.',
  rest: 'Afaste a tela, respire fundo e solte ombros e mandíbula.',
  study: 'Revise o objetivo, leia ativo e teste sem olhar resposta.',
};
const COMPLETION_SOUND_OPTIONS: Array<{
  id: CompletionSoundStyle;
  label: string;
  description: string;
}> = [
  {
    id: 'bell',
    label: 'Sino claro',
    description: 'Final marcado e brilhante.',
  },
  {
    id: 'pulse',
    label: 'Pulso curto',
    description: 'Aviso seco para ambiente silencioso.',
  },
  {
    id: 'soft',
    label: 'Toque leve',
    description: 'Som discreto e mais suave.',
  },
];

const DEFAULT_TIMER_MODES: TimerMode[] = [
  {
    id: 'code',
    label: 'Code',
    duration: 45 * MINUTE_IN_SECONDS,
    description: 'Fluxo de código',
    category: 'focus',
    effect: 'code',
  },
  {
    id: 'study',
    label: 'Estudos',
    duration: 35 * MINUTE_IN_SECONDS,
    description: 'Revisão ativa',
    category: 'focus',
    effect: 'study',
  },
  {
    id: 'reading',
    label: 'Leitura',
    duration: 40 * MINUTE_IN_SECONDS,
    description: 'Leitura profunda',
    category: 'focus',
    effect: 'reading',
  },
  {
    id: 'rest',
    label: 'Descanso',
    duration: 15 * MINUTE_IN_SECONDS,
    description: 'Recuperar energia',
    category: 'break',
    effect: 'rest',
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
    return 'Data indisponível';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatClockTime(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
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
          description: description || 'Concentração personalizada',
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

function loadFocusTasks() {
  try {
    const storedTasks = window.localStorage.getItem(FOCUS_TASKS_STORAGE_KEY);

    if (!storedTasks) {
      return [];
    }

    const parsedTasks: unknown = JSON.parse(storedTasks);

    if (!Array.isArray(parsedTasks)) {
      return [];
    }

    return parsedTasks.flatMap((task): FocusTask[] => {
      if (!isRecord(task)) {
        return [];
      }

      const title = typeof task.title === 'string' ? task.title.trim() : '';
      const duration =
        typeof task.duration === 'number' && Number.isFinite(task.duration)
          ? task.duration
          : 0;
      const remainingSeconds =
        typeof task.remainingSeconds === 'number' &&
        Number.isFinite(task.remainingSeconds)
          ? task.remainingSeconds
          : duration;
      const createdAt = typeof task.createdAt === 'string' ? task.createdAt : '';
      const status =
        task.status === 'running' ||
        task.status === 'paused' ||
        task.status === 'finished'
          ? task.status
          : 'idle';

      if (!title || duration < MINUTE_IN_SECONDS || Number.isNaN(Date.parse(createdAt))) {
        return [];
      }

      return [
        {
          id: typeof task.id === 'string' ? task.id : createStorageId('task'),
          title,
          duration,
          remainingSeconds: Math.max(0, Math.min(remainingSeconds, duration)),
          createdAt,
          status,
        },
      ];
    });
  } catch {
    return [];
  }
}

function loadCompletionSoundStyle(): CompletionSoundStyle {
  try {
    const storedSoundStyle = window.localStorage.getItem(COMPLETION_SOUND_STORAGE_KEY);

    if (
      storedSoundStyle === 'bell' ||
      storedSoundStyle === 'pulse' ||
      storedSoundStyle === 'soft'
    ) {
      return storedSoundStyle;
    }
  } catch {
    return 'bell';
  }

  return 'bell';
}

function loadPictureInPicturePermission() {
  try {
    return (
      window.localStorage.getItem(PICTURE_IN_PICTURE_PERMISSION_STORAGE_KEY) ===
      'granted'
    );
  } catch {
    return false;
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

function playPulseSound(audioContext: AudioContext) {
  const now = audioContext.currentTime;
  const pulseTones = [
    { frequency: 520, gain: 0.18, start: 0 },
    { frequency: 520, gain: 0.13, start: 0.18 },
    { frequency: 660, gain: 0.1, start: 0.36 },
  ];

  pulseTones.forEach(({ frequency, gain, start }) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const toneStart = now + start;
    const toneEnd = toneStart + 0.12;

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, toneStart);
    gainNode.gain.setValueAtTime(0.0001, toneStart);
    gainNode.gain.exponentialRampToValueAtTime(gain, toneStart + 0.018);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, toneEnd);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneEnd);
  });
}

function playSoftSound(audioContext: AudioContext) {
  const now = audioContext.currentTime;
  const softTones = [
    { frequency: 392, gain: 0.1, duration: 1.2 },
    { frequency: 588, gain: 0.07, duration: 1.4 },
  ];

  softTones.forEach(({ duration, frequency, gain }) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  });
}

function playCompletionSound(
  audioContext: AudioContext,
  soundStyle: CompletionSoundStyle,
) {
  if (soundStyle === 'pulse') {
    playPulseSound(audioContext);
    return;
  }

  if (soundStyle === 'soft') {
    playSoftSound(audioContext);
    return;
  }

  playBellSound(audioContext);
}

function drawPictureInPictureTimer(
  canvas: HTMLCanvasElement,
  timerLabel: string,
) {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  const scale = PICTURE_IN_PICTURE_SCALE;
  const width = PICTURE_IN_PICTURE_WIDTH;
  const height = PICTURE_IN_PICTURE_HEIGHT;
  const iconCenterX = 22;
  const iconCenterY = height / 2;

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#070707';
  context.fillRect(0, 0, width, height);

  context.strokeStyle = '#b8e6ff';
  context.lineCap = 'round';
  context.lineWidth = 2.2;
  context.beginPath();
  context.arc(iconCenterX, iconCenterY, 10, 0, Math.PI * 2);
  context.stroke();

  context.beginPath();
  context.moveTo(iconCenterX, iconCenterY);
  context.lineTo(iconCenterX, iconCenterY - 5);
  context.moveTo(iconCenterX, iconCenterY);
  context.lineTo(iconCenterX + 5, iconCenterY + 3);
  context.stroke();

  context.fillStyle = '#f5f5f5';
  context.font = '850 27px Inter, system-ui, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(timerLabel, 42, iconCenterY + 1);
  context.setTransform(1, 0, 0, 1, 0, 0);
}

function getDocumentPictureInPicture() {
  return (window as WindowWithDocumentPictureInPicture).documentPictureInPicture;
}

function writeDocumentPictureInPictureShell(pipWindow: Window) {
  const pipDocument = pipWindow.document;

  pipDocument.title = 'Focuss Timer';
  pipDocument.head.innerHTML = `
    <style>
      html,
      body {
        background: #070707;
        color: #f5f5f5;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        height: 100%;
        margin: 0;
        overflow: hidden;
        width: 100%;
      }

      body {
        -webkit-font-smoothing: antialiased;
      }

      .pipShell {
        align-items: center;
        background: #070707;
        box-sizing: border-box;
        display: flex;
        gap: 7px;
        height: 100vh;
        padding: 6px 7px;
        width: 100vw;
      }

      .clockIcon {
        border: 2px solid #b8e6ff;
        border-radius: 50%;
        box-sizing: border-box;
        flex: 0 0 auto;
        height: 17px;
        opacity: 0.92;
        position: relative;
        width: 17px;
      }

      .clockIcon::before,
      .clockIcon::after {
        background: #b8e6ff;
        border-radius: 999px;
        content: "";
        left: 6.5px;
        position: absolute;
        top: 3px;
        transform-origin: bottom center;
        width: 2px;
      }

      .clockIcon::before {
        height: 6px;
      }

      .clockIcon::after {
        height: 5px;
        transform: rotate(120deg);
      }

      .timerValue {
        color: #f5f5f5;
        flex: 1 1 auto;
        font-size: 24px;
        font-variant-numeric: tabular-nums;
        font-weight: 850;
        letter-spacing: 0;
        line-height: 1;
        min-width: 0;
        text-align: center;
      }

      .controlButton {
        align-items: center;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        color: #f5f5f5;
        cursor: pointer;
        display: inline-flex;
        flex: 0 0 auto;
        height: 24px;
        justify-content: center;
        padding: 0;
        transition: background-color 140ms ease, border-color 140ms ease;
        width: 24px;
      }

      .controlButton:hover,
      .controlButton:focus-visible {
        background: rgba(184, 230, 255, 0.18);
        border-color: rgba(184, 230, 255, 0.58);
        outline: none;
      }

      .controlIcon {
        color: currentColor;
        display: inline-flex;
      }

      .pauseIcon {
        gap: 3px;
      }

      .pauseIcon::before,
      .pauseIcon::after {
        background: currentColor;
        border-radius: 999px;
        content: "";
        height: 10px;
        width: 3px;
      }

      .playIcon {
        border-bottom: 6px solid transparent;
        border-left: 8px solid currentColor;
        border-top: 6px solid transparent;
        height: 0;
        margin-left: 2px;
        width: 0;
      }
    </style>
  `;
  pipDocument.body.innerHTML = `
    <main class="pipShell" aria-label="Timer Picture-in-Picture">
      <span class="clockIcon" aria-hidden="true"></span>
      <strong class="timerValue" id="pip-timer">00:00</strong>
      <button class="controlButton" id="pip-toggle" type="button">
        <span class="controlIcon playIcon" id="pip-toggle-icon" aria-hidden="true"></span>
      </button>
    </main>
  `;
}

function updateDocumentPictureInPictureTimer(
  pipWindow: Window | null,
  timerLabel: string,
  isRunning: boolean,
  isTimerFinished: boolean,
) {
  if (!pipWindow || pipWindow.closed) {
    return;
  }

  const pipDocument = pipWindow.document;
  const timerElement = pipDocument.getElementById('pip-timer');
  const toggleButton = pipDocument.getElementById('pip-toggle') as HTMLButtonElement | null;
  const toggleIcon = pipDocument.getElementById('pip-toggle-icon');
  const toggleLabel = isRunning
    ? 'Pausar timer'
    : isTimerFinished
      ? 'Reiniciar timer'
      : 'Retomar timer';

  if (timerElement) {
    timerElement.textContent = timerLabel;
  }

  if (toggleButton) {
    toggleButton.setAttribute('aria-label', toggleLabel);
    toggleButton.title = toggleLabel;
  }

  if (toggleIcon) {
    toggleIcon.className = isRunning
      ? 'controlIcon pauseIcon'
      : 'controlIcon playIcon';
  }
}

export function App() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const documentPictureInPictureWindowRef = useRef<Window | null>(null);
  const pictureInPictureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pictureInPictureVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerControlRef = useRef({
    toggle: () => {},
  });
  const timerStateRef = useRef({
    isRunning: false,
  });
  const [customModes, setCustomModes] = useState<TimerMode[]>(loadCustomModes);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>(loadFocusSessions);
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>(loadFocusTasks);
  const [completionSoundStyle, setCompletionSoundStyle] =
    useState<CompletionSoundStyle>(loadCompletionSoundStyle);
  const [activeOverlay, setActiveOverlay] = useState<OverlayView>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [activeModeId, setActiveModeId] = useState(DEFAULT_TIMER_MODES[0].id);
  const [remainingSeconds, setRemainingSeconds] = useState(
    DEFAULT_TIMER_MODES[0].duration,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [customModeName, setCustomModeName] = useState('');
  const [customModeMinutes, setCustomModeMinutes] = useState('30');
  const [customModeDescription, setCustomModeDescription] = useState('');
  const [customModeError, setCustomModeError] = useState('');
  const [taskName, setTaskName] = useState('');
  const [taskMinutes, setTaskMinutes] = useState('25');
  const [taskError, setTaskError] = useState('');
  const [hasPictureInPicturePermission, setHasPictureInPicturePermission] = useState(
    loadPictureInPicturePermission,
  );
  const [isPictureInPictureActive, setIsPictureInPictureActive] = useState(false);
  const [pictureInPictureError, setPictureInPictureError] = useState('');

  const timerModes = useMemo(
    () => [...DEFAULT_TIMER_MODES, ...customModes],
    [customModes],
  );
  const activeMode = getModeById(activeModeId, timerModes);
  const presetEffectClassNames: Record<TimerModeEffect, string> = {
    code: styles.pageShellCode,
    reading: styles.pageShellReading,
    rest: styles.pageShellRest,
    study: styles.pageShellStudy,
  };
  const presetWidgetClassNames: Record<TimerModeEffect, string> = {
    code: styles.presetWidgetCode,
    reading: styles.presetWidgetReading,
    rest: styles.presetWidgetRest,
    study: styles.presetWidgetStudy,
  };
  const activeEffectClassName = activeMode.effect
    ? presetEffectClassNames[activeMode.effect]
    : '';
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
  const todaysFocusMinutes = useMemo(
    () =>
      focusSessions
        .filter((session) => isSameLocalDay(session.completedAt))
        .reduce(
          (total, session) => total + Math.round(session.duration / MINUTE_IN_SECONDS),
          0,
        ),
    [focusSessions],
  );
  const todaysTaskCount = useMemo(
    () => focusTasks.filter((task) => isSameLocalDay(task.createdAt)).length,
    [focusTasks],
  );
  const completedTasks = useMemo(
    () => focusTasks.filter((task) => task.status === 'finished').length,
    [focusTasks],
  );
  const activeTasks = useMemo(
    () => focusTasks.filter((task) => task.status !== 'finished'),
    [focusTasks],
  );
  const totalTaskMinutes = useMemo(
    () =>
      focusTasks.reduce(
        (total, task) => total + Math.round(task.duration / MINUTE_IN_SECONDS),
        0,
      ),
    [focusTasks],
  );
  const averageFocusMinutes =
    completedFocuses > 0 ? Math.round(focusedMinutes / completedFocuses) : 0;
  const taskCompletionRate =
    focusTasks.length > 0 ? Math.round((completedTasks / focusTasks.length) * 100) : 0;
  const weeklyFocusRows = useMemo(() => {
    const today = new Date();
    const rows = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);

      date.setDate(today.getDate() - (6 - index));

      return {
        key: getLocalDateKey(date),
        label: formatShortDate(date),
        minutes: 0,
      };
    });
    const rowByKey = new Map(rows.map((row) => [row.key, row]));

    focusSessions.forEach((session) => {
      const completedAt = new Date(session.completedAt);
      const row = rowByKey.get(getLocalDateKey(completedAt));

      if (row) {
        row.minutes += Math.round(session.duration / MINUTE_IN_SECONDS);
      }
    });

    return rows;
  }, [focusSessions]);
  const maxWeeklyFocusMinutes = Math.max(
    1,
    ...weeklyFocusRows.map((row) => row.minutes),
  );
  const modeBiRows = useMemo(() => {
    const rowsByMode = new Map<
      string,
      {
        count: number;
        label: string;
        minutes: number;
      }
    >();

    focusSessions.forEach((session) => {
      const currentRow = rowsByMode.get(session.modeLabel) ?? {
        count: 0,
        label: session.modeLabel,
        minutes: 0,
      };

      currentRow.count += 1;
      currentRow.minutes += Math.round(session.duration / MINUTE_IN_SECONDS);
      rowsByMode.set(session.modeLabel, currentRow);
    });

    return [...rowsByMode.values()]
      .sort((firstRow, secondRow) => secondRow.minutes - firstRow.minutes)
      .slice(0, 4)
      .map((row) => ({
        ...row,
        percentage:
          focusedMinutes > 0 ? Math.round((row.minutes / focusedMinutes) * 100) : 0,
      }));
  }, [focusSessions, focusedMinutes]);
  const latestFocusSessions = focusSessions.slice(0, 3);
  const expandedTask = focusTasks.find((task) => task.id === expandedTaskId) ?? null;
  const progressPercentage =
    ((activeMode.duration - remainingSeconds) / activeMode.duration) * 100;
  const isTimerFinished = remainingSeconds === 0;
  const timerLabel = formatTime(remainingSeconds);
  const dailyGoalProgress = Math.min(100, (todaysFocuses / DAILY_FOCUS_GOAL) * 100);
  const activeModeRitual = activeMode.effect
    ? MODE_RITUALS[activeMode.effect]
    : 'Escolha uma tarefa pequena e tire notificações do caminho.';
  const estimatedFinishTime = formatClockTime(
    new Date(Date.now() + remainingSeconds * 1000),
  );
  timerStateRef.current = { isRunning };

  const primaryActionLabel = isRunning
    ? 'Pausar'
    : remainingSeconds === activeMode.duration
      ? 'Iniciar'
      : 'Continuar';
  const statusText = isTimerFinished
    ? 'Sessão finalizada'
    : isRunning
      ? 'Sessão em andamento'
      : 'Pronto para focar';
  const isDocumentPictureInPictureSupported =
    typeof getDocumentPictureInPicture()?.requestWindow === 'function';
  const isVideoPictureInPictureSupported =
    document.pictureInPictureEnabled &&
    'requestPictureInPicture' in HTMLVideoElement.prototype &&
    'captureStream' in HTMLCanvasElement.prototype;
  const isPictureInPictureSupported =
    isDocumentPictureInPictureSupported || isVideoPictureInPictureSupported;
  const pictureInPictureButtonLabel = !hasPictureInPicturePermission
    ? 'Permitir Picture-in-Picture'
    : isPictureInPictureActive
      ? 'Fechar Picture-in-Picture'
      : 'Abrir Picture-in-Picture';

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
      void audioContext
        .resume()
        .then(() => playCompletionSound(audioContext, completionSoundStyle));
      return;
    }

    playCompletionSound(audioContext, completionSoundStyle);
  }, [completionSoundStyle, getAudioContext]);

  const closeDocumentPictureInPicture = useCallback(() => {
    const pipWindow = documentPictureInPictureWindowRef.current;

    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }

    documentPictureInPictureWindowRef.current = null;
    setIsPictureInPictureActive(false);
  }, []);

  const requestDocumentPictureInPicture = useCallback(async () => {
    const documentPictureInPicture = getDocumentPictureInPicture();
    const currentWindow = documentPictureInPictureWindowRef.current;

    if (!isDocumentPictureInPictureSupported || !documentPictureInPicture) {
      return false;
    }

    if (currentWindow && !currentWindow.closed) {
      currentWindow.focus();
      return true;
    }

    try {
      const pipWindow = await documentPictureInPicture.requestWindow({
        height: PICTURE_IN_PICTURE_HEIGHT,
        width: PICTURE_IN_PICTURE_WIDTH,
      });
      const toggleTimer = () => timerControlRef.current.toggle();

      documentPictureInPictureWindowRef.current = pipWindow;
      writeDocumentPictureInPictureShell(pipWindow);
      updateDocumentPictureInPictureTimer(
        pipWindow,
        timerLabel,
        isRunning,
        isTimerFinished,
      );

      pipWindow.document
        .getElementById('pip-toggle')
        ?.addEventListener('click', toggleTimer);
      pipWindow.addEventListener(
        'pagehide',
        () => {
          documentPictureInPictureWindowRef.current = null;
          setIsPictureInPictureActive(false);
        },
        { once: true },
      );

      setIsPictureInPictureActive(true);
      setPictureInPictureError('');

      return true;
    } catch {
      return false;
    }
  }, [isDocumentPictureInPictureSupported, isRunning, isTimerFinished, timerLabel]);

  const requestPictureInPicture = useCallback(
    async (showError = false) => {
      const canvas = pictureInPictureCanvasRef.current;
      const video = pictureInPictureVideoRef.current;

      if (await requestDocumentPictureInPicture()) {
        return true;
      }

      if (!canvas || !video || !isVideoPictureInPictureSupported) {
        if (showError) {
          setPictureInPictureError('Picture-in-Picture não está disponível neste navegador.');
        }

        return false;
      }

      try {
        drawPictureInPictureTimer(canvas, timerLabel);

        if (!video.srcObject) {
          video.srcObject = canvas.captureStream(1);
        }

        await video.play();
        await video.requestPictureInPicture();

        if (!timerStateRef.current.isRunning) {
          video.pause();
        }

        setPictureInPictureError('');

        return true;
      } catch {
        if (showError) {
          setPictureInPictureError('Não foi possível abrir o Picture-in-Picture.');
        }

        return false;
      }
    },
    [isVideoPictureInPictureSupported, requestDocumentPictureInPicture, timerLabel],
  );

  useEffect(() => {
    saveToStorage(CUSTOM_MODES_STORAGE_KEY, customModes);
  }, [customModes]);

  useEffect(() => {
    saveToStorage(FOCUS_SESSIONS_STORAGE_KEY, focusSessions);
  }, [focusSessions]);

  useEffect(() => {
    saveToStorage(FOCUS_TASKS_STORAGE_KEY, focusTasks);
  }, [focusTasks]);

  useEffect(() => {
    if (!activeOverlay) {
      return;
    }

    function handleOverlayKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveOverlay(null);
      }
    }

    window.addEventListener('keydown', handleOverlayKeyDown);

    return () => {
      window.removeEventListener('keydown', handleOverlayKeyDown);
    };
  }, [activeOverlay]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COMPLETION_SOUND_STORAGE_KEY, completionSoundStyle);
    } catch {
      // Sound preference is optional when localStorage is unavailable.
    }
  }, [completionSoundStyle]);

  useEffect(() => {
    if (hasPictureInPicturePermission) {
      try {
        window.localStorage.setItem(
          PICTURE_IN_PICTURE_PERMISSION_STORAGE_KEY,
          'granted',
        );
      } catch {
        // Permission can still work for the current session without localStorage.
      }
    }
  }, [hasPictureInPicturePermission]);

  useEffect(() => {
    const runningTask = focusTasks.find((task) => task.status === 'running');

    if (!runningTask) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setFocusTasks((currentTasks) =>
        currentTasks.map((task) => {
          if (task.id !== runningTask.id || task.status !== 'running') {
            return task;
          }

          const nextRemainingSeconds = Math.max(0, task.remainingSeconds - 1);

          if (nextRemainingSeconds === 0) {
            playCompletionBell();
            return {
              ...task,
              remainingSeconds: 0,
              status: 'finished',
            };
          }

          return {
            ...task,
            remainingSeconds: nextRemainingSeconds,
          };
        }),
      );
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [focusTasks, playCompletionBell]);

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
      document.title = 'Focuss Pomodoro';
    };
  }, [activeMode.label, timerLabel]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const canvas = pictureInPictureCanvasRef.current;

    if (!canvas) {
      return;
    }

    drawPictureInPictureTimer(canvas, timerLabel);
    updateDocumentPictureInPictureTimer(
      documentPictureInPictureWindowRef.current,
      timerLabel,
      isRunning,
      isTimerFinished,
    );
  }, [isRunning, isTimerFinished, timerLabel]);

  useEffect(() => {
    const video = pictureInPictureVideoRef.current;

    if (!video) {
      return;
    }

    function handleEnterPictureInPicture() {
      setIsPictureInPictureActive(true);
      setPictureInPictureError('');
    }

    function handleLeavePictureInPicture() {
      setIsPictureInPictureActive(false);
    }

    function handleVideoPause() {
      if (document.pictureInPictureElement !== video || !timerStateRef.current.isRunning) {
        return;
      }

      timerControlRef.current.toggle();
    }

    function handleVideoPlay() {
      if (document.pictureInPictureElement !== video || timerStateRef.current.isRunning) {
        return;
      }

      timerControlRef.current.toggle();
    }

    video.addEventListener('enterpictureinpicture', handleEnterPictureInPicture);
    video.addEventListener('leavepictureinpicture', handleLeavePictureInPicture);
    video.addEventListener('pause', handleVideoPause);
    video.addEventListener('play', handleVideoPlay);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPictureInPicture);
      video.removeEventListener('leavepictureinpicture', handleLeavePictureInPicture);
      video.removeEventListener('pause', handleVideoPause);
      video.removeEventListener('play', handleVideoPlay);
    };
  }, []);

  useEffect(() => {
    const video = pictureInPictureVideoRef.current;

    if (!video || document.pictureInPictureElement !== video) {
      return;
    }

    if (isRunning) {
      void video.play();
      return;
    }

    video.pause();
  }, [isRunning]);

  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (
          isRunning &&
          hasPictureInPicturePermission &&
          !document.pictureInPictureElement
        ) {
          await requestPictureInPicture();
        }

        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }

      closeDocumentPictureInPicture();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    closeDocumentPictureInPicture,
    hasPictureInPicturePermission,
    isRunning,
    requestPictureInPicture,
  ]);

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

  async function handlePictureInPicturePermission() {
    if (!isPictureInPictureSupported) {
      setPictureInPictureError('Picture-in-Picture não está disponível neste navegador.');
      return;
    }

    const wasOpened = await requestPictureInPicture(true);

    if (wasOpened) {
      setHasPictureInPicturePermission(true);
    }
  }

  async function handlePictureInPictureToggle() {
    try {
      if (!hasPictureInPicturePermission) {
        await handlePictureInPicturePermission();
        return;
      }

      const documentPipWindow = documentPictureInPictureWindowRef.current;

      if (documentPipWindow && !documentPipWindow.closed) {
        closeDocumentPictureInPicture();
        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      await requestPictureInPicture(true);
    } catch {
      setPictureInPictureError('Não foi possível abrir o Picture-in-Picture.');
    }
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
      setCustomModeError(`Use uma duração entre 1 e ${MAX_CUSTOM_MODE_MINUTES} minutos.`);
      return;
    }

    const newMode: TimerMode = {
      id: createStorageId('custom'),
      label,
      duration: minutes * MINUTE_IN_SECONDS,
      description: description || 'Concentração personalizada',
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

  function handleSoundStyleChange(soundStyle: CompletionSoundStyle) {
    setCompletionSoundStyle(soundStyle);
    const audioContext = getAudioContext();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext
        .resume()
        .then(() => playCompletionSound(audioContext, soundStyle));
      return;
    }

    playCompletionSound(audioContext, soundStyle);
  }

  function handleTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = taskName.trim();
    const minutes = Number(taskMinutes);

    if (!title) {
      setTaskError('Informe o nome da task.');
      return;
    }

    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_TASK_MINUTES) {
      setTaskError(`Use uma duracao entre 1 e ${MAX_TASK_MINUTES} minutos.`);
      return;
    }

    const newTask: FocusTask = {
      id: createStorageId('task'),
      title,
      duration: minutes * MINUTE_IN_SECONDS,
      remainingSeconds: minutes * MINUTE_IN_SECONDS,
      createdAt: new Date().toISOString(),
      status: 'idle',
    };

    setFocusTasks((currentTasks) => [newTask, ...currentTasks]);
    setExpandedTaskId(newTask.id);
    setTaskName('');
    setTaskMinutes('25');
    setTaskError('');
    setActiveOverlay(null);
  }

  function handleTaskToggle(taskId: string) {
    prepareBellSound();
    setFocusTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id !== taskId) {
          return task.status === 'running' ? { ...task, status: 'paused' } : task;
        }

        if (task.status === 'finished') {
          return {
            ...task,
            remainingSeconds: task.duration,
            status: 'running',
          };
        }

        return {
          ...task,
          status: task.status === 'running' ? 'paused' : 'running',
        };
      }),
    );
  }

  function handleTaskFinish(taskId: string) {
    setFocusTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              remainingSeconds: 0,
              status: 'finished',
            }
          : task,
      ),
    );
    setExpandedTaskId((currentTaskId) => (currentTaskId === taskId ? null : currentTaskId));
  }

  function handleTaskReset(taskId: string) {
    setFocusTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              remainingSeconds: task.duration,
              status: 'idle',
            }
          : task,
      ),
    );
  }

  timerControlRef.current.toggle = handleTimerToggle;

  return (
    <main className={`${styles.pageShell} ${activeEffectClassName}`}>
      <nav className={styles.appNav} aria-label="Acoes do Focuss">
        <div className={styles.navInner}>
          <strong>Focuss</strong>
          <div className={styles.navLinkGroup}>
            <button
              aria-haspopup="dialog"
              aria-expanded={activeOverlay === 'sound'}
              className={`${styles.navAction} ${
                activeOverlay === 'sound' ? styles.navActionActive : ''
              }`}
              onClick={() => setActiveOverlay('sound')}
              type="button"
            >
              Sino
            </button>
            <button
              aria-haspopup="dialog"
              aria-expanded={activeOverlay === 'task'}
              className={`${styles.navAction} ${
                activeOverlay === 'task' ? styles.navActionActive : ''
              }`}
              onClick={() => setActiveOverlay('task')}
              type="button"
            >
              Nova task
            </button>
          </div>
          <button
            aria-haspopup="dialog"
            aria-expanded={activeOverlay === 'metrics'}
            className={`${styles.navCta} ${
              activeOverlay === 'metrics' ? styles.navActionActive : ''
            }`}
            onClick={() => setActiveOverlay('metrics')}
            type="button"
          >
            Metricas
          </button>
        </div>
      </nav>

      <div className={styles.contentStack}>
        <section className={styles.hero} aria-labelledby="app-title">
          <Heading
            subtitle="Foco, pausas e ritmo em uma interface limpa."
            title="Focuss Pomodoro"
          />
        </section>

        <section className={styles.presetWidgets} aria-label="Presets base">
          {DEFAULT_TIMER_MODES.map((mode) => {
            const isActive = mode.id === activeModeId;
            const effectClassName = mode.effect
              ? presetWidgetClassNames[mode.effect]
              : '';

            return (
              <button
                aria-pressed={isActive}
                className={`${styles.presetWidget} ${effectClassName} ${
                  isActive ? styles.presetWidgetActive : ''
                }`}
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                type="button"
              >
                <span className={styles.presetWidgetIcon} aria-hidden="true" />
                <span className={styles.presetWidgetText}>
                  <strong>{mode.label}</strong>
                  <small>{Math.round(mode.duration / MINUTE_IN_SECONDS)} min</small>
                </span>
              </button>
            );
          })}
        </section>

        <section className={styles.timerCard} aria-label="Timer Pomodoro">
          <button
            aria-label={pictureInPictureButtonLabel}
            className={styles.pictureInPictureButton}
            disabled={!isPictureInPictureSupported}
            onClick={handlePictureInPictureToggle}
            title={pictureInPictureButtonLabel}
          type="button"
        >
            PiP
          </button>

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
                  <small>{Math.round(mode.duration / MINUTE_IN_SECONDS)} min</small>
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

        {pictureInPictureError ? (
          <p className={styles.pictureInPictureError} role="alert">
            {pictureInPictureError}
          </p>
        ) : null}

        <section className={styles.infoBubble} aria-labelledby="focus-info-title">
          <div className={styles.bubbleHeader}>
            <span>Progresso</span>
            <h2 id="focus-info-title">Meta e sessão</h2>
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

          <div className={styles.focusIdeas} aria-label="Ideias para a sessão">
            <article className={styles.focusIdeaCard}>
              <span>Meta de hoje</span>
              <strong>
                {todaysFocuses}/{DAILY_FOCUS_GOAL} focos
              </strong>
              <div className={styles.focusIdeaProgress} aria-hidden="true">
                <span style={{ width: `${dailyGoalProgress}%` }} />
              </div>
            </article>

            <article className={styles.focusIdeaCard}>
              <span>Ritual rápido</span>
              <p>{activeModeRitual}</p>
            </article>

            <article className={styles.focusIdeaCard}>
              <span>Termina às</span>
              <strong>{estimatedFinishTime}</strong>
              <small>{isRunning ? 'em andamento' : 'se iniciar agora'}</small>
            </article>
          </div>
        </section>

        <section className={styles.modesBubble} aria-label="Modos e histórico">
          <div className={styles.managementGrid}>
          <section className={styles.panelSection} aria-labelledby="custom-mode-title">
            <div className={styles.panelHeader}>
              <span>Modos</span>
              <h2 id="custom-mode-title">Novo modo de concentração</h2>
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
                Descrição
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
              <span>Histórico</span>
              <h2 id="focus-history-title">Focos concluídos</h2>
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
                Seus focos concluídos aparecem aqui quando o timer chega a zero.
              </p>
            )}
          </section>
          </div>
        </section>
        </section>
      </div>

      {activeTasks.length > 0 ? (
        <aside className={styles.taskDock} aria-label="Tasks minimizadas">
          {activeTasks.map((task) => (
            <button
              className={`${styles.taskDockItem} ${
                expandedTaskId === task.id ? styles.taskDockItemActive : ''
              }`}
              key={task.id}
              onClick={() =>
                setExpandedTaskId((currentTaskId) =>
                  currentTaskId === task.id ? null : task.id,
                )
              }
              type="button"
            >
              <span>{task.title}</span>
              <strong>{formatTime(task.remainingSeconds)}</strong>
            </button>
          ))}
        </aside>
      ) : null}

      {expandedTask ? (
        <aside className={styles.taskDetail} aria-label="Task selecionada">
          <div className={styles.taskDetailHeader}>
            <span>Task do dia</span>
            <button
              aria-label="Minimizar task"
              onClick={() => setExpandedTaskId(null)}
              type="button"
            >
              Fechar
            </button>
          </div>
          <h2>{expandedTask.title}</h2>
          <dl className={styles.taskDetailStats}>
            <div>
              <dt>Criada</dt>
              <dd>{formatSessionDate(expandedTask.createdAt)}</dd>
            </div>
            <div>
              <dt>Tempo escolhido</dt>
              <dd>{Math.round(expandedTask.duration / MINUTE_IN_SECONDS)} min</dd>
            </div>
            <div>
              <dt>Restante</dt>
              <dd>{formatTime(expandedTask.remainingSeconds)}</dd>
            </div>
          </dl>
          <div className={styles.taskDetailActions}>
            <button
              onClick={() => handleTaskToggle(expandedTask.id)}
              type="button"
            >
              {expandedTask.status === 'running' ? 'Pausar' : 'Iniciar'}
            </button>
            <button
              disabled={expandedTask.status === 'finished'}
              onClick={() => handleTaskFinish(expandedTask.id)}
              type="button"
            >
              Terminar
            </button>
            <button onClick={() => handleTaskReset(expandedTask.id)} type="button">
              Resetar
            </button>
          </div>
        </aside>
      ) : null}

      {activeOverlay ? (
        <div
          className={styles.overlayBackdrop}
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setActiveOverlay(null);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby={`${activeOverlay}-overlay-title`}
            aria-modal="true"
            className={`${styles.overlayPanel} ${
              activeOverlay === 'metrics' ? styles.metricsOverlayPanel : ''
            }`}
            role="dialog"
          >
            <div className={styles.overlayHeader}>
              <span>Focuss Control</span>
              <button
                aria-label="Fechar overlay"
                onClick={() => setActiveOverlay(null)}
                type="button"
              >
                Fechar
              </button>
            </div>

            {activeOverlay === 'sound' ? (
              <div className={styles.overlayContent}>
                <h2 id="sound-overlay-title">Toque final</h2>
                <div className={styles.soundOptions}>
                  {COMPLETION_SOUND_OPTIONS.map((option) => (
                    <button
                      aria-pressed={completionSoundStyle === option.id}
                      className={
                        completionSoundStyle === option.id
                          ? styles.soundOptionActive
                          : ''
                      }
                      key={option.id}
                      onClick={() => handleSoundStyleChange(option.id)}
                      type="button"
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeOverlay === 'task' ? (
              <div className={styles.overlayContent}>
                <h2 id="task-overlay-title">Criar task</h2>
                <form className={styles.taskForm} onSubmit={handleTaskSubmit}>
                  <label>
                    Nome
                    <input
                      maxLength={36}
                      onChange={(event) => setTaskName(event.target.value)}
                      placeholder="Revisar PR"
                      value={taskName}
                    />
                  </label>
                  <label>
                    Minutos
                    <input
                      inputMode="numeric"
                      max={MAX_TASK_MINUTES}
                      min="1"
                      onChange={(event) => setTaskMinutes(event.target.value)}
                      type="number"
                      value={taskMinutes}
                    />
                  </label>
                  {taskError ? (
                    <p className={styles.formError} role="alert">
                      {taskError}
                    </p>
                  ) : null}
                  <button type="submit">Criar task</button>
                </form>
              </div>
            ) : null}

            {activeOverlay === 'metrics' ? (
              <div className={`${styles.overlayContent} ${styles.metricsBi}`}>
                <div className={styles.biHeading}>
                  <div>
                    <span>BI basico</span>
                    <h2 id="metrics-overlay-title">Metricas ate agora</h2>
                  </div>
                  <strong>{todaysFocusMinutes} min hoje</strong>
                </div>

                <dl className={styles.metricsGrid}>
                  <div>
                    <dt>Total salvo</dt>
                    <dd>{completedFocuses}</dd>
                    <span>focos concluídos</span>
                  </div>
                  <div>
                    <dt>Média por foco</dt>
                    <dd>{averageFocusMinutes} min</dd>
                    <span>média histórica</span>
                  </div>
                  <div>
                    <dt>Minutos focados</dt>
                    <dd>{focusedMinutes}</dd>
                    <span>historico total</span>
                  </div>
                  <div>
                    <dt>Tasks hoje</dt>
                    <dd>{todaysTaskCount}</dd>
                    <span>{completedTasks} finalizadas</span>
                  </div>
                  <div>
                    <dt>Conclusao tasks</dt>
                    <dd>{taskCompletionRate}%</dd>
                    <span>{focusTasks.length} cadastradas</span>
                  </div>
                  <div>
                    <dt>Tempo em tasks</dt>
                    <dd>{totalTaskMinutes} min</dd>
                    <span>planejado</span>
                  </div>
                </dl>

                <section className={styles.biPanel} aria-labelledby="session-bi-title">
                  <div className={styles.biPanelHeader}>
                    <span>Sessão atual</span>
                    <strong id="session-bi-title">{activeMode.label}</strong>
                  </div>
                  <dl className={styles.biSessionGrid}>
                    <div>
                      <dt>Status</dt>
                      <dd>{statusText}</dd>
                    </div>
                    <div>
                      <dt>Termina às</dt>
                      <dd>{estimatedFinishTime}</dd>
                    </div>
                    <div>
                      <dt>Ritual rápido</dt>
                      <dd>{activeModeRitual}</dd>
                    </div>
                  </dl>
                </section>

                <section className={styles.biPanel} aria-labelledby="goal-bi-title">
                  <div className={styles.biPanelHeader}>
                    <span>Meta diaria</span>
                    <strong id="goal-bi-title">
                      {todaysFocuses}/{DAILY_FOCUS_GOAL} focos
                    </strong>
                  </div>
                  <div className={styles.biProgressTrack} aria-hidden="true">
                    <span style={{ width: `${dailyGoalProgress}%` }} />
                  </div>
                </section>

                <section className={styles.biPanel} aria-labelledby="weekly-bi-title">
                  <div className={styles.biPanelHeader}>
                    <span>Ultimos 7 dias</span>
                    <strong id="weekly-bi-title">Minutos focados</strong>
                  </div>
                  <div className={styles.biBars} aria-label="Minutos focados por dia">
                    {weeklyFocusRows.map((row) => (
                      <div className={styles.biBarItem} key={row.key}>
                        <div className={styles.biBarTrack} aria-hidden="true">
                          <span
                            style={{
                              height: `${Math.max(
                                8,
                                (row.minutes / maxWeeklyFocusMinutes) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <strong>{row.minutes}</strong>
                        <small>{row.label}</small>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={styles.biPanel} aria-labelledby="mode-bi-title">
                  <div className={styles.biPanelHeader}>
                    <span>Distribuicao</span>
                    <strong id="mode-bi-title">Foco por modo</strong>
                  </div>
                  {modeBiRows.length > 0 ? (
                    <div className={styles.biModeList}>
                      {modeBiRows.map((row) => (
                        <div className={styles.biModeRow} key={row.label}>
                          <div>
                            <strong>{row.label}</strong>
                            <span>
                              {row.count} focos - {row.minutes} min
                            </span>
                          </div>
                          <div className={styles.biProgressTrack} aria-hidden="true">
                            <span style={{ width: `${row.percentage}%` }} />
                          </div>
                          <em>{row.percentage}%</em>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.emptyHistory}>
                      Conclua um foco para alimentar a distribuicao por modo.
                    </p>
                  )}
                </section>

                <section className={styles.biPanel} aria-labelledby="recent-bi-title">
                  <div className={styles.biPanelHeader}>
                    <span>Historico</span>
                    <strong id="recent-bi-title">Ultimos focos</strong>
                  </div>
                  {latestFocusSessions.length > 0 ? (
                    <ol className={styles.biRecentList}>
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
                      Os focos finalizados aparecem aqui.
                    </p>
                  )}
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <canvas
        aria-hidden="true"
        className={styles.pictureInPictureMedia}
        height={PICTURE_IN_PICTURE_CANVAS_HEIGHT}
        ref={pictureInPictureCanvasRef}
        width={PICTURE_IN_PICTURE_CANVAS_WIDTH}
      />
      <video
        aria-hidden="true"
        className={styles.pictureInPictureMedia}
        muted
        playsInline
        ref={pictureInPictureVideoRef}
      />

      <a
        className={styles.githubLink}
        href="https://github.com/Magnumja/focuss_pomodoro_react"
        rel="noreferrer"
        target="_blank"
      >
        GitHub
      </a>
    </main>
  );
}
