# Transmission torrentclear application

![License](https://img.shields.io/github/license/GregoryGost/transmission-torrentclear)
![RepoSize](https://img.shields.io/github/repo-size/GregoryGost/transmission-torrentclear)
![CodeSize](https://img.shields.io/github/languages/code-size/GregoryGost/transmission-torrentclear)
![IssuesOpen](https://img.shields.io/github/issues-raw/GregoryGost/transmission-torrentclear)
![LatestRelease](https://img.shields.io/github/v/release/GregoryGost/transmission-torrentclear)
![LatestTag](https://img.shields.io/github/v/tag/GregoryGost/transmission-torrentclear?sort=date&logo=substack&logoColor=white)
![CI](https://github.com/GregoryGost/transmission-torrentclear/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/GregoryGost/transmission-torrentclear/actions/workflows/check-dist.yml/badge.svg)](https://github.com/GregoryGost/transmission-torrentclear/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/GregoryGost/transmission-torrentclear/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/GregoryGost/transmission-torrentclear/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)
![Watchers](https://img.shields.io/github/watchers/GregoryGost/transmission-torrentclear)
![RepoStars](https://img.shields.io/github/stars/GregoryGost/transmission-torrentclear)

Создано в рамках статьи для блога:
[Домашний Сервер: Часть 4 – Настройка Transmission daemon в контейнере LXC Proxmox-VE](https://gregory-gost.ru/domashnij-server-chast-4-nastrojka-transmission-daemon-v-kontejnere-lxc-proxmox-ve/)

## Оглавление

<!--ts-->

- [Описание](#описание)
- [Установка](#установка)
  - [Конфигурирование](#конфигурирование)
- [Обновление](#обновление)
- [Ротация логов](#ротация-логов)
- [Лицензирование](#лицензирование)
- [Немного о себе](#немного-о-себе)

<!--te-->

## Описание

Основной кодовой базой является программная платформа [Node.js](https://nodejs.org/) основанная на "браузерном" движке
[V8](https://v8.dev/)

Данное приложение необходимо для автоматической очистки скачанных медиа торрент файлов через `transmission-daemon`
согласно условиям:

1. Если торрент скачан на `100%` и коэффициент отданного к скачанному (RATIO) больше, либо равен заданному в файле
   `settings.json` сервиса transmission-daemon
2. Или кол-во дней на раздаче больше или равно заданному в конфигурации приложения.

Соответственно эти значения можно менять в файлах конфигурации.  
Значение RATIO считывается из файла настроек transmission-daemon (путь по умолчанию
`/etc/transmission-daemon/settings.json`) Значение интервала между датами указывается в файле конфигурации приложения
`config.json` (см. раздел **Конфигурирование**)

История версий:

- v3.0.0 - (28.04.2024) Изменение архитектуры сборки. Теперь нет необходимости качать зависимости из npm. Заменена
  библиотека логирования на log4js. Покрытие юнит тестами. Удален фильтр по расширению файлов, теперь обрабатываются все
  торрент файлы.
- v2.1.0 - (03.04.2023) Добавлено сохранение метрик после полного выполнения работы приложения.
- v2.0.1 - (01.04.2023) Исправлена ошибка НЕ удаления торрента, если файл был удален ранее (к примеру из Plex).
- v2.0.0 - (29.11.2022) Полностью заменен файл **torrentclear** с **bash** версии на **Node.js** версию. Изменена и
  расширена логика обработки, улучшено логирование (уровни info, debug, etc) и многое другое.
- v1.0.2 - (17.10.2022) Заменена команда запуска Python на `python3` т.к. в Debian 11 удалён python2.
- v1.0.1 - (26.01.2021) Удален параметр CLEARFLAG т.к. не используется
- v1.0.0 - (10.01.2021) Добавлено определение директории. Если директория, то загруженное удаляется вместе с файлами
  т.к. мы по окончании загрузки и так все файлы скопировали
- v0.9.17 - (24.03.2020) Изменен принцип сравнения "RATIO". Добавлено логирование RATIO
- v0.9.16 - (24.03.2020) Добавлены комментарии к коду
- v0.9.15 - (21.03.2020) Удалена отправка сообщений по email. Изменен принцип логирования. Небольшой рефакторинг
- v0.0.13 - (19.04.2018) Локальные перемнные в функции отправки email заменены на глобальные
- v0.0.11 - (18.04.2018) Добавлен комментарий к коду
- v0.0.10 - (18.04.2018) echo заменен на функцию логирования
- v0.0.9 - (18.04.2018) echo заменен на функцию логирования
- v0.0.8 - (18.04.2018) Добавлен комментарий и вывод информации в консоль
- v0.0.7 - (18.04.2018) Добавлен комментарий к коду
- v0.0.6 - (18.04.2018) Изменена команда подключения к Transmission и добавлены комментарии
- v0.0.5 - (18.04.2018) Добавлен комментарий к коду
- v0.0.4 - (18.04.2018) Первая версия

## Установка

Достаточно поставить Node.js Команды для Proxmox LXC Debian 11.5 под root

```shell
apt update
apt upgrade -y
apt install -y curl git
```

Ставим Node.js  
Пойти в <https://github.com/nodesource/distributions/blob/master/README.md>  
Выбрать LTS версию не ниже 20

```shell
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt update
apt install -y nodejs
node -v
v20.11.0
```

Далее создаем папку под приложение и настраиваем его

```shell
mkdir /opt/torrentclear
cd /opt/torrentclear
git clone https://github.com/GregoryGost/transmission-torrentclear.git .
chown -R debian-transmission:debian-transmission /opt/torrentclear
chmod +x /opt/torrentclear/dist/index.js /opt/torrentclear/update.sh
```

### Конфигурирование

Создаем файл настроек и задаем свои параметры

```shell
nano /opt/torrentclear/config.json
```

```json
{
  "login": "transmission_login",
  "password": "<your_password>"
}
```

Возможные параметры для конфигурирования

Обязательные:

- `login` - Логин авторизации для transmission-remote. Прописан в файле `settings.json` самого Transmission. Как правило
  располагается по пути `/etc/transmission-daemon/`
- `password` - Пароль авторизации для transmission-remote

Опциональные:

- `node_env` - Режим использования приложения. Задать `development` если режим разработки. Default: `production`
- `log_level` - Уровень логирования. Default: `info`. Для режима разработки `trace`
- `log_file_path` - Путь до файла сохранения логов. Default: `/var/log/transmission/torrentdone.log`
- `date_format` - Формат вывода даты в приложении. Для форматирования используется модуль
  [moment](https://www.npmjs.com/package/moment) Default: `DD.MM.YYYY_HH:mm:ss` Example: 12.11.2022_21:54:03
- `log_date_format` - Формат вывода даты в логах (log4js). Для форматирования используется модуль
  [date-format](https://www.npmjs.com/package/date-format) Default: `dd.MM.yyyy_hh:mm:ss.SSS` Example:
  12.11.2022_21:54:03.254
- `ip_address` - IP адрес для доступа к transmission. Default: `127.0.0.1`
- `tcp_port` - TCP порт для доступа к transmission. Default: `9091`
- `limit_time` - Разница во времени (в секундах) по которому файл удаляется если не достигнут RATIO (второе условие).
  Default: `604800` (7 дней)
- `settings_file_path` - Путь до файла с настройками transmission. Default: `/etc/transmission-daemon/settings.json`

Устанавливаем приложение как сервис systemd и ставим его в автозапуск  
Приложение работает через базовый таймер systemd  
По умолчанию проверка происходит **каждый час**

```shell
cp /opt/torrentclear/torrentclear.service /etc/systemd/system/
cp /opt/torrentclear/torrentclear.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable torrentclear.timer
systemctl start torrentclear.timer
```

```shell
systemctl status torrentclear.timer
```

```shell
● torrentclear.timer - Transmission torrent clear process timer
     Loaded: loaded (/etc/systemd/system/torrentclear.timer; enabled; vendor preset: enabled)
     Active: active (waiting) since Thu 2022-12-08 22:26:20 MSK; 2min 35s ago
    Trigger: Thu 2022-12-08 23:00:00 MSK; 31min left
   Triggers: ● torrentclear.service

Dec 08 22:26:20 TORRENT systemd[1]: Started Transmission torrent clear process timer.
```

```shell
systemctl status torrentclear.service
```

```shell
● torrentclear.service - Transmission torrent clear cron worker
     Loaded: loaded (/etc/systemd/system/torrentclear.service; disabled; vendor preset: enabled)
     Active: inactive (dead) since Thu 2022-12-08 22:26:20 MSK; 3min 34s ago
TriggeredBy: ● torrentclear.timer
    Process: 12323 ExecStart=/usr/bin/node main.js (code=exited, status=0/SUCCESS)
   Main PID: 12323 (code=exited, status=0/SUCCESS)
        CPU: 160ms
```

Для настройки таймера отредактируйте файл `torrentclear.timer` и его параметр `OnCalendar`  
Более детальное описание параметров таймера и
[OnCalendar](https://www.freedesktop.org/software/systemd/man/systemd.time.html#) в частности

Проверить свои таймеры можно с помощью встроенной утилиты `systemd-analyze calendar`  
Пример: `systemd-analyze calendar --iterations=2 "Mon *-05~3"`

```shell
  Original form: Mon *-05~3
Normalized form: Mon *-05~03 00:00:00
    Next elapse: Mon 2023-05-29 00:00:00 MSK
       (in UTC): Sun 2023-05-28 21:00:00 UTC
       From now: 5 months 18 days left
       Iter. #2: Mon 2028-05-29 00:00:00 MSK
       (in UTC): Sun 2028-05-28 21:00:00 UTC
       From now: 5 years 5 months left
```

## Обновление

Стоит обновить Node.js. Как пример обновление на 20 LTS версию.

```shell
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt update && apt upgrade -y
```

Для обновления из `master` ветки необходимо запустить файл `update.sh` без указания каких-либо параметров

```shell
./update.sh
```

Если вы хотите обновить из другой ветки, просто передайте её название скрипту обновления

```shell
./update.sh develop
```

## Ротация логов

Приложение по умолчанию пишет результат своей работы в LOG файл **torrentclear.log**  
Log файл расположен по пути, где обычно хранятся все лог файлы самого transmisson-daemon:

```shell
/var/log/transmission/torrentclear.log
```

Начиная с версии 2.0.0 в `torrentclear` расположение лог файлов можно задавать самому через конфигурацию. Соответственно
необходимо изменять настройки ротации с учётом нового расположения.

Ротация лог файлов обеспечивается базовой подсистемой самой ОС **logrotate**.  
Ротация происходит для всех лог файлов в папке `/var/log/transmission/`  
Расположение файла настройки ротации логов:

```shell
/etc/logrotate.d/transmission
```

После создания или загрузки файла настройки, необходимо перезапустить службу logrotate:

```shell
systemctl restart logrotate.service
systemctl status logrotate.service
```

## Лицензирование

Все исходные материалы для проекта распространяются по лицензии [GPL v3](./LICENSE 'Описание лицензии').  
Вы можете использовать проект в любом виде, в том числе и для коммерческой деятельности, но стоит помнить, что автор
проекта не дает никаких гарантий на работоспособность исполняемых файлов, а так же не несет никакой ответственности по
искам или за нанесенный ущерб.

Этот репозиторий содержит ссылки на все используемые модули и их лицензии. Они собраны в
[специальный файл лицензий](./dist/licenses.txt). Их авторы самостоятельно несут (или не несут) ответственность за
качество, стабильность и работу этих модулей.

## Немного о себе

GregoryGost - <https://gregory-gost.ru>
