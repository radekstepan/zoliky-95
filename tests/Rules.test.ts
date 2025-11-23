import { describe, it, expect } from 'vitest';
import { validateMeld } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Rules Unit Tests', () => {
    
    describe('Run Validation', () => {
        it('should allow valid run with Joker', () => {
            // 4, 5, JK (6)
            const cards = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('JK', 'Joker', 3)];
            expect(validateMeld(cards).valid).toBe(true);
        });

        it('should REJECT adjacent Jokers (Gap > 1)', () => {
            // 4, gap(5), gap(6), 7 -> Needs 2 Jokers adjacent
            const cards = [new Card('♥', '4', 1), new Card('♥', '7', 2), new Card('JK', 'Joker', 3), new Card('JK', 'Joker', 4)];
            expect(validateMeld(cards).valid).toBe(false);
        });

        it('should REJECT adjacent Jokers (Ends)', () => {
            // 4, 5. Two Jokers remaining. 
            // Can put 1 at start, 1 at end? Yes: JK, 4, 5, JK.
            // Wait, logic handles High End first.
            // 4, 5 -> JK(3), 4, 5, JK(6)? No logic fills Right then Left.
            // 4, 5 -> 4, 5, JK(6). One left. -> JK(3), 4, 5, JK(6).
            // Should be valid.
            const cards = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('JK', 'Joker', 3), new Card('JK', 'Joker', 4)];
            expect(validateMeld(cards).valid).toBe(true);
            
            // But what if we have 3 Jokers? 4, 5. 
            // JK, 4, 5, JK ... one more needs to be adjacent to one of the jokers.
            const cards2 = [...cards, new Card('JK', 'Joker', 5)];
            expect(validateMeld(cards2).valid).toBe(false);
        });

        it('should REJECT runs wrapping around corner', () => {
            // K, A, 2
            const cards = [new Card('♥', 'K', 1), new Card('♥', 'A', 2), new Card('♥', '2', 3)];
            expect(validateMeld(cards).valid).toBe(false);
        });
    });
});
