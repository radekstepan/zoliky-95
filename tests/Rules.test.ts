import { describe, it, expect } from 'vitest';
import { validateMeld, sortHandLogic } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Jolly Rules', () => {
    
    describe('Sorting Logic', () => {
        it('should sort suits in Red-Black-Red-Black order', () => {
            const hand = [
                new Card('♣', '5', 1),
                new Card('♦', '5', 2),
                new Card('♠', '5', 3),
                new Card('♥', '5', 4)
            ];
            sortHandLogic(hand);
            expect(hand[0].suit).toBe('♥');
            expect(hand[1].suit).toBe('♠');
            expect(hand[2].suit).toBe('♦');
            expect(hand[3].suit).toBe('♣');
        });
    });

    describe('Scoring Logic', () => {
        it('should score Joker dynamically in runs', () => {
            // 4, 5, JK. Joker -> 6.
            // 4+5+6 = 15
            const run = [
                new Card('♥', '4', 1),
                new Card('♥', '5', 2),
                new Card('JK', 'Joker', 3)
            ];
            const res = validateMeld(run);
            expect(res.valid).toBe(true);
            expect(res.type).toBe('run');
            expect(res.points).toBe(15);
        });

        it('should score Joker dynamically in middle of runs', () => {
            // 7, JK, 9. Joker -> 8.
            // 7+8+9 = 24
            const run = [
                new Card('♣', '7', 1),
                new Card('JK', 'Joker', 2),
                new Card('♣', '9', 3)
            ];
            const res = validateMeld(run);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(24);
        });

        it('should score Ace as 1 in Low Run', () => {
            // A, 2, 3 -> 1+2+3 = 6
            const run = [
                new Card('♦', 'A', 1),
                new Card('♦', '2', 2),
                new Card('♦', '3', 3)
            ];
            const res = validateMeld(run);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(6);
        });

        it('should score Ace as 10 in High Run', () => {
            // Q, K, A -> 10+10+10 = 30
            const run = [
                new Card('♦', 'Q', 1),
                new Card('♦', 'K', 2),
                new Card('♦', 'A', 3)
            ];
            const res = validateMeld(run);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(30);
        });

        it('should score Sets with Jokers as 10 if Rank is 10-value', () => {
            // K, K, JK -> 30
            const set = [
                new Card('♥', 'K', 1),
                new Card('♣', 'K', 2),
                new Card('JK', 'Joker', 3)
            ];
            const res = validateMeld(set);
            expect(res.valid).toBe(true);
            expect(res.type).toBe('set');
            expect(res.points).toBe(30);
        });
        
        it('should score Sets with Jokers as low value if Rank is low', () => {
            // 2, 2, JK -> 6
            const set = [
                new Card('♥', '2', 1),
                new Card('♣', '2', 2),
                new Card('JK', 'Joker', 3)
            ];
            const res = validateMeld(set);
            expect(res.valid).toBe(true);
            expect(res.points).toBe(6);
        });
    });
});
