## [FOSWLY] VOT-CLI

English version: [Link](https://github.com/FOSWLY/vot-cli/blob/main/README-EN.md)

Небольшой скрипт, позволяющий скачать перевод аудио перевод от Яндекса через терминал.

## 📖 Использование

### Примеры использования:

- `vot-cli [options] [args] <link> [link2] [link3] ...` — общий пример
- `vot-cli <link>` — получить перевод аудио по ссылке
- `vot-cli --help` — показать помощь по командам
- `vot-cli --version` — показать версию скрипта
- `vot-cli --output=<path> <link>` — получить перевод аудио по ссылке и сохранить его по указаному пути
- `vot-cli --output=<path> --reslang=en <link>` — получить перевод аудио на английский и сохранить его по указаному пути
- `vot-cli --subs --output=<path> --lang=en <link>` — получить английские субтитры к видео и сохранить их по указанному пути
- `vot-cli --output="." "https://www.youtube.com/watch?v=X98VPQCE_WI" "https://www.youtube.com/watch?v=djr8j-4fS3A&t=900s"` - пример с реальными данными

### Аргументы:

- `--output` — установить путь сохранения аудио файла перевода
- `--output-file` — установить имя файла для сохранения (требует указания пути сохранения аудио файла перевода в аргументе "--output")
- `--lang` — установить язык исходного видео (см. [вики](https://github.com/FOSWLY/vot-cli/wiki/%5BRU%5D-Supported-langs), чтобы узнать какие языки поддерживаются)
- `--reslang` — установить язык полученного аудио файла (см. [вики](https://github.com/FOSWLY/vot-cli/wiki/%5BRU%5D-Supported-langs), чтобы узнать какие языки поддерживаются)
- `--proxy` — установить HTTP или HTTPS прокси в формате `[<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>]`

### Опции:

- `-h`, `--help` — показать помощь по использованию
- `-v`, `--version` — показать версию скрипта
- `--subs`, `--subtitles` — получить субтитры к видео вместо аудио (язык субтитров для сохранения берется из `--reslang`)
- `--subs-srt`, `--subtitles-srt` — получить субтитры в формате `.srt` к видео вместо аудио

## 💻 Установка

1. Установите NodeJS 18+
2. Установите vot-cli глобально:

```bash
npm install -g vot-cli
```

## ⚙️ Установка для разработки

1. Установите NodeJS 18+
2. Скачайте и распакуйте архив с vot-cli
3. Установите зависимости:

```bash
npm i
```

4. После успешной установки модулей выполнить команду

```bash
npm link
```

5. Готово, теперь, вы можете использовать vot-cli в вашем терминале

## 🤖 Running the Telegram Bot

To run the Telegram bot on your own computer or server, follow these steps:

1.  **Prerequisites:**
    *   Ensure you have Node.js installed (version 18 or higher is recommended, as per the project's requirements).
    *   You will need a Telegram Bot Token. You can get one by talking to [BotFather](https://t.me/botfather) on Telegram and creating a new bot.

2.  **Clone the Repository:**
    If you haven't already, clone this repository to your local machine:
    ```bash
    git clone https://github.com/FOSWLY/vot-cli.git
    cd vot-cli
    ```

3.  **Install Dependencies:**
    Install the necessary Node.js packages:
    ```bash
    npm install
    ```

4.  **Set Up Telegram Bot Token:**
    You need to provide the Telegram Bot Token to the application. The recommended way is to set it as an environment variable named `TELEGRAM_BOT_TOKEN`.

    On Linux/macOS:
    ```bash
    export TELEGRAM_BOT_TOKEN="YOUR_ACTUAL_BOT_TOKEN_HERE"
    ```
    On Windows (Command Prompt):
    ```bash
    set TELEGRAM_BOT_TOKEN="YOUR_ACTUAL_BOT_TOKEN_HERE"
    ```
    Alternatively, you can directly modify the `src/bot.js` file where the token is defined, but using an environment variable is more secure and flexible:
    `const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';`

5.  **Run the Bot:**
    Start the bot using the following command:
    ```bash
    npm run bot
    ```
    This command executes the `node src/bot.js` script defined in `package.json`.

    If everything is set up correctly, you should see a "Bot started..." message in your console, and your bot should be responsive on Telegram.

### 🤖 Bot Command Examples

Once the bot is running, you can interact with it on Telegram using the following commands:

*   **Translate a video:**
    *   To translate a video to the default language (Russian):
      `/translate https://www.youtube.com/watch?v=examplevideo`
    *   To translate a video to a specific language (e.g., English):
      `/translate https://www.youtube.com/watch?v=examplevideo --reslang=en`

*   **Get subtitles for a video:**
    *   To get subtitles in the default language (Russian):
      `/subtitles https://www.youtube.com/watch?v=examplevideo`
    *   To get subtitles in a specific language (e.g., Spanish):
      `/subtitles https://www.youtube.com/watch?v=examplevideo --reslang=es`

*   **Get help:**
    *   To see all available commands, options, and supported languages:
      `/help`

**Note:**
*   Replace `https://www.youtube.com/watch?v=examplevideo` with the actual URL of the video you want to process.
*   The bot will attempt to download and send the translated audio or subtitle file directly. If it fails to do so for translated audio, it will provide a download link.

## 📁 Полезные ссылки

1. Версия для браузера: [Ссылка](https://github.com/ilyhalight/voice-over-translation)
2. Скрипт для скачивания видео с встроенным переводом (надстройка над vot-cli):
   | OS | Оболочка | Автор | Ссылка |
   | --- | --- | --- | --- |
   | Windows | PowerShell | Dragoy | [Ссылка](https://github.com/FOSWLY/vot-cli/tree/main/scripts)
   | Unix | Fish | Musickiller | [Ссылка](https://gitlab.com/musickiller/fishy-voice-over/)
   | Linux | Bash | s-n-alexeyev | [Ссылка](https://github.com/s-n-alexeyev/yvt)
   | Cloud | Google Colab | alex2844 | [Ссылка](https://github.com/alex2844/youtube-translate)

## ❗ Примечание

1. Оборачивайте ссылки в кавычки, дабы избежать ошибок
2. Для записи в системный раздел (например на "Диск C" в Windows) необходимы права администратора

![example btn](https://github.com/FOSWLY/vot-cli/blob/main/img/example.png "example")
