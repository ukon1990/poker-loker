import type { BotProfile } from '@/engine/bots/profile';
import type { TableTendencies } from '@/engine/bots/tendencies';
import type { CoachAdvice } from '@/engine/coach/coach';
import type { Action } from '@/engine/core/hand';
import type { HandView } from '@/engine/core/view';
import type { EngineRequest } from '@/engine/worker/engine.worker';

export interface TableEngine {
  decide(
    view: HandView,
    bot: BotProfile,
    seed: number,
    tendencies: TableTendencies,
  ): Promise<Action>;
  coach(view: HandView, seed: number): Promise<CoachAdvice>;
}

type EngineMessage =
  | Omit<Extract<EngineRequest, { kind: 'bot' }>, 'id'>
  | Omit<Extract<EngineRequest, { kind: 'coach' }>, 'id'>;

// One worker for the whole app. Equity simulation would otherwise stall the UI.
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (result: never) => void>();

function send<T>(request: EngineMessage): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('../../engine/worker/engine.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<{ id: number; result: never }>) => {
      pending.get(event.data.id)?.(event.data.result);
      pending.delete(event.data.id);
    };
  }

  const id = nextId++;
  return new Promise<T>((resolve) => {
    pending.set(id, resolve as (result: never) => void);
    worker?.postMessage({ ...request, id });
  });
}

export const workerEngine: TableEngine = {
  decide: (view, bot, seed, tendencies) => send({ kind: 'bot', view, bot, seed, tendencies }),
  coach: (view, seed) => send({ kind: 'coach', view, seed }),
};
