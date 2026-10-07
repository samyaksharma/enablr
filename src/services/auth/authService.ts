import { getDatabase } from '../../db/database';
import { userRepository } from '../../db/repositories/userRepository';
import { CharacterClass, User } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useHabitStore } from '../../stores/habitStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSyncStore } from '../../stores/syncStore';
import { useGuildFeedbackStore } from '../../stores/guildFeedbackStore';
import { getLevelForXp } from '../rpg/levelCalculator';
import { syncService } from '../sync/syncService';
import { localNotifications } from '../notifications/localNotifications';

// Auth actions (signIn/signUp/signOut) are performed via Convex Auth hooks
// in calling components. This service handles local SQLite user management.

type ConvexSignIn = (provider: string, params: Record<string, string>) => Promise<void>;
type ConvexSignOut = () => Promise<void>;

// The account record as stored on the server.
export interface RemoteAccount {
  id: string;
  name?: string;
  email?: string;
  characterName?: string;
  characterClass?: string;
  xp?: number;
}

function toCharacterClass(value?: string): CharacterClass {
  return Object.values(CharacterClass).includes(value as CharacterClass)
    ? (value as CharacterClass)
    : CharacterClass.Warrior;
}

export const authService = {
  async signUpWithEmail(
    signIn: ConvexSignIn,
    email: string,
    password: string
  ): Promise<void> {
    await signIn("password", { email, password, flow: "signUp" });
  },

  async signInWithEmail(
    signIn: ConvexSignIn,
    email: string,
    password: string
  ): Promise<void> {
    await signIn("password", { email, password, flow: "signIn" });
  },

  async signInWithGoogle(signIn: ConvexSignIn): Promise<void> {
    await signIn("google", {});
  },

  async signOut(doSignOut: ConvexSignOut): Promise<void> {
    await doSignOut();
    this.clearLocalSession();
  },

  // Drops everything held in memory for the signed-in account so the next
  // account to sign in on this device starts from its own data.
  clearLocalSession(): void {
    useAuthStore.getState().clearUser();
    useHabitStore.getState().reset();
    useProgressionStore.getState().reset();
    useSyncStore.getState().reset();
    useGuildFeedbackStore.getState().reset();
    localNotifications.cancelAll();
  },

  // Returns the local row for this account, restoring the character and XP
  // from the server when this device doesn't have them yet (reinstall, new phone).
  async ensureLocalUser(account: RemoteAccount): Promise<User> {
    const db = await getDatabase();
    const remoteXp = account.xp ?? 0;
    let user = await userRepository.getById(db, account.id);

    if (!user) {
      return await userRepository.create(db, {
        id: account.id,
        name: account.name ?? account.email ?? 'Adventurer',
        characterName: account.characterName ?? '',
        characterClass: toCharacterClass(account.characterClass),
        xp: remoteXp,
        level: getLevelForXp(remoteXp),
      });
    }

    if (!user.characterName && account.characterName) {
      await userRepository.updateCharacter(
        db,
        user.id,
        account.characterName,
        toCharacterClass(account.characterClass)
      );
    }
    // XP only ever goes up, so the higher total is the more recent one.
    if (remoteXp > user.xp) {
      await userRepository.updateXpAndLevel(db, user.id, remoteXp, getLevelForXp(remoteXp));
    }

    user = await userRepository.getById(db, account.id);
    return user!;
  },

  async updateCharacter(
    userId: string,
    characterName: string,
    characterClass: CharacterClass
  ): Promise<void> {
    const db = await getDatabase();
    await userRepository.updateCharacter(db, userId, characterName, characterClass);

    const user = await userRepository.getById(db, userId);
    if (user) {
      useAuthStore.getState().setUser(user);
    }

    // Save the new character to the server straight away
    syncService.runSync();
  },
};
