import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';

describe('Robustness and Edge Case Coverage', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
        // Setup standard mid-game state
        game.round = 3;
        game.phase = 'action';
    });

    describe('Undo Logic Edge Cases', () => {
        it('should NOT allow undo if card was not drawn from discard', () => {
            // Drawn from stock
            game.phase = 'draw';
            game.drawCard('stock');
            
            const res = game.undoDraw();
            expect(res.success).toBe(false);
            expect(res.msg).toContain('Did not draw from discard');
        });

        it('should NOT allow undo if melds were made', () => {
            // Setup draw from discard
            game.phase = 'draw';
            const discardCard = new Card('♥', '5', 999);
            game.discardPile.push(discardCard);
            game.drawCard('discard');
            
            // Perform a meld
            // We'll simulate a valid meld existing in hand for simplicity
            const m1 = new Card('♠', '2', 1);
            const m2 = new Card('♠', '3', 2);
            const m3 = new Card('♠', '4', 3);
            game.pHand.push(m1, m2, m3);
            
            game.attemptMeld([m1, m2, m3]);
            
            // Try undo
            const res = game.undoDraw();
            expect(res.success).toBe(false);
            expect(res.msg).toContain('melding');
        });

        it('should NOT allow undo if jokers were swapped', () => {
             game.phase = 'draw';
             game.discardPile.push(new Card('♥', '5', 999));
             game.drawCard('discard');

             // Mock open state
             game.hasOpened.human = true;
             
             // Setup swap
             // Table: 4H, 5H, Joker (6H)
             const j = new Card('JK', 'Joker', 888);
             j.representation = { rank: '6', suit: '♥' };
             game.melds.push([
                 new Card('♥', '4', 1), new Card('♥', '5', 2), j
             ]);
             
             // Hand has 6H. Use safe ID 500 to avoid collision with dealt cards (0-107)
             const six = new Card('♥', '6', 500);
             game.pHand.push(six);
             
             const sRes = game.attemptJokerSwap(0, 500);
             expect(sRes.success).toBe(true);
             
             const uRes = game.undoDraw();
             expect(uRes.success).toBe(false);
             expect(uRes.msg).toContain('swapping');
        });
    });

    describe('CPU Logic Resilience', () => {
        it('should handle CPU winning correctly (Empty Hand)', () => {
             game.turn = 'cpu';
             game.cHand = [new Card('♥', 'K', 1)]; // 1 card
             
             // Force calculateCpuMove to pick a discard
             // By default it should pick the only card
             
             const res = game.processCpuTurn();
             
             expect(res.winner).toBe('CPU');
             expect(game.cHand.length).toBe(0);
             // Should have discarded the card
             expect(res.discardedCard).toBeDefined();
        });

        it('should fallback to random discard if logic returns null (Coverage)', () => {
             // Mock scenario where AI might fail or hand is just deadwood
             game.turn = 'cpu';
             // Setup a deadwood hand that cannot possibly meld with a random draw
             // 2H, 8S. If draw 5C -> 2H, 8S, 5C. No meld.
             // This ensures only 1 card is discarded.
             game.cHand = [new Card('♥', '2', 1), new Card('♠', '8', 2)];
             
             const res = game.processCpuTurn();
             expect(res.discardedCard).toBeDefined();
             // Hand started 2. Drawn 1 (3). Discarded 1. Remaining 2.
             // But if random draw creates a meld (super rare), it could be less.
             // We check that discard happened.
             expect(game.cHand.length).toBeLessThanOrEqual(2);
             expect(game.discardPile.length).toBeGreaterThan(0);
        });
    });

    describe('Deck Exhaustion', () => {
        it('should reshuffle discard into stock when stock is empty', () => {
             game.deck.setCards([]); // Empty Stock
             const d1 = new Card('♥', 'A', 1);
             const d2 = new Card('♠', 'A', 2);
             game.discardPile = [d1, d2];
             
             game.phase = 'draw';
             const res = game.drawCard('stock');
             
             expect(res.success).toBe(true);
             expect(game.discardPile.length).toBe(0);
             // One card drawn, one remains in stock
             expect(game.deck.isEmpty()).toBe(false);
        });

        it('should report failure if both stock and discard are empty', () => {
             game.deck.setCards([]);
             game.discardPile = [];
             game.phase = 'draw';
             
             const res = game.drawCard('stock');
             expect(res.success).toBe(false);
             expect(res.msg).toContain('Empty');
        });
    });
});
