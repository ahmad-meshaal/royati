import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Uploads a base64 image string to Firebase Storage and returns the download URL.
 * @param base64Data The base64 image string (with or without the data:image/png;base64, prefix).
 * @param path The storage path (e.g., 'avatars/uid.png' or 'covers/novelId.png').
 * @returns The download URL of the uploaded image.
 */
export const uploadBase64Image = async (base64Data: string, path: string): Promise<string> => {
  try {
    // Remove the prefix if it exists
    const base64Content = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;

    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Content, 'base64', {
      contentType: 'image/png',
    });

    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    throw error;
  }
};
