import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type UserProfilePatch = {
  schoolId?: string;
  dormId?: string;
  floor?: number;
};

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

export async function upsertUserProfile(uid: string, patch: UserProfilePatch): Promise<void> {
  const sanitizedPatch = omitUndefined(patch);
  await setDoc(
    doc(db, 'users', uid),
    {
      ...sanitizedPatch,
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );
}
