// TTS helpers. Currently holds only the pure data-URI -> blob-URL converter;
// the engine dispatch functions (speakWith*) still live in the content entry
// because they read shared playback state (ttsRate) and animation callbacks.

export function createBlobUrlFromDataUri(dataURI) {
  try {
    if (!dataURI.startsWith('data:')) return dataURI;
    const parts = dataURI.split(',');
    const byteString = atob(parts[1]);
    const mimeString = parts[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('Data URI to Blob URL failed:', e);
    return dataURI;
  }
}
