import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';
import { organizeMeld } from '../src/core/rules';

describe('Gameplay Scenarios', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
        game.round = 3;
        game.phase = 'action';
        game.pHand = []; // Clear hand for manual setup
    });

    describe('Opening Requirements', () => {
        it('should NOT open with < 36 points', () => {
            // Pure Run (A,2,3) = 6 pts
            const run = [new Card('♥', 'A', 1), new Card('♥', '2', 2), new Card('♥', '3', 3)];
            game.pHand.push(...run);

            game.attemptMeld(run);

            // Attempt to finish turn (discard)
            game.pHand.push(new Card('♠', 'K', 99));
            const res = game.attemptDiscard(99);

            expect(res.success).toBe(false);
            expect(res.msg).toContain('36+');
        });

        it('should NOT open without a Pure Run', () => {
            // Impure Run (High points)
            const impure = [new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('JK', 'Joker', 3)];
            // Set (High points)
            const set = [new Card('♠', 'K', 4), new Card('♣', 'K', 5), new Card('♦', 'K', 6)];

            game.pHand.push(...impure, ...set);
            game.attemptMeld(impure);
            game.attemptMeld(set);

            game.pHand.push(new Card('♠', '2', 99));
            const res = game.attemptDiscard(99);

            expect(res.success).toBe(false);
            expect(res.msg).toContain('Pure Run');
        });

        it('should Open successfully when requirements met', () => {
            // Pure Run (30pts) + Set (6pts) = 36pts
            const run = [new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('♥', 'A', 3)];
            const set = [new Card('♠', '2', 4), new Card('♣', '2', 5), new Card('♦', '2', 6)];

            game.pHand.push(...run, ...set);
            game.attemptMeld(run);
            game.attemptMeld(set);

            game.pHand.push(new Card('♠', '9', 99));
            const res = game.attemptDiscard(99);

            expect(res.success).toBe(true);
            expect(game.hasOpened.human).toBe(true);
        });
    });

    describe('Joker Swapping', () => {
        it('should NOT allow swapping if not opened', () => {
            game.hasOpened.human = false;
            // Setup table meld
            const meld = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('JK', 'Joker', 3)];
            game.melds.push(organizeMeld(meld));

            // Hand has 6H
            game.pHand.push(new Card('♥', '6', 10));

            const res = game.attemptJokerSwap(0, 10);
            expect(res.success).toBe(false);
            expect(res.msg).toContain('Must open');
        });

        it('should NOT allow swapping from Set of 3 with Joker', () => {
            game.hasOpened.human = true;
            // Set of 3: 4♥, 4♦, Joker (representing 4♣ or 4♠)
            const meld = [new Card('♥', '4', 1), new Card('♦', '4', 2), new Card('JK', 'Joker', 3)];
            game.melds.push(organizeMeld(meld));

            // Get the joker's representation
            const rep = game.melds[0].find(c => c.isJoker)!.representation!;

            // Hand has the card the joker represents
            game.pHand.push(new Card(rep.suit, rep.rank, 10));

            const res = game.attemptJokerSwap(0, 10);
            expect(res.success).toBe(false);
            expect(res.msg).toContain('complete Set');
        });

        it('should allow swapping from Set of 4 with Joker', () => {
            game.hasOpened.human = true;
            // Set of 4: 4♥, 4♦, 4♣, Joker (representing 4♠)
            const meld = [
                new Card('♥', '4', 1),
                new Card('♦', '4', 2),
                new Card('♣', '4', 3),
                new Card('JK', 'Joker', 4)
            ];
            game.melds.push(organizeMeld(meld));

            // Get the joker's representation
            const rep = game.melds[0].find(c => c.isJoker)!.representation!;

            // Hand has the card the joker represents
            game.pHand.push(new Card(rep.suit, rep.rank, 10));

            const res = game.attemptJokerSwap(0, 10);
            expect(res.success).toBe(true);
            expect(game.pHand.some(c => c.isJoker)).toBe(true);
        });

        it('should allow swapping from Run with Joker', () => {
            game.hasOpened.human = true;
            // Run: 4♥, 5♥, Joker (representing 6♥)
            const meld = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('JK', 'Joker', 3)];
            game.melds.push(organizeMeld(meld));

            // Get the joker's representation
            const rep = game.melds[0].find(c => c.isJoker)!.representation!;
            expect(rep.rank).toBe('6');
            expect(rep.suit).toBe('♥');

            // Hand has 6♥
            game.pHand.push(new Card('♥', '6', 10));

            const res = game.attemptJokerSwap(0, 10);
            expect(res.success).toBe(true);
            expect(game.pHand.some(c => c.isJoker)).toBe(true);
        });
    });

    describe('Winning Conditions', () => {
        it('should win when discarding last card after opening', () => {
            game.hasOpened.human = true;
            game.pHand = [new Card('♥', 'K', 1)];

            const res = game.attemptDiscard(1);
            expect(res.success).toBe(true);
            expect(res.winner).toBe('Human');
        });

        it('should fail to win if requirements not met', () => {
            game.hasOpened.human = false;
            game.pHand = [new Card('♥', 'K', 1)];

            const res = game.attemptDiscard(1);
            expect(res.success).toBe(false);
            expect(res.winner).toBeUndefined();
        });
    });

    describe('Jolly Hand', () => {
        it('should execute Jolly Hand successfully', () => {
            // Setup condition: Round 3, Not Opened, 12 Cards
            game.round = 3;
            game.hasOpened.human = false;
            game.phase = 'draw';
            game.pHand = Array(12).fill(null).map((_, i) => new Card('♠', '2', i + 100));
            game.bottomCard = new Card('♥', 'A', 999);

            const res = game.attemptJollyHand();
            expect(res.success).toBe(true);
            expect(game.pHand.length).toBe(13);
            expect(game.isJollyTurn).toBe(true);
        });

        it('should fail Jolly Hand if user already opened', () => {
            game.hasOpened.human = true;
            game.phase = 'draw';
            game.pHand = Array(12).fill(null).map((_, i) => new Card('♠', '2', i));
            game.bottomCard = new Card('♥', 'A', 999);

            const res = game.attemptJollyHand();
            expect(res.success).toBe(false);
        });
    });
});
