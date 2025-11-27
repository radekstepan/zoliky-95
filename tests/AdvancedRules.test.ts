import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';
import { validateMeld } from '../src/core/rules';

describe('Advanced Rules & Strict Compliance', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
        game.round = 3;
        game.phase = 'action';
    });

    describe('Strict Phase State Machine', () => {
        it('should prevent drawing when in action phase', () => {
             game.phase = 'action';
             const res = game.drawCard('stock');
             expect(res.success).toBe(false);
             expect(game.pHand.length).toBe(13); // No change
        });

        it('should prevent melding when in draw phase', () => {
             game.phase = 'draw';
             // Setup valid meld in hand
             const m = [new Card('♥', '2', 1), new Card('♥', '3', 2), new Card('♥', '4', 3)];
             game.pHand.push(...m);
             
             const res = game.attemptMeld(m);
             expect(res.success).toBe(false);
        });

        it('should prevent discard when in draw phase', () => {
             game.phase = 'draw';
             const card = new Card('♥', 'K', 1);
             game.pHand.push(card);
             
             const res = game.attemptDiscard(card.id);
             expect(res.success).toBe(false);
        });
    });

    describe('Discard Pile Rules', () => {
        it('should enforce "Must Meld" rule when drawing from discard', () => {
            // Setup
            game.phase = 'draw';
            game.discardPile.push(new Card('♥', '10', 99)); // The discard
            
            // Draw it
            const res = game.drawCard('discard');
            expect(res.success).toBe(true);
            const drawnId = res.card!.id;
            
            // Try to discard a different card without using the drawn one
            // We need to have opened or simulate opening to get to discard
            game.hasOpened.human = true;
            game.pHand.push(new Card('♠', 'K', 200)); 
            
            const dRes = game.attemptDiscard(200);
            expect(dRes.success).toBe(false);
            expect(dRes.msg).toContain('Must meld');
            
            // Now "use" it in a meld
            // We'll just fake it by clearing the requirement to test logic flow
            // Actually, let's do a real meld
            const m1 = new Card('♦', '10', 101);
            const m2 = new Card('♣', '10', 102);
            // Drawn card is 10H
            
            game.pHand.push(m1, m2);
            // We need to select the drawn card + m1 + m2
            // Note: In unit test we pass array, UI handles selection.
            const drawnCard = game.pHand.find(c => c.id === drawnId)!;
            
            game.attemptMeld([drawnCard, m1, m2]);
            
            // Now discard should work
            const dRes2 = game.attemptDiscard(200);
            expect(dRes2.success).toBe(true);
        });
    });

    describe('Invalid Meld Topologies', () => {
        it('should REJECT wrapping Aces (K-A-2)', () => {
            const meld = [
                new Card('♥', 'K', 1),
                new Card('♥', 'A', 2),
                new Card('♥', '2', 3)
            ];
            const res = validateMeld(meld);
            expect(res.valid).toBe(false);
        });

        it('should REJECT Sets with duplicate suits', () => {
             const meld = [
                 new Card('♥', '5', 1),
                 new Card('♥', '5', 2), // Duplicate Heart
                 new Card('♠', '5', 3)
             ];
             const res = validateMeld(meld);
             expect(res.valid).toBe(false);
        });

        it('should REJECT Runs with duplicate ranks', () => {
             const meld = [
                 new Card('♥', '5', 1),
                 new Card('♥', '5', 2), 
                 new Card('♥', '6', 3)
             ];
             const res = validateMeld(meld);
             expect(res.valid).toBe(false);
        });
        
        it('should ALLOW Runs with Jokers at ends', () => {
            // 4, 5, JK
            const meld = [
                new Card('♥', '4', 1),
                new Card('♥', '5', 2),
                new Card('JK', 'Joker', 3)
            ];
            const res = validateMeld(meld);
            expect(res.valid).toBe(true);
        });

        it('should REJECT Runs with 3 Jokers if adjacent at ends', () => {
            // 4, 5 ... JK, JK, JK?
            // Max gap filling is 1 joker between cards. 
            // 2 cards = 1 gap. 3 jokers. 
            // 4, JK, 6 ... 2 jokers left. 
            // One at left (JK, 4, JK, 6), one at right (JK, 4, JK, 6, JK).
            // This is VALID actually: JK(3), 4, JK(5), 6, JK(7). No adjacencies!
            
            const meld = [
                new Card('♥', '4', 1),
                new Card('♥', '6', 2), // Gap
                new Card('JK', 'Joker', 3),
                new Card('JK', 'Joker', 4),
                new Card('JK', 'Joker', 5)
            ];
            // Valid sequence: 3(JK), 4, 5(JK), 6, 7(JK)
            const res = validateMeld(meld);
            expect(res.valid).toBe(true); 
            
            // Now try 3 jokers with NO gap
            // 4, 5. Jokers: 3.
            // 4, 5 ... Right(JK), Left(JK). 1 Left. 
            // End result: JK, 4, 5, JK. One joker remaining. Must go next to another joker.
            // Invalid.
            const meld2 = [
                new Card('♥', '4', 10),
                new Card('♥', '5', 11),
                new Card('JK', 'Joker', 12),
                new Card('JK', 'Joker', 13),
                new Card('JK', 'Joker', 14)
            ];
            const res2 = validateMeld(meld2);
            expect(res2.valid).toBe(false);
        });
    });

    describe('Hand Manipulation Bounds', () => {
        it('should ignore reorder requests out of bounds', () => {
            game.pHand = [new Card('♥', 'A', 1), new Card('♥', '2', 2)];
            
            // Valid reorder
            game.reorderHand(0, 1);
            expect(game.pHand[0].rank).toBe('2');
            
            // Invalid
            game.reorderHand(0, 50); // To out of bounds
            // Should be no-op or handle gracefully.
            // Implementation uses splice, if toIndex is huge, splice appends?
            // Let's check implementation: this.pHand.splice(toIndex, 0, card);
            // Splice with large index appends. So 50 -> end of array.
            
            // What about fromIndex out of bounds?
            const len = game.pHand.length;
            game.reorderHand(50, 0); 
            expect(game.pHand.length).toBe(len); // Should not change length
        });
    });
    
    describe('Opening Point Calculation', () => {
        it('should calculate points exactly for mixed Ace values', () => {
             // Low Run: A, 2, 3 (1+2+3 = 6 pts)
             // High Run: Q, K, A (10+10+10 = 30 pts)
             // Total 36.
             const low = [new Card('♥', 'A', 1), new Card('♥', '2', 2), new Card('♥', '3', 3)];
             const high = [new Card('♠', 'Q', 4), new Card('♠', 'K', 5), new Card('♠', 'A', 6)];
             
             game.pHand.push(...low, ...high);
             
             game.attemptMeld(low);
             game.attemptMeld(high);
             
             // Pure run check? Both are pure.
             // Points check? 36.
             // Should allow open.
             game.pHand.push(new Card('♣', 'K', 99));
             const res = game.attemptDiscard(99);
             
             expect(res.success).toBe(true);
             expect(game.hasOpened.human).toBe(true);
        });
    });
});
