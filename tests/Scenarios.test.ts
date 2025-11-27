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

        it('should NOT allow swapping from Set of 3 (Leaving only 2 suits + replacement)', () => {
            // Rule: "You cannot take a Joker from a Set of 3 if it leaves only 3 suits on the table."
            // Implicitly means you need to form a set of 4 suits to take the joker out? 
            // Or rather, if table is 4H, 4D, Joker. (3 cards). Joker represents 4C. 
            // I swap with 4C. Table becomes 4H, 4D, 4C. Valid set of 3.
            // Wait, RULES.md said: "You cannot take a Joker from a Set of 3 if it leaves only 3 suits on the table."
            // This usually means the joker was the 4th card, or the constraint prevents reducing a Set of 3 (inc joker) -> Set of 3 (no joker).
            // Actually, usually you can only take joker if the *Joker placement* completed a set of 4?
            // Let's check code implementation in MeldActions: 
            // "Can only swap Joker from a complete Set (4 cards)."
            
            game.hasOpened.human = true;
            const meld = [new Card('♥', '4', 1), new Card('♦', '4', 2), new Card('JK', 'Joker', 3)];
            game.melds.push(organizeMeld(meld));
            
            // Representation is 4♣ or 4♠. Let's say 4♣.
            const rep = game.melds[0].find(c => c.isJoker)!.representation!;
            
            game.pHand.push(new Card(rep.suit, rep.rank, 10));
            
            const res = game.attemptJokerSwap(0, 10);
            expect(res.success).toBe(false);
            expect(res.msg).toContain('complete Set');
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
