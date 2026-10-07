import { Alert } from 'react-native';
import { convex } from '../convex/convexClient';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useGuildFeedbackStore } from '../../stores/guildFeedbackStore';
import { requestSync } from '../sync/syncTrigger';
import { errorMessage } from '../../utils/errors';
import { toDayKey } from '../../utils/schedule';
import {
  MediaError,
  PickedMedia,
  chooseProofVideo,
  recordProofVideo,
  uploadToStorage,
} from '../media/upload';

export interface SubmittableTask {
  _id: Id<'guildTasks'>;
  name: string;
  proofVideoRequired: boolean;
}

type Choice = 'record' | 'choose' | 'cancel';

function ask<T extends string>(
  title: string,
  message: string,
  options: { text: string; value: T; style?: 'cancel' | 'destructive' }[]
): Promise<T> {
  return new Promise((resolve) => {
    const cancel = options.find((o) => o.style === 'cancel');
    Alert.alert(
      title,
      message,
      options.map((o) => ({ text: o.text, style: o.style, onPress: () => resolve(o.value) })),
      { cancelable: true, onDismiss: () => resolve((cancel ?? options[0]).value) }
    );
  });
}

// Capture sheet: record or choose a clip, then confirm it or go again.
async function captureProof(taskName: string): Promise<PickedMedia | null> {
  for (;;) {
    const source = await ask<Choice>('Proof video', `"${taskName}" needs a video of up to 60 seconds.`, [
      { text: 'Record video', value: 'record' },
      { text: 'Choose from gallery', value: 'choose' },
      { text: 'Cancel', value: 'cancel', style: 'cancel' },
    ]);
    if (source === 'cancel') return null;

    const media = source === 'record' ? await recordProofVideo() : await chooseProofVideo();
    if (!media) continue;

    const confirm = await ask<'submit' | 'retake' | 'cancel'>(
      'Send this video?',
      'Only you and the guild members who review submissions will be able to watch it.',
      [
        { text: 'Submit', value: 'submit' },
        { text: 'Pick another', value: 'retake' },
        { text: 'Cancel', value: 'cancel', style: 'cancel' },
      ]
    );
    if (confirm === 'submit') return media;
    if (confirm === 'cancel') return null;
  }
}

// Completes a guild task: captures and uploads a proof video if the task asks
// for one, submits it, and reports the outcome through the feedback store.
export async function submitGuildTask(task: SubmittableTask): Promise<void> {
  const feedback = useGuildFeedbackStore.getState();
  if (feedback.busyTaskIds.includes(task._id)) return;

  try {
    let videoId: Id<'_storage'> | undefined;
    if (task.proofVideoRequired) {
      const media = await captureProof(task.name);
      if (!media) return;
      feedback.setTaskBusy(task._id, true);
      const uploadUrl = await convex.mutation(api.guildTasks.generateProofUploadUrl, {
        taskId: task._id,
      });
      videoId = (await uploadToStorage(uploadUrl, media)) as Id<'_storage'>;
    }

    feedback.setTaskBusy(task._id, true);
    const result = await convex.mutation(api.guildTasks.submit, {
      taskId: task._id,
      today: toDayKey(new Date()),
      videoId,
    });

    if (result.status === 'approved') {
      feedback.showToast(`+${result.xpAwarded} XP in ${result.guildName}`);
      if (result.leveledUp) feedback.showLevelUp(result.guildName, result.newLevel);
      // Guild badges are granted by the server; fetch any that were just earned
      requestSync();
    } else {
      feedback.showToast('Sent for review. XP arrives once a reviewer approves it.', 'info');
    }
  } catch (error) {
    feedback.showToast(error instanceof MediaError ? error.message : errorMessage(error), 'error');
  } finally {
    feedback.setTaskBusy(task._id, false);
  }
}
