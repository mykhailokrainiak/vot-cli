// src/vot-cli-lib.js
import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import translateVideo from "./translateVideo.js";

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
