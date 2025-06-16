// src/vot-cli-lib.js
import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import translateVideo from "./translateVideo.js";
import ytDlpExec from 'yt-dlp-exec';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function fetchSubtitlesPublic(finalURL, requestLang, responseLang, proxyData = null) {
  return new Promise((resolve) => {
    yandexRequests.requestVideoSubtitles(
      finalURL,
      requestLang,
      proxyData,
      (success, response) => {
        if (!success) {
          resolve({ success: false, error: "Failed to request Yandex subtitles list." });
          return;
        }

        try {
          const subtitlesResponse = yandexProtobuf.decodeSubtitlesResponse(response);
          let subtitles = subtitlesResponse.subtitles ?? [];

          subtitles = subtitles.reduce((result, yaSubtitlesObject) => {
            if (
              yaSubtitlesObject.language &&
              !result.find((e) => {
                if (
                  e.source === "yandex" &&
                  e.language === yaSubtitlesObject.language &&
                  !e.translatedFromLanguage
                ) {
                  return e;
                }
              })
            ) {
              result.push({
                source: "yandex",
                language: yaSubtitlesObject.language,
                url: yaSubtitlesObject.url,
                type: 'original'
              });
            }
            if (yaSubtitlesObject.translatedLanguage) {
              result.push({
                source: "yandex",
                language: yaSubtitlesObject.translatedLanguage,
                translatedFromLanguage: yaSubtitlesObject.language,
                url: yaSubtitlesObject.translatedUrl,
                type: 'translated'
              });
            }
            return result;
          }, []);

          if (subtitles.length === 0) {
            resolve({ success: false, error: "No subtitles available for this video." });
            return;
          }

          const requestedSubtitle = subtitles.find(s => s.language === responseLang);

          if (!requestedSubtitle) {
            const availableLangs = subtitles.map(s => s.language).join(', ');
            resolve({ success: false, error: `Subtitles in language '${responseLang}' not found. Available languages: ${availableLangs}` });
            return;
          }

          resolve({ success: true, subtitle: requestedSubtitle });

        } catch (e) {
          console.error('Error processing subtitles:', e);
          resolve({ success: false, error: `Error processing subtitles: ${e.message}` });
        }
      },
    );
  });
}

export async function mergeVideoAndAudio(videoPath, audioPath) {
  return new Promise(async (resolve, reject) => {
    const tempDir = os.tmpdir();
    const uniqueFilename = `merged_video_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.mp4`;
    const outputPath = path.join(tempDir, uniqueFilename);

    console.log(`Attempting to merge video: ${videoPath} and audio: ${audioPath} into ${outputPath}`);

    const ffmpegArgs = [
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',         // Copy video stream without re-encoding
      '-c:a', 'aac',          // Encode audio to AAC (widely compatible)
      '-strict', '-2',        // Necessary for some AAC encoders with ffmpeg versions
      '-map', '0:v:0',        // Map video from first input
      '-map', '1:a:0',        // Map audio from second input
      '-shortest',            // Finish encoding when the shortest input stream ends
      outputPath
    ];

    try {
      console.log(`Executing ffmpeg with args: ${ffmpegArgs.join(' ')}`);
      // Set a timeout for ffmpeg process, e.g., 15 minutes (900000 ms)
      // This depends on video size and server capability.
      const { stdout, stderr } = await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 900000 });

      if (stderr && stderr.length > 0 && !stderr.toLowerCase().includes('ffmpeg version') && !stderr.toLowerCase().includes('built with')) {
        // Some ffmpeg versions output info to stderr. We only care if it seems like an error.
        // A more sophisticated check for actual errors in stderr might be needed.
        // If execFileAsync throws on non-zero exit code, this might not be hit for errors.
        console.warn(`FFmpeg stderr: ${stderr}`);
      }
      console.log(`Video merged successfully: ${outputPath}`);
      resolve(outputPath);

    } catch (error) {
      console.error(`Error merging video with ffmpeg (Code: ${error.code}):`);
      console.error(`Stderr: ${error.stderr || 'N/A'}`);
      console.error(`Stdout: ${error.stdout || 'N/A'}`);
      console.error(`Full error: ${error.message}`);
      reject(new Error(`Failed to merge video with ffmpeg. ${error.stderr || error.message}`));
    }
  });
}

export async function downloadVideoPublic(videoUrl) {
  return new Promise(async (resolve, reject) => {
    const tempDir = os.tmpdir();
    // Generate a unique filename to avoid collisions
    const uniqueFilename = `video_${Date.now()}_${Math.random().toString(36).substring(2, 15)}.mp4`;
    const outputPath = path.join(tempDir, uniqueFilename);

    console.log(`Attempting to download video: ${videoUrl} to ${outputPath}`);

    try {
      // yt-dlp options:
      // -f: format selection. 'bv*+ba/b': best video + best audio / best (fallback)
      // --merge-output-format mp4: ensures MP4 container if merging is done by yt-dlp
      // -o: output template
      // --no-playlist: download only the video if URL is part of a playlist
      // --progress: show progress (might be noisy for library use, but good for debug)
      // For simplicity, let's use a basic format that often results in a single mp4 file.
      // Using -S to sort by filesize might be an option for "best" if specific format codes are unknown.
      // A common recommendation for a single file:
      // ytDlpExec(videoUrl, { format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best', output: outputPath, 'merge-output-format': 'mp4', 'no-playlist': true })
      // For broader compatibility and simpler command:
      const ytdlpProcess = ytDlpExec(videoUrl, {
        output: outputPath,
        format: 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b', // Prioritize mp4, then best available
        'merge-output-format': 'mp4', // Ensure output is mp4 if merging happens
        'no-playlist': true, // Download only single video if URL is a playlist
        // 'progress': true, // Optional: enable for more verbose download logging
        // 'quiet': true, // Optional: suppress console output from yt-dlp
        // 'no-warnings': true, // Optional
      });

      // Optional: Log stdout/stderr from yt-dlp if needed for debugging
      // ytdlpProcess.stdout.pipe(process.stdout); // Be careful with this in library code
      // ytdlpProcess.stderr.pipe(process.stderr);

      await ytdlpProcess; // Wait for the promise from ytDlpExec to resolve

      console.log(`Video downloaded successfully: ${outputPath}`);
      resolve(outputPath);

    } catch (error) {
      console.error(`Error downloading video ${videoUrl}:`, error.stderr || error.message || error);
      // Attempt to clean up partial file if it exists
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (cleanupError) {
          console.error(`Failed to cleanup partial download ${outputPath}:`, cleanupError);
        }
      }
      reject(new Error(`Failed to download video: ${error.stderr || error.message}`));
    }
  });
}

export async function translateVideoPublic(videoUrl, requestLang, responseLang, proxyData = null) {
  return new Promise(async (resolveOuter) => {
    const attemptTranslation = () => {
      return new Promise((resolveInner) => {
        translateVideo(
          videoUrl,
          requestLang,
          responseLang,
          null,
          proxyData,
          (success, urlOrError) => {
            if (success) {
              if (!urlOrError) {
                resolveInner({ success: false, error: "The translation response did not contain a download link." });
              } else {
                resolveInner({ success: true, downloadUrl: urlOrError });
              }
            } else {
              if (urlOrError === "The translation will take a few minutes") {
                resolveInner({ success: false, error: "translation_pending", message: urlOrError });
              } else {
                resolveInner({ success: false, error: urlOrError });
              }
            }
          }
        );
      });
    };

    let result = await attemptTranslation();

    if (result.success) {
      resolveOuter(result);
      return;
    }

    if (result.error === "translation_pending") {
      console.log(`Translation for '${videoUrl}' to '${responseLang}' is pending, will retry...`);
      const pollInterval = 30000;
      const maxAttempts = 20;
      let attemptCount = 0;

      const intervalId = setInterval(async () => {
        attemptCount++;
        console.log(`Polling for '${videoUrl}' (attempt ${attemptCount} of ${maxAttempts})...`);
        result = await attemptTranslation();
        if (result.success) {
          clearInterval(intervalId);
          console.log(`Translation for '${videoUrl}' succeeded after polling.`);
          resolveOuter(result);
        } else if (result.error !== "translation_pending" || attemptCount >= maxAttempts) {
          clearInterval(intervalId);
          const finalError = attemptCount >= maxAttempts && result.error === "translation_pending" ? "Translation timed out after several attempts." : result.error;
          console.error(`Translation for '${videoUrl}' failed after polling: ${finalError}`);
          resolveOuter({ success: false, error: finalError });
        }
      }, pollInterval);
    } else {
      resolveOuter(result);
    }
  });
}
