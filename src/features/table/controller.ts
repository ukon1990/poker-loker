import { AsyncDebouncer } from '@tanstack/react-pacer';
import { createStore } from '@tanstack/react-store';
import type { HandRecord, PlaySession } from '@/db/schema';
import { recordTendencies, type TableTendencies } from '@/engine/bots/tendencies';
import type { CoachAdvice } from '@/engine/coach/coach';
import { type Action, applyAction } from '@/engine/core/hand';
import { deriveSeed } from '@/engine/core/rng';
import { dealNextHand, rebuy, settleHand, type TableState } from '@/engine/core/table';
import { viewFor } from '@/engine/core/view';
import type { TableEngine } from '@/features/table/engine-client';
import { HERO_SEAT, seatNames } from '@/features/table/session';

export interface TableUi {
  table: TableState;
  tendencies: TableTendencies;
  advice: CoachAdvice | null;
  /** The bot currently deciding. */
  thinking: number | null;
}

export interface TableDeps {
  engine: TableEngine;
  save(session: PlaySession): Promise<void>;
  recordHand(record: HandRecord): Promise<void>;
  isCoachVisible(): boolean;
  /** Time a bot appears to think, so the table can be followed. */
  pause(): Promise<void>;
  now?(): number;
}

const SAVE_DELAY_MS = 400;

/** Runs a table: deals, asks bots to act, waits for the player, and saves as it goes. */
export class TableController {
  readonly store;
  private session: PlaySession;
  private readonly deps: TableDeps;
  private readonly saver: AsyncDebouncer<(session: PlaySession) => Promise<void>>;
  // Each run of the loop takes a token, so a stale run stops after any await.
  private runToken = 0;
  private decisions = { total: 0, agreed: 0 };

  constructor(session: PlaySession, deps: TableDeps) {
    this.session = session;
    this.deps = deps;
    this.saver = new AsyncDebouncer(deps.save, { wait: SAVE_DELAY_MS });
    this.store = createStore<TableUi>({
      table: session.engineState.table,
      tendencies: session.engineState.tendencies,
      advice: null,
      thinking: null,
    });
  }

  private get state(): TableUi {
    return this.store.get();
  }

  private patch(update: Partial<TableUi>): void {
    this.store.setState((previous) => ({ ...previous, ...update }));
  }

  private persist(handsPlayed = this.session.handsPlayed): void {
    const { table, tendencies } = this.state;
    this.session = {
      ...this.session,
      handsPlayed,
      updatedAt: this.deps.now?.() ?? Date.now(),
      engineState: { table, tendencies },
    };
    void this.saver.maybeExecute(this.session);
  }

  start(): void {
    if (!this.state.table.hand) {
      this.nextHand();
      return;
    }
    void this.run();
  }

  dispose(): void {
    this.runToken += 1;
    void this.saver.flush();
  }

  /** Deals the next hand. Anyone out of chips buys back in, as rebuys are allowed. */
  nextHand(): void {
    let table = settleHand(this.state.table);
    for (const seat of table.seats) {
      if (seat.stack === 0) table = rebuy(table, seat.seat);
    }
    const dealt = dealNextHand(table);
    if (!dealt) return;

    this.decisions = { total: 0, agreed: 0 };
    this.patch({ table: dealt, advice: null, thinking: null });
    this.persist();
    void this.run();
  }

  act(action: Action): void {
    const { table, advice } = this.state;
    const hand = table.hand;
    if (!hand || hand.toAct !== HERO_SEAT) return;

    // Only unaided decisions say anything about the player's own judgment.
    if (advice && !this.deps.isCoachVisible()) {
      this.decisions.total += 1;
      if (advice.recommendation === action.type) this.decisions.agreed += 1;
    }

    const next = applyAction(hand, action).state;
    this.patch({ table: { ...table, hand: next }, advice: null });
    this.persist();
    if (next.result) void this.finishHand();
    else void this.run();
  }

  private async run(): Promise<void> {
    this.runToken += 1;
    const token = this.runToken;

    while (token === this.runToken) {
      const { table, tendencies } = this.state;
      const hand = table.hand;
      if (!hand) return;
      if (hand.result) return;

      const seat = hand.toAct;
      if (seat === null) return;

      if (seat === HERO_SEAT) {
        this.patch({ thinking: null });
        const advice = await this.deps.engine.coach(
          viewFor(hand, HERO_SEAT),
          deriveSeed(hand.seed, hand.events.length, 0x636f),
        );
        if (token === this.runToken) this.patch({ advice });
        return;
      }

      this.patch({ thinking: seat });
      const [action] = await Promise.all([
        this.deps.engine.decide(
          viewFor(hand, seat),
          this.session.config.bots[seat - 1],
          deriveSeed(hand.seed, hand.events.length, seat),
          tendencies,
        ),
        this.deps.pause(),
      ]);
      if (token !== this.runToken) return;

      const next = applyAction(hand, action).state;
      this.patch({ table: { ...table, hand: next }, thinking: null });
      this.persist();
      if (next.result) await this.finishHand();
    }
  }

  private async finishHand(): Promise<void> {
    const { table, tendencies } = this.state;
    const hand = table.hand;
    if (!hand?.result) return;

    const updated = recordTendencies(
      tendencies,
      hand.players.map((player) => player.seat),
      hand.events,
    );
    this.patch({ tendencies: updated });
    this.persist(this.session.handsPlayed + 1);

    await this.deps.recordHand({
      id: `${this.session.id}-${table.handNumber}`,
      sessionId: this.session.id,
      variantId: table.variantId,
      playedAt: this.deps.now?.() ?? Date.now(),
      seed: hand.seed,
      events: hand.events,
      handNumber: table.handNumber,
      heroNet: hand.result.net.find((entry) => entry.seat === HERO_SEAT)?.amount ?? 0,
      heroHole: hand.players.find((player) => player.seat === HERO_SEAT)?.hole ?? [],
      board: hand.board,
      names: seatNames(this.session),
      decisions: this.decisions,
    });
  }
}
