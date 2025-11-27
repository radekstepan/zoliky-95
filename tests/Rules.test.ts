import { describe, it, expect } from 'vitest';
import { validateMeld, organizeMeld } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Rules Engine (Validation & Organization)', () => {

    describe('Run Logic', () => {
        it('should validate standard Run', () => {
            const run = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('♥', '6', 3)];
            expect(validateMeld(run).valid).toBe(true);
        });

        it('should validate Ace Low Run', () => {
            const run = [new Card('♣', 'A', 1), new Card('♣', '2', 2), new Card('♣', '3', 3)];
            expect(validateMeld(run).valid).toBe(true);
        });

        it('should validate Ace High Run', () => {
            const run = [new Card('♣', 'Q', 1), new Card('♣', 'K', 2), new Card('♣', 'A', 3)];
            expect(validateMeld(run).valid).toBe(true);
        });

        it('should REJECT invalid gaps', () => {
            // 4, 6 (Missing 5) -> Valid if Joker, invalid if pure
            const run = [new Card('♥', '4', 1), new Card('♥', '6', 3)];
            expect(validateMeld(run).valid).toBe(false);
        });

        it('should REJECT duplicate ranks in run', () => {
            const run = [new Card('♥', '4', 1), new Card('♥', '4', 2), new Card('♥', '5', 3)];
            expect(validateMeld(run).valid).toBe(false);
        });
    });

    describe('Set Logic', () => {
        it('should validate Set of 3', () => {
            const set = [new Card('♥', '5', 1), new Card('♦', '5', 2), new Card('♠', '5', 3)];
            expect(validateMeld(set).valid).toBe(true);
        });

        it('should validate Set of 4', () => {
            const set = [
                new Card('♥', '5', 1), new Card('♦', '5', 2), 
                new Card('♠', '5', 3), new Card('♣', '5', 4)
            ];
            expect(validateMeld(set).valid).toBe(true);
        });

        it('should REJECT Set > 4 cards', () => {
             const set = [
                new Card('♥', '5', 1), new Card('♦', '5', 2), 
                new Card('♠', '5', 3), new Card('♣', '5', 4),
                new Card('JK', 'Joker', 5)
            ];
            expect(validateMeld(set).valid).toBe(false);
        });
    });

    describe('Joker Logic & Organization', () => {
        it('should fill internal gap in Run', () => {
            // 4, Joker, 6
            const c1 = new Card('♥', '4', 1);
            const c2 = new Card('♥', '6', 2);
            const jk = new Card('JK', 'Joker', 3);
            
            const res = validateMeld([c1, jk, c2]);
            expect(res.valid).toBe(true);
            
            const org = organizeMeld([c1, jk, c2]);
            const j = org.find(c => c.isJoker)!;
            expect(j.representation).toEqual({ rank: '5', suit: '♥' });
            // Order check: 4, JK, 6
            expect(org[1].isJoker).toBe(true);
        });

        it('should fill end of Run (High)', () => {
            // 4, 5, Joker -> 4, 5, 6
            const c1 = new Card('♥', '4', 1);
            const c2 = new Card('♥', '5', 2);
            const jk = new Card('JK', 'Joker', 3);
            
            const org = organizeMeld([c1, c2, jk]);
            const j = org.find(c => c.isJoker)!;
            expect(j.representation?.rank).toBe('6');
        });

        it('should fill end of Run (Low) if High blocked', () => {
             // A, 2, Joker -> A, 2, 3? No, A is low or high.
             // If A, 2... Joker must be 3.
             // What if Q, K, Joker? Must be A (High).
             // What if K, A(High), Joker? Joker cannot go higher. 
             // Should try Prepend? 
             
             // Case: Q, K, A, Joker -> Valid? No, max 3 cards? No runs can be long.
             // But K-A is end of sequence. 
             // The logic in organizeMeld attempts to append. If fails, prepends.
             
             const q = new Card('♥', 'Q', 1);
             const k = new Card('♥', 'K', 2);
             const a = new Card('♥', 'A', 3);
             const jk = new Card('JK', 'Joker', 4);
             
             const meld = [q, k, a, jk];
             // Validate first: Q,K,A is valid. Joker can be J? 
             // validateMeld logic checks ends.
             
             const org = organizeMeld(meld);
             const j = org.find(c => c.isJoker)!;
             // Should become J
             expect(j.representation?.rank).toBe('J');
             expect(org[0].isJoker).toBe(true); // J at start
        });

        it('should reset dirty Joker representation on conflict', () => {
             const c1 = new Card('♥', '4', 1);
             const c2 = new Card('♥', '5', 2);
             const jk = new Card('JK', 'Joker', 3);
             jk.representation = { rank: '5', suit: '♥' }; // Conflict with Real 5
             
             const org = organizeMeld([c1, c2, jk]);
             const j = org.find(c => c.isJoker)!;
             // Should recalculate to 6 (or 3)
             expect(j.representation?.rank).not.toBe('5');
             expect(['3', '6']).toContain(j.representation?.rank);
        });

        it('should handle multiple Jokers in Run', () => {
             // 4, JK, JK, 7 -> Invalid
             // 4, JK, 6, JK, 8 -> Valid
             const c1 = new Card('♥', '4', 1);
             const jk1 = new Card('JK', 'Joker', 2);
             const c2 = new Card('♥', '6', 3);
             const jk2 = new Card('JK', 'Joker', 4);
             const c3 = new Card('♥', '8', 5);
             
             const meld = [c1, jk1, c2, jk2, c3];
             expect(validateMeld(meld).valid).toBe(true);
             
             const org = organizeMeld(meld);
             const jokers = org.filter(c => c.isJoker);
             expect(jokers.length).toBe(2);
             expect(jokers[0].representation?.rank).toBe('5');
             expect(jokers[1].representation?.rank).toBe('7');
        });
    });
});
