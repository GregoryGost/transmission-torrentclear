# **Transmission torrentclear application**

![License](https://img.shields.io/github/license/GregoryGost/Transmission-torrentclear)
![RepoSize](https://img.shields.io/github/repo-size/GregoryGost/Transmission-torrentclear)
![CodeSize](https://img.shields.io/github/languages/code-size/GregoryGost/Transmission-torrentclear)
![IssuesOpen](https://img.shields.io/github/issues-raw/GregoryGost/Transmission-torrentclear)
![LatestRelease](https://img.shields.io/github/v/release/GregoryGost/Transmission-torrentclear)

Создано в рамках статьи для блога: [Домашний Сервер: Часть 4 – Настройка Transmission daemon в контейнере LXC Proxmox-VE](https://gregory-gost.ru/domashnij-server-chast-4-nastrojka-transmission-daemon-v-kontejnere-lxc-proxmox-ve/)

## **Оглавление**

<!--ts-->

- [Приложение transmission-torrentclear](#приложение-transmission-torrentclear)
  - [Установка](#установка)
- [Ротация логов](#ротация-логов)
- [Лицензирование](#лицензирование)

<!--te-->

## **Приложение** `transmission-torrentclear`

Основной кодовой базой является программная платформа [NodeJS](https://nodejs.org/) основанная на движке [V8](https://v8.dev/)

Необходимо для автоматической очистки скачанных медиа торрент файлов согласно условиям:

1. Если торрент скачан на `100%` и коэффициент отданного к скачанному (RATIO) больше, либо равен заданному в файле `settings.json` сервиса transmission-daemon
2. Или кол-во дней на раздаче больше или равно заданному в конфигурации приложения.

Соответственно эти значения можно менять в файле конфигурации.  
Значение RATIO считывается из файла настроек transmission (путь по умолчанию `/etc/transmission-daemon/settings.json`)

История версий:

- v2.0.0 - (29.11.2022) Полностью заменен файл **torrentclear** на **NodeJS** проект. Изменена и расширена логика обработки, улучшено логирование (уровни info, debug, etc) и многое другое.

&nbsp;

- v1.0.2 - (17.10.2022) Заменена команда запуска Python на `python3` т.к. в Debian 11 удалён python2.
- v1.0.1 - (26.01.2021) Удален параметр CLEARFLAG т.к. не используется
- v1.0.0 - (10.01.2021) Добавлено определение директории. Если директория, то загруженное удаляется вместе с файлами т.к. мы по окончании загрузки и так все файлы скопировали
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

### **Установка**

Нужно поставить NodeJS и менеджер пакетов PNPM (если Вы ставили приложение [torrentdone](https://github.com/GregoryGost/Transmission-torrentdone) то всё уже должно быть установлено)  
Команды для Proxmox LXC Debian 11.5 под root

```shell
apt update
apt upgrade -y
apt install -y curl gcc g++ make git
```

Ставим NodeJS  
Пойти в <https://github.com/nodesource/distributions/blob/master/README.md>  
Выбрать LTS версию не ниже 16 (не тестировалось на 18, но работать должно)

```shell
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt update
apt install -y nodejs
node -v
v16.17.0
```

Устанавливаем глобально менеджер пакетов PNPM

```shell
curl -fsSL https://get.pnpm.io/install.sh | sh -
export PNPM_HOME="/root/.local/share/pnpm"
export PATH="$PNPM_HOME:$PATH"
pnpm -v
7.15.0
```

Далее создаем проект и настраиваем его

Если Вы не хотите ставить PNPM, то можете удалить файл `pnpm-lock.yaml` и использовать стандартную команду `npm ci --only=production` вместо `pnpm i -P`

```shell
mkdir /opt/torrentclear
cd /opt/torrentclear
git clone https://github.com/GregoryGost/Transmission-torrentclear.git .
pnpm i -P
cd ..
chown -R debian-transmission:debian-transmission torrentclear/
chmod +x torrentclear/dist/main.js
```

Создаем файл настроек и задаем свои параметры

```shell
nano /opt/torrentclear/dist/config.json
```

```json
{
  "login": "transmission_login",
  "password": "1234567890"
}
```

Возможные параметры для конфигурирования

Обязательные:

- `login` (обязательный) - Логин авторизации для transmission-remote. Прописан в файле `settings.json` самого Transmission. Как правило располагается по пути `/etc/transmission-daemon/`
- `password` (обязательный) - Пароль авторизации для transmission-remote

Опциональные:

- `node_env` - Режим использования приложения. Задать `development` если режим разработки. Default: `production`
- `log_level` - Уровень логирования. Default: `info`. Для режима разработки `trace`
- `log_file_path` - Путь до файла сохранения логов. Default: `/var/log/transmission/torrentdone.log`
- `log_date_format` - Формат вывода даты в логе. Default: `DD.MM.YYYY HH:mm:ss` Example: 12.11.2022 21:54:03
- `ip_address` - IP адрес для доступа к transmission. Default: `127.0.0.1`
- `tcp_port` - TCP порт для доступа к transmission. Default: `9091`
- `limit_time` - Разница во времени (в секундах) по которому файл удаляется если не достигнут RATIO (второе условие). Default: `604800` (7 дней)
- `settings_file_path` - Путь до файла с настройками transmission. Default: `/etc/transmission-daemon/settings.json`
- `cron_expression` - Период запуска в формате [CRON](https://crontab.cronhub.io/). Default: `0 * * * *` (каждый час)
- `allowed_media_extensions` - Расширения файлов перечисленные через запятую для которых осуществляется обработка. Default: `mkv,mp4,avi`

Устанавливаем приложение как сервис systemd

```shell
cp /opt/torrentclear/torrentclear.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable torrentclear.service
systemctl start torrentclear.service
systemctl status torrentclear.service
```

```shell
● torrentclear.service - Transmission torrent clear cron worker
     Loaded: loaded (/etc/systemd/system/torrentclear.service; enabled; vendor preset: enabled)
     Active: active (running) since Tue 2022-11-29 22:36:44 MSK; 2s ago
   Main PID: 27701 (node)
      Tasks: 11 (limit: 19042)
     Memory: 19.9M
        CPU: 167ms
     CGroup: /system.slice/torrentclear.service
             └─27701 /usr/bin/node main.js

Nov 29 22:36:44 TORRENT systemd[1]: Started Transmission torrent clear cron worker.
```

## **Ротация логов**

Приложение по умолчанию пишет результат своей работы в LOG файл **torrentclear.log**  
Log файл расположен по пути, где обычно хранятся все лог файлы самого transmisson-daemon:

```shell
/var/log/transmission/torrentclear.log
```

Начиная с версии 2.0.0 в `torrentclear` расположение лог файлов можно задавать самому через конфигурацию. Соответственно необходимо изменять настройки ротации с учётом нового расположения.

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

## **Лицензирование**

Все исходные материалы для проекта распространяются по лицензии [GPL v3](./LICENSE 'Описание лицензии').  
Вы можете использовать проект в любом виде, в том числе и для коммерческой деятельности, но стоит помнить, что автор проекта не дает никаких гарантий на работоспособность исполняемых файлов, а так же не несет никакой ответственности по искам или за нанесенный ущерб.
