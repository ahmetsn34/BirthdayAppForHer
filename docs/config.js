// YouTube bağlantısını buradaki tırnakların arasına yapıştır.
// Örnek biçim: https://www.youtube.com/watch?v=VIDEO_ID
// Boş kaldığında Takodachi küçük bir sürpriz mesajı gösterir.
export const EASTER_EGG_YOUTUBE_URL = "";

export function getEasterEggYouTubeUrl(value = EASTER_EGG_YOUTUBE_URL) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const hosts = [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
      "youtu.be",
    ];
    return url.protocol === "https:" && hosts.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
