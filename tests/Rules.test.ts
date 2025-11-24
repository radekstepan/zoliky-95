import { describe, it, expect } from 'vitest';
import { validateMeld, organizeMeld } from '../src/core/rules';
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

    describe('Joker Position Locking', () => {
        it('should preserve Joker representation when organizing existing meld', () => {
            // Create a run: J, Q, Joker
            const j = new Card('♥', 'J', 1);
            const q = new Card('♥', 'Q', 2);
            const joker = new Card('JK', 'Joker', 3);

            const cards = [j, q, joker];

            // First organization assigns representation
            const organized1 = organizeMeld(cards);
            expect(organized1[2].isJoker).toBe(true);
            expect(organized1[2].representation).toEqual({ rank: 'K', suit: '♥' });

            // Second organization should preserve it
            const organized2 = organizeMeld(organized1);
            expect(organized2[2].isJoker).toBe(true);
            expect(organized2[2].representation).toEqual({ rank: 'K', suit: '♥' });
        });

        it('should maintain Joker position when adding cards to meld', () => {
            // Create run: J, Q, Joker(K)
            const j = new Card('♥', 'J', 1);
            const q = new Card('♥', 'Q', 2);
            const joker = new Card('JK', 'Joker', 3);

            const meld = organizeMeld([j, q, joker]);

            // The Joker should represent K
            const jokerInMeld = meld.find(c => c.isJoker)!;
            expect(jokerInMeld.representation).toEqual({ rank: 'K', suit: '♥' });

            // Now add A to the meld
            const ace = new Card('♥', 'A', 4);
            const expandedMeld = organizeMeld([...meld, ace]);

            // Joker should still be at position representing K
            const jokerAfter = expandedMeld.find(c => c.isJoker)!;
            expect(jokerAfter.representation).toEqual({ rank: 'K', suit: '♥' });

            // The meld should be: J, Q, Joker(K), A
            expect(expandedMeld.length).toBe(4);
            expect(expandedMeld[0].rank).toBe('J');
            expect(expandedMeld[1].rank).toBe('Q');
            expect(expandedMeld[2].isJoker).toBe(true);
            expect(expandedMeld[3].rank).toBe('A');
        });

        it('should assign representations to new Jokers while preserving existing ones', () => {
            // Start with: 4, Joker1(5), 6
            const four = new Card('♥', '4', 1);
            const joker1 = new Card('JK', 'Joker', 2);
            const six = new Card('♥', '6', 3);

            const meld1 = organizeMeld([four, joker1, six]);
            expect(meld1[1].representation).toEqual({ rank: '5', suit: '♥' });

            // Now add Joker2 and 3
            const joker2 = new Card('JK', 'Joker', 4);
            const three = new Card('♥', '3', 5);

            const meld2 = organizeMeld([...meld1, joker2, three]);

            // Joker1 should still be 5
            const j1 = meld2.find(c => c.id === 2)!;
            expect(j1.representation).toEqual({ rank: '5', suit: '♥' });

            // Joker2 should be assigned to fill a gap (either 2 or 7)
            const j2 = meld2.find(c => c.id === 4)!;
            expect(j2.representation).toBeDefined();
        });

        it('should preserve Joker suits in sets', () => {
            // Create a set: J♥, J♦, Joker(J♣)
            const jh = new Card('♥', 'J', 1);
            const jd = new Card('♦', 'J', 2);
            const joker = new Card('JK', 'Joker', 3);

            const set1 = organizeMeld([jh, jd, joker]);
            const jokerInSet = set1.find(c => c.isJoker)!;
            const originalSuit = jokerInSet.representation!.suit;

            // Reorganize
            const set2 = organizeMeld(set1);
            const jokerAfter = set2.find(c => c.isJoker)!;

            // Suit should be preserved
            expect(jokerAfter.representation!.suit).toBe(originalSuit);
            expect(jokerAfter.representation!.rank).toBe('J');
        });
    });
});
