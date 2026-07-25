import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export async function getDocument(collectionName, docId) {
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
}

export async function getCollection(collectionName) {
  try {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return null;
  }
}

export async function setDocument(collectionName, docId, data, merge = true) {
  await setDoc(doc(db, collectionName, docId), data, { merge });
  return true;
}

export async function updateDocument(collectionName, docId, data) {
  await updateDoc(doc(db, collectionName, docId), data);
  return true;
}

export async function addDocument(collectionName, data) {
  const ref = await addDoc(collection(db, collectionName), data);
  return ref.id;
}

export async function deleteDocument(collectionName, docId) {
  await deleteDoc(doc(db, collectionName, docId));
  return true;
}
