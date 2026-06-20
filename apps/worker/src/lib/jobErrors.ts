/**
 * Errori "di business": condizioni che nessun retry di BullMQ può risolvere
 * (la quota resta superata, il file resta privo di audio/non valido). I
 * processor catturano queste eccezioni per evitare di sprecare i tentativi
 * configurati sulle code (`attempts: 3` + backoff esponenziale, vedi
 * `apps/api/src/lib/queues.ts`), a differenza degli errori tecnici o
 * transitori (rete, ffmpeg crashato, provider AI irraggiungibile) che invece
 * vogliono essere rilanciati perché un retry può davvero risolverli.
 *
 * Centralizzata qui (invece che duplicata in ogni processor) perché sia
 * `videoProcessing.ts` sia `clipExport.ts` condividono lo stesso pattern:
 * try { ... } catch (err) { marca FAILED; if (err instanceof
 * NonRetryableJobError) return; throw err; }
 */
export class NonRetryableJobError extends Error {}

/** La quota del piano (minuti o clip) è stata superata. */
export class QuotaExceededError extends NonRetryableJobError {}

/** Il file sorgente non è processabile (manca l'audio, dimensioni non valide, nessun candidato/risultato utile). */
export class UnprocessableMediaError extends NonRetryableJobError {}
