import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { LIMITS } from '../../../convex/permissions';

// Thrown with a message that is safe to show to the user.
export class MediaError extends Error {}

export interface PickedMedia {
  uri: string;
  mimeType: string;
}

// Lets the user choose a square image from their gallery, then shrinks it on
// the device so the upload is small. Returns null if they back out.
export async function pickSquareImage(size: number): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;

  const context = ImageManipulator.manipulate(result.assets[0].uri);
  context.resize({ width: size, height: size });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return { uri: saved.uri, mimeType: 'image/jpeg' };
}

function checkVideo(asset: ImagePicker.ImagePickerAsset): PickedMedia {
  const seconds = (asset.duration ?? 0) / 1000;
  if (seconds > LIMITS.videoSeconds + 1) {
    const over = Math.ceil(seconds - LIMITS.videoSeconds);
    throw new MediaError(
      `That clip is ${Math.round(seconds)} seconds long. Trim ${over} ${over === 1 ? 'second' : 'seconds'} to get under the ${LIMITS.videoSeconds}-second limit.`
    );
  }
  if (asset.fileSize && asset.fileSize > LIMITS.videoBytes) {
    const mb = Math.ceil(asset.fileSize / (1024 * 1024));
    const limit = LIMITS.videoBytes / (1024 * 1024);
    throw new MediaError(
      `That clip is ${mb} MB and the limit is ${limit} MB. Try a shorter clip or record it in the app.`
    );
  }
  return { uri: asset.uri, mimeType: asset.mimeType ?? 'video/mp4' };
}

// Records a proof video with the camera. Camera and microphone permission is
// asked for here, the first time it is needed. Returns null if cancelled.
export async function recordProofVideo(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new MediaError(
      'Enablr needs camera access to record a proof video. You can allow it in your phone settings, or choose a video from your gallery instead.'
    );
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: LIMITS.videoSeconds,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  return checkVideo(result.assets[0]);
}

export async function chooseProofVideo(): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: LIMITS.videoSeconds,
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
  });
  if (result.canceled || !result.assets[0]) return null;
  return checkVideo(result.assets[0]);
}

// Sends a file to a Convex upload URL and returns the storage ID to attach.
// The file is streamed from disk rather than loaded into memory.
export async function uploadToStorage(uploadUrl: string, media: PickedMedia): Promise<string> {
  const response = await FileSystem.uploadAsync(uploadUrl, media.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': media.mimeType },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new MediaError("The upload didn't finish. Check your connection and try again.");
  }
  const { storageId } = JSON.parse(response.body) as { storageId?: string };
  if (!storageId) {
    throw new MediaError("The upload didn't finish. Check your connection and try again.");
  }
  return storageId;
}
