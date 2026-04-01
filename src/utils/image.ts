/**
 * Resizes and compresses a base64 image string.
 * @param base64Str The base64 image string.
 * @param maxWidth The maximum width of the image.
 * @param maxHeight The maximum height of the image.
 * @param quality The quality of the compressed JPEG (0 to 1).
 * @returns A promise that resolves to the resized and compressed base64 JPEG string.
 */
export const resizeAndCompressImage = (
  base64Str: string,
  maxWidth: number = 512,
  maxHeight: number = 512,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };
    img.onerror = (err) => reject(err);
  });
};
