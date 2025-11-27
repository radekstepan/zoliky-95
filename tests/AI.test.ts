import { describe, it, expect } from 'vitest';
import { calculateCpuMove } from '../src/core/ai';
import { Card } from '../src/core/Card';

describe('AI Strategy Logic', () => {
    
    describe('Meld Detection', () => {
        it('should find Set of 3', () => {
            const hand = [new Card('♥', '5', 1), new Card('♦', '5', 2), new Card('♣', '5', 3)];
            const move = calculateCpuMove(hand, true, []);
            expect(move.meldsToPlay.length).toBe(1);
        });

        it('should find Set of 4', () => {
            const hand = [
                new Card('♥', '5', 1), new Card('♦', '5', 2), 
                new Card('♣', '5', 3), new Card('♠', '5', 4)
            ];
            const move = calculateCpuMove(hand, true, []);
            expect(move.meldsToPlay.length).toBe(1);
            expect(move.meldsToPlay[0].length).toBe(4);
        });

        it('should find Run of 3', () => {
             const hand = [new Card('♥', '5', 1), new Card('♥', '6', 2), new Card('♥', '7', 3)];
             const move = calculateCpuMove(hand, true, []);
             expect(move.meldsToPlay.length).toBe(1);
        });

        it('should find Run with Joker (Gap)', () => {
             const hand = [new Card('♥', '5', 1), new Card('JK', 'Joker', 2), new Card('♥', '7', 3)];
             const move = calculateCpuMove(hand, true, []);
             expect(move.meldsToPlay.length).toBe(1);
        });
    });

    describe('Difficulty Behaviors', () => {
        it('should discard random card on Easy', () => {
            const hand = [new Card('♥', '2', 1), new Card('♠', 'K', 2)];
            // Easy discards random. Difficult to deterministically test randomness without mocking Math.random.
            // But we can ensure it returns a card.
            const move = calculateCpuMove(hand, true, [], 'easy');
            expect(move.discardCard).toBeDefined();
        });

        it('should discard highest value on Medium', () => {
            const hand = [new Card('♥', '2', 1), new Card('♠', 'K', 2)]; // K is 10, 2 is 2.
            const move = calculateCpuMove(hand, true, [], 'medium');
            expect(move.discardCard?.rank).toBe('K');
        });

        it('should swap Jokers on Hard', () => {
            const tableMeld = [new Card('♥', '4', 1), new Card('♦', '4', 2), new Card('♣', '4', 3), new Card('JK', 'Joker', 4)];
            const hand = [new Card('♠', '4', 10)];
            const move = calculateCpuMove(hand, true, [tableMeld], 'hard');
            expect(move.jokerSwaps.length).toBe(1);
        });
    });
    
    describe('Opening Constraints', () => {
         it('should not play meld if < 36 points and not opened', () => {
              const hand = [new Card('♥', '2', 1), new Card('♥', '3', 2), new Card('♥', '4', 3)]; // 9 points
              const move = calculateCpuMove(hand, false, []);
              expect(move.meldsToPlay.length).toBe(0);
         });

         it('should play meld if > 36 points and Pure Run exists', () => {
              const hand = [
                  new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('♥', 'A', 3), // 30pts Pure
                  new Card('♠', 'K', 4), new Card('♦', 'K', 5), new Card('♣', 'K', 6)  // 30pts Set
              ];
              const move = calculateCpuMove(hand, false, []);
              expect(move.meldsToPlay.length).toBeGreaterThan(0);
         });
    });
});
