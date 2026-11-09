import { decideBot } from '@/engine/bots/decide';
import type { BotProfile } from '@/engine/bots/profile';
import type { TableTendencies } from '@/engine/bots/tendencies';
import { coachAdvice } from '@/engine/coach/coach';
import { createRng } from '@/engine/core/rng';
import type { HandView } from '@/engine/core/view';

export type EngineRequest =
  | {
      id: number;
      kind: 'bot';
      view: HandView;
      bot: BotProfile;
      seed: number;
      tendencies: TableTendencies;
    }
  | { id: number; kind: 'coach'; view: HandView; seed: number };

self.onmessage = (event: MessageEvent<EngineRequest>) => {
  const request = event.data;
  const rng = createRng(request.seed);
  const result =
    request.kind === 'bot'
      ? decideBot(request.view, request.bot, rng, { tendencies: request.tendencies })
      : coachAdvice(request.view, rng);
  self.postMessage({ id: request.id, result });
};
