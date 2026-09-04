import { initFetchInterceptor } from "~/mod/features/utils";

// Инициализация мода utils для перехвата запросов к yandex api
initFetchInterceptor();

// Инициализация мода на разблокировку плюса
import "./features/plus-unlocker";

// Инициализация интерфейса мода
import "./features/ui/index";

// Инициализация мода на изменение шрифта
import "./features/font-changer";

// Инициализация мода на изменение размера интерфейса
import "./features/scale-changer";

// Инициализация мода на кастомные темы
import "./features/custom-themes";

// Инициализация мода на режим разработчика
import "./features/devtools";

// Инициализация мода на авто-выбор качества
import "./features/auto-best-quality";

// Инициализация renderer части мода discordRPC
import "./features/discord-RPC/discordRPC";

// Инициализация ambient-темы из обложки
import "./features/ambient-theme";

// Инициализация аудио-визуализатора
import "./features/audio-visualizer";

// Инициализация глобальных горячих клавиш
import "./features/global-hotkeys";

// Инициализация контроля скорости воспроизведения
import "./features/playback-speed";

// Инициализация таймера сна
import "./features/sleep-timer";

// Инициализация Last.fm скробблинга
import "./features/lastfm";

// Инициализация локальной статистики прослушиваний
import "./features/listening-stats";

// Инициализация settings
import "./features/settings";

// Инициализация мода для переопределения экспериментов
import "./features/experiments-toggle";
