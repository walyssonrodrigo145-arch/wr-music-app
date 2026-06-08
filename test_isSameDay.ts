import { isSameDay } from 'date-fns';

try {
  const result = isSameDay(new Date(undefined as any), new Date());
  console.log('isSameDay returned:', result);
} catch (e: any) {
  console.error('isSameDay THREW an error:', e.message);
}
