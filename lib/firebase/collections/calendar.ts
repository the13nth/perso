import { db } from '../config';
import { collection, doc, setDoc, getDoc, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { CalendarIntegration, CalendarEvent } from '../../../types/calendar';

// Collection references
const calendarIntegrationsCollection = collection(db, 'calendarIntegrations');
const calendarEventsCollection = collection(db, 'calendarEvents');

// Calendar Integration Functions
export async function saveCalendarIntegration(userId: string, integration: Omit<CalendarIntegration, 'userId'>) {
  const docRef = doc(calendarIntegrationsCollection, userId);
  await setDoc(docRef, {
    ...integration,
    userId,
    lastSync: integration.lastSync || null,
    tokenExpiry: integration.tokenExpiry instanceof Date ? integration.tokenExpiry.toISOString() : integration.tokenExpiry,
  });
}

export async function getCalendarIntegration(userId: string): Promise<CalendarIntegration | null> {
  const docRef = doc(calendarIntegrationsCollection, userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    ...data,
    tokenExpiry: new Date(data.tokenExpiry),
    lastSync: data.lastSync ? new Date(data.lastSync) : null,
  } as CalendarIntegration;
}

export async function updateCalendarIntegration(
  userId: string,
  update: Partial<Omit<CalendarIntegration, 'userId'>>
) {
  const docRef = doc(calendarIntegrationsCollection, userId);
  const updateData = { ...update };
  
  if (update.tokenExpiry) {
    updateData.tokenExpiry = update.tokenExpiry instanceof Date ? update.tokenExpiry.toISOString() : update.tokenExpiry;
  }
  if (update.lastSync) {
    updateData.lastSync = update.lastSync instanceof Date ? update.lastSync.toISOString() : update.lastSync;
  }
  
  await updateDoc(docRef, updateData);
}

// Calendar Events Functions
export async function saveCalendarEvent(event: CalendarEvent) {
  const docRef = doc(calendarEventsCollection, event.id);
  await setDoc(docRef, {
    ...event,
    startTime: event.startTime instanceof Date ? event.startTime.toISOString() : event.startTime,
    endTime: event.endTime instanceof Date ? event.endTime.toISOString() : event.endTime,
    lastUpdated: event.lastUpdated instanceof Date ? event.lastUpdated.toISOString() : event.lastUpdated,
  });
}

export async function getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
  const q = query(calendarEventsCollection, where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      lastUpdated: new Date(data.lastUpdated),
    } as CalendarEvent;
  });
}

export async function batchSaveCalendarEvents(events: CalendarEvent[]) {
  // Using Promise.all for parallel writes
  await Promise.all(
    events.map(event => saveCalendarEvent(event))
  );
}

// Utility function to clean up old events
export async function deleteOldEvents(userId: string, beforeDate: Date) {
  const q = query(
    calendarEventsCollection,
    where('userId', '==', userId),
    where('endTime', '<=', beforeDate.toISOString())
  );
  
  const querySnapshot = await getDocs(q);
  await Promise.all(
    querySnapshot.docs.map(doc => deleteDoc(doc.ref))
  );
} 