import { collection, doc, type Firestore } from 'firebase/firestore';

export const householdRef = (db: Firestore, code: string) => doc(db, 'households', code);
export const placesCol = (db: Firestore, code: string) => collection(db, 'households', code, 'places');
export const itemsCol = (db: Firestore, code: string) => collection(db, 'households', code, 'items');
