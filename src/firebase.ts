import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom DB ID if present
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Document ID for portfolio config
const CONFIG_DOC_PATH = "portfolio/config";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Loads the portfolio configuration from Firestore cloud database.
 */
export async function loadPortfolioFromCloud(): Promise<any> {
  try {
    const docRef = doc(db, ...CONFIG_DOC_PATH.split("/") as [string, string]);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      handleFirestoreError(error, OperationType.GET, CONFIG_DOC_PATH);
    }
    console.warn("Could not load database document, falling back:", error);
  }
  return null;
}

/**
 * Saves the portfolio configuration to Firestore cloud database.
 */
export async function savePortfolioToCloud(data: any): Promise<boolean> {
  try {
    const docRef = doc(db, ...CONFIG_DOC_PATH.split("/") as [string, string]);
    // Copy the data to ensure we do not save undefined fields
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(docRef, cleanData);
    return true;
  } catch (error) {
    console.error("Error saving to Firestore cloud database:", error);
    handleFirestoreError(error, OperationType.WRITE, CONFIG_DOC_PATH);
  }
}

/**
 * Uploads a file to Firebase Storage and returns the public download URL.
 * Supports progress indication and logs.
 * @param file The file to upload (Image or Video)
 * @param path The storage path (e.g., 'works/image_xyz.png')
 */
export async function uploadFileToCloud(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}
