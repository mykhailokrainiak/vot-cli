// src/bot.js (updates and additions)
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    fetchSubtitlesPublic,
    translateVideoPublic,
    downloadVideoPublic,
    mergeVideoAndAudio
} from './vot-cli-lib.js';

const supportedLanguages = ['ru', 'en', 'de', 'fr', 'es', 'it', 'tr', 'ja', 'ko', 'zh', 'ar', 'bn', 'bs', 'cs', 'da', 'el', 'et', 'fi', 'he', 'hi', 'hr', 'hu', 'id', 'lt', 'lv', 'mk', 'nb', 'ne', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sr', 'sv', 'ta', 'th', 'uk', 'vi'];
const defaultResponseLang = 'ru';

const token = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

async function downloadAsset(url, outputPath, assetName = 'file') {
  console.log(`Downloading ${assetName} from ${url} to ${outputPath}`);
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    console.log(`${assetName} downloaded successfully to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`Error downloading ${assetName} from ${url}:`, error.message);
    if (fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch (e) { console.error(`Failed to cleanup partial asset ${outputPath}`, e); }
    }
    throw new Error(`Failed to download ${assetName}: ${error.message}`);
  }
}

async function handleVideoTranslation(chatId, videoUrl, responseLang) {
  bot.sendMessage(chatId, `Starting translation for "${videoUrl}" to '${responseLang}'. This may take several minutes. I'll message you when it's ready!`);
  try {
    const result = await translateVideoPublic(videoUrl, null, responseLang);
    if (result.success && result.downloadUrl) {
      bot.sendMessage(chatId, `Translation complete for "${videoUrl}"! Attempting to send the audio file...`);
      try {
        const audioResponse = await axios.get(result.downloadUrl, { responseType: 'arraybuffer', timeout: 60000 });
        const audioBuffer = Buffer.from(audioResponse.data);
        const urlParts = videoUrl.split('/');
        const basicName = urlParts[urlParts.length - 1] || 'translation';
        const safeName = basicName.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 50);
        await bot.sendAudio(chatId, audioBuffer, {}, { filename: `${safeName}_${responseLang}.mp3` });
      } catch (downloadError) {
        console.error(`Error downloading translated audio for ${videoUrl}:`, downloadError.message);
        bot.sendMessage(chatId, `Successfully translated "${videoUrl}", but I couldn't send the audio file directly. You can download it from: ${result.downloadUrl}`);
      }
    } else {
      bot.sendMessage(chatId, `Translation failed for "${videoUrl}": ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`Unexpected error in handleVideoTranslation for ${videoUrl}:`, error);
    bot.sendMessage(chatId, `An unexpected error occurred while translating "${videoUrl}": ${error.message}`);
  }
}

async function handleSubtitlesFetching(chatId, videoUrl, responseLang) {
  bot.sendMessage(chatId, `Fetching subtitles for ${videoUrl} in language '${responseLang}'...`);
  try {
    const result = await fetchSubtitlesPublic(videoUrl, null, responseLang);
    if (result.success && result.subtitle && result.subtitle.url) {
      bot.sendMessage(chatId, `Found subtitles in ${result.subtitle.language} from ${result.subtitle.source}. URL: ${result.subtitle.url}. Downloading...`);
      const subtitleResponse = await axios.get(result.subtitle.url, {
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      });
      const subtitleContent = subtitleResponse.data;
      if (subtitleContent) {
        let filename = `subtitles_${result.subtitle.language}.txt`;
        if (result.subtitle.url.includes('.srt')) filename = `subtitles_${result.subtitle.language}.srt`;
        if (result.subtitle.url.includes('.vtt')) filename = `subtitles_${result.subtitle.language}.vtt`;
        bot.sendDocument(chatId, Buffer.from(subtitleContent), {}, { filename, contentType: 'text/plain' });
      } else {
        bot.sendMessage(chatId, 'Failed to download subtitle content from the provided URL.');
      }
    } else {
      bot.sendMessage(chatId, result.error || 'Failed to fetch subtitles. No specific error message was provided.');
    }
  } catch (error) {
    console.error('Error in handleSubtitlesFetching:', error.message);
    let displayError = error.message;
    if (error.response && error.response.status) displayError += ` (Status: ${error.response.status})`;
    bot.sendMessage(chatId, `An error occurred while fetching or downloading subtitles: ${displayError}`);
  }
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Welcome! Use /help to see available commands.');
});

bot.onText(/\/help/, (msg) => {
  const helpMessage = `
Available commands:
/start - Start interacting with the bot
/help - Show this help message

/translate <video_url> [options] - Get translated audio for a video.
  Options:
    --reslang=<lang_code>
      Target language for translation. Default: ${defaultResponseLang}
      Supported: ${supportedLanguages.join(', ')}

/subtitles <video_url> [options] - Get subtitles for a video.
  Options:
    --reslang=<lang_code>
      Target language for subtitles. Default: ${defaultResponseLang}
      Supported: ${supportedLanguages.join(', ')}

/mergetranslate <video_url> [options] - Get a video with translated audio merged. (EXPERIMENTAL: Takes significant time and resources)
  Options:
    --reslang=<lang_code>
      Target language for translation. Default: ${defaultResponseLang}
      Supported: ${supportedLanguages.join(', ')}
`;
  bot.sendMessage(msg.chat.id, helpMessage);
});

const translateSubtitlesRegex = /\/(translate|subtitles)\s+(.+)/;
bot.onText(translateSubtitlesRegex, (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  const argsString = match[2];
  const urlRegex = /(https?:\/\/[^\s]+)/;
  const urlMatch = argsString.match(urlRegex);
  const videoUrl = urlMatch ? urlMatch[0] : null;
  if (!videoUrl) {
    bot.sendMessage(chatId, 'Please provide a valid video URL.');
    return;
  }
  let responseLang = defaultResponseLang;
  const reslangRegex = /--reslang=(\w+)/;
  const reslangMatch = argsString.match(reslangRegex);
  if (reslangMatch && reslangMatch[1]) {
    const langArg = reslangMatch[1].toLowerCase();
    if (supportedLanguages.includes(langArg)) {
      responseLang = langArg;
    } else {
      bot.sendMessage(chatId, `Unsupported language: '${langArg}'. Using default '${defaultResponseLang}'. Supported: ${supportedLanguages.join(', ')}`);
    }
  }
  if (command === "translate") {
    handleVideoTranslation(chatId, videoUrl, responseLang);
  } else if (command === "subtitles") {
    handleSubtitlesFetching(chatId, videoUrl, responseLang);
  }
});

const mergeTranslateRegex = /\/mergetranslate\s+(.+)/;
bot.onText(mergeTranslateRegex, async (msg, match) => {
  const chatId = msg.chat.id;
  const argsString = match[1];
  const urlRegex = /(https?:\/\/[^\s]+)/;
  const urlMatch = argsString.match(urlRegex);
  const videoUrl = urlMatch ? urlMatch[0] : null;

  if (!videoUrl) {
    bot.sendMessage(chatId, 'Please provide a valid video URL starting with http:// or https://.');
    return;
  }

  let responseLang = defaultResponseLang;
  const reslangRegex = /--reslang=(\w+)/;
  const reslangMatch = argsString.match(reslangRegex);
  if (reslangMatch && reslangMatch[1]) {
    const langArg = reslangMatch[1].toLowerCase();
    if (supportedLanguages.includes(langArg)) {
      responseLang = langArg;
    } else {
      bot.sendMessage(chatId, `Unsupported language: '${langArg}'. Using default '${defaultResponseLang}'. Supported: ${supportedLanguages.join(', ')}`);
    }
  }

  bot.sendMessage(chatId, `Starting video merge process for "${videoUrl}" with '${responseLang}' audio. This is EXPERIMENTAL and will take considerable time & resources. Please be patient.`);

  let tempTranslatedAudioPath = null;
  let originalVideoPath = null;
  let mergedVideoPath = null;

  try {
    bot.sendMessage(chatId, `Step 1/4: Getting translated audio URL for "${videoUrl}"...`);
    const translateResult = await translateVideoPublic(videoUrl, null, responseLang);
    if (!translateResult.success || !translateResult.downloadUrl) {
      throw new Error(`Failed to get translated audio link: ${translateResult.error || 'No download URL'}`);
    }

    const tempDir = os.tmpdir();
    // Try to get extension from URL, default to mp3
    const audioUrlParts = translateResult.downloadUrl.split('.');
    const audioExtension = audioUrlParts.length > 1 ? audioUrlParts.pop() : 'mp3';
    const audioFilename = `translated_audio_${Date.now()}.${audioExtension}`;
    tempTranslatedAudioPath = path.join(tempDir, audioFilename);

    bot.sendMessage(chatId, 'Step 2/4: Downloading translated audio to ' + tempTranslatedAudioPath + '...');
    await downloadAsset(translateResult.downloadUrl, tempTranslatedAudioPath, 'translated audio');

    bot.sendMessage(chatId, 'Step 3/4: Downloading original video "' + videoUrl + '"...');
    originalVideoPath = await downloadVideoPublic(videoUrl);

    bot.sendMessage(chatId, `Step 4/4: Merging video and audio. This is the longest step...\`);
    mergedVideoPath = await mergeVideoAndAudio(originalVideoPath, tempTranslatedAudioPath);

    const finalFilename = path.basename(mergedVideoPath);
    bot.sendMessage(chatId, `Merging complete! Preparing to send '${finalFilename}'...\`);

    await bot.sendVideo(chatId, mergedVideoPath, { caption: `Video "${videoUrl}" merged with ${responseLang} audio.` });
    bot.sendMessage(chatId, "Merged video sent successfully!");

  } catch (error) {
    console.error(`Error in /mergetranslate for ${videoUrl}:`, error);
    bot.sendMessage(chatId, `An error occurred: ${error.message}`);
  } finally {
    const filesToClean = [tempTranslatedAudioPath, originalVideoPath, mergedVideoPath];
    filesToClean.forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); console.log(`Cleaned up: ${filePath}`); }
        catch (e) { console.error(`Failed to clean: ${filePath}`, e); }
      }
    });
  }
});

bot.on('error', (error) => { console.error('Global Bot Error:', error); });
bot.on('polling_error', (error) => { console.error('Bot Polling Error:', error.code ? `${error.code} ${error.message}` : JSON.stringify(error)); });
bot.on('webhook_error', (error) => { console.error('Bot Webhook Error:', error.code ? `${error.code} ${error.message}` : JSON.stringify(error)); });

console.log('Bot started...');
