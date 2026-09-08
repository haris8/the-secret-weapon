import { horizons, type Task } from './tasks';
export function validateTask(value: unknown): Task {
  if (!value || typeof value !== 'object') throw new Error('Enter a valid action.');
  const t = value as Record<string, unknown>;
  const str = (key: string, max: number, required = false) => { const v = t[key]; if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`Please check ${key}.`); return required ? v.trim() : v; };
  const tags = (key: string) => { const v = t[key]; if (!Array.isArray(v) || v.length > 20 || v.some(x => typeof x !== 'string' || !x.trim() || x.length > 80)) throw new Error(`Use up to 20 ${key} tags, each under 80 characters.`); return [...new Set((v as string[]).map(x => x.trim()))]; };
  if (!horizons.includes(t.horizon as Task['horizon'])) throw new Error('Choose a valid When.');
  if (!Number.isInteger(t.minutes) || (t.minutes as number) < 0 || (t.minutes as number) > 1440) throw new Error('Duration must be between 0 and 1440 minutes.');
  if (!Number.isInteger(t.version) || (t.version as number) < 1) throw new Error('Refresh this action before saving.');
  if (typeof t.completed !== 'boolean' || (t.deleted !== undefined && typeof t.deleted !== 'boolean')) throw new Error('Invalid action status.');
  const due = str('due', 10); if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || new Date(due).toISOString().slice(0, 10) !== due)) throw new Error('Choose a valid date.');
  const energy = str('energy', 10); if (!['', 'low', 'medium', 'high'].includes(energy)) throw new Error('Choose a valid energy level.');
  return { id: str('id', 100, true), title: str('title', 300, true), notes: str('notes', 50000), horizon: t.horizon as Task['horizon'], project: str('project', 80).trim(), people: tags('people'), places: tags('places'), due, minutes: t.minutes as number, energy, completed: t.completed, deleted: t.deleted === true, createdAt: str('createdAt', 40), updatedAt: str('updatedAt', 40), version: t.version as number };
}
