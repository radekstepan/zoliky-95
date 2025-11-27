import { describe, it, expect } from 'vitest';
import { calculateCpuMove } from '../src/core/ai';
import { Card } from '../src/core/Card';
import { organizeMeld } from '../src/core/rules';

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
    });

    describe('Discard Logic (Hard Mode)', () => {
        it('should AVOID discarding a card that helps opponent when opponent has 1 card', () => {
             // Table: 4, 5, 6 of Hearts
             const tableMeld = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('♥', '6', 3)];
             const organized = organizeMeld(tableMeld);
             
             // Hand: 7 of Hearts (Fits!) and King of Spades (Useless)
             // Normally K is high value, so AI might want to keep it? 
             // Actually, usually AI discards K because it is high penalty points.
             // But here, discarding 7H gives opponent the win.
             const sevenH = new Card('♥', '7', 10);
             const kingS = new Card('♠', 'K', 11); // High value, no synergy
             
             const hand = [sevenH, kingS];
             
             // Opponent Hand Size = 1
             const move = calculateCpuMove(hand, true, [organized], 'hard', 1);
             
             // Should discard King, even though it's high points, because 7H fits table.
             expect(move.discardCard?.id).toBe(kingS.id);
        });
        
        it('should discard high value card if no danger', () => {
             const hand = [new Card('♥', '2', 1), new Card('♠', 'K', 2)];
             // Opponent has many cards, no table threats
             const move = calculateCpuMove(hand, true, [], 'hard', 10);
             expect(move.discardCard?.rank).toBe('K');
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
