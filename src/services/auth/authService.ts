import { getDatabase } from '../../db/database';
import { userRepository } from '../../db/repositories/userRepository';
import { CharacterClass, User } from '../../types';
import { useAuthStore } from '../../stores/authStore';

// Auth actions (signIn/signUp/signOut) are performed via Convex Auth hooks
// in calling components. This service handles local SQLite user management.

type ConvexSignIn = (provider: string, params: Record<string, string>) => Promise<void>;
type ConvexSignOut = () => Promise<void>;

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
    useAuthStore.getState().clearUser();
  },

  async ensureLocalUser(convexUserId: string, displayName?: string, email?: string): Promise<User> {
    const db = await getDatabase();
    let user = await userRepository.getById(db, convexUserId);

    if (!user) {
      user = await userRepository.create(db, {
        id: convexUserId,
        name: displayName ?? email ?? 'Adventurer',
        characterName: '',
        characterClass: CharacterClass.Warrior,
      });
    }

    return user;
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
  },
};
