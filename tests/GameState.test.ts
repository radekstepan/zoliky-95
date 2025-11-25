import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';
import { organizeMeld } from '../src/core/rules';

describe('GameState Rules Integration', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
        game.round = 3; // Advance to action rounds
        game.phase = 'action';
        game.pHand = []; // clear hand for manual setups
    });

    describe('Opening Rules', () => {
        it('should fail opening if points < 36', () => {
            // Pure Run, but low points: A, 2, 3 (6 pts)
            const run = [new Card('♥', 'A', 1), new Card('♥', '2', 2), new Card('♥', '3', 3)];

            game.attemptMeld(run);
            // Now try to end turn (commit melds)
            const res = game.attemptDiscard(999); // ID doesn't matter as we check fail msg first

            // Actually attemptDiscard processes the validation of Opening
            expect(game.hasOpened.human).toBe(false);
            // Since logic is inside attemptDiscard, we need a card to discard to trigger it
            game.pHand.push(new Card('♠', 'K', 999));
            const dRes = game.attemptDiscard(999);

            expect(dRes.success).toBe(false);
            expect(dRes.msg).toContain('36+');
        });

        it('should fail opening if no Pure Run', () => {
            // High points, but using Joker (Impure)
            // K, K, JK (30 pts) + Q, Q, Q (30 pts) = 60 pts.
            const set1 = [new Card('♥', 'K', 1), new Card('♦', 'K', 2), new Card('JK', 'Joker', 3)];
            const set2 = [new Card('♥', 'Q', 4), new Card('♦', 'Q', 5), new Card('♣', 'Q', 6)];

            game.attemptMeld(set1);
            game.attemptMeld(set2);

            game.pHand.push(new Card('♠', 'K', 999));
            const dRes = game.attemptDiscard(999);

            expect(dRes.success).toBe(false);
            expect(dRes.msg).toContain('Pure Run');
        });

        it('should open successfully with Pure Run + 36pts', () => {
            // Pure Run: Q, K, A (30 pts)
            // Set: 2, 2, 2 (6 pts) -> Total 36.
            const run = [new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('♥', 'A', 3)];
            const set = [new Card('♥', '2', 4), new Card('♦', '2', 5), new Card('♣', '2', 6)];

            game.attemptMeld(run);
            game.attemptMeld(set);

            game.pHand.push(new Card('♠', 'K', 999));
            const dRes = game.attemptDiscard(999);

            expect(dRes.success).toBe(true);
            expect(game.hasOpened.human).toBe(true);
        });

        it('should allow adding to existing meld immediately if opening requirements met in same turn', () => {
            // 1. Setup existing meld on table (e.g. from CPU)
            const existingMeld = [new Card('♠', '5', 100), new Card('♠', '6', 101), new Card('♠', '7', 102)];
            game.melds.push(existingMeld);

            // 2. Setup player hand for Opening
            // Pure Run: Q♥, K♥, A♥ (30 pts)
            const openRun = [new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('♥', 'A', 3)];
            // Set: 2♥, 2♦, 2♣ (6 pts) -> Total 36 pts
            const openSet = [new Card('♥', '2', 4), new Card('♦', '2', 5), new Card('♣', '2', 6)];
            
            // Card to add to existing meld (8♠)
            const cardToAdd = new Card('♠', '8', 7);
            
            game.pHand.push(...openRun, ...openSet, cardToAdd);

            // 3. Play Opening Melds
            game.attemptMeld(openRun);
            game.attemptMeld(openSet);
            
            expect(game.hasOpened.human).toBe(false); // Not committed yet
            expect(game.isOpeningConditionMet()).toBe(true); // But condition met

            // 4. Attempt to add to existing meld (Index 0)
            const res = game.addToExistingMeld(0, [cardToAdd]);
            expect(res.success).toBe(true);
            
            // Verify card added
            expect(game.melds[0].length).toBe(4);
            expect(game.melds[0][3].rank).toBe('8');
        });

        it('should revert additions if turn is cancelled', () => {
             // 1. Setup existing meld
             const existingMeld = [new Card('♠', '5', 100), new Card('♠', '6', 101), new Card('♠', '7', 102)];
             game.melds.push(existingMeld);
 
             // 2. Meet opening requirements
             const openRun = [new Card('♥', 'Q', 1), new Card('♥', 'K', 2), new Card('♥', 'A', 3)];
             const openSet = [new Card('♥', '2', 4), new Card('♦', '2', 5), new Card('♣', '2', 6)];
             const cardToAdd = new Card('♠', '8', 7);
             game.pHand.push(...openRun, ...openSet, cardToAdd);
 
             game.attemptMeld(openRun);
             game.attemptMeld(openSet);
             game.addToExistingMeld(0, [cardToAdd]);
 
             expect(game.melds[0].length).toBe(4);
 
             // 3. Cancel
             game.cancelTurnMelds();
 
             // 4. Verify revert
             expect(game.melds[0].length).toBe(3); // Addition removed
             expect(game.melds.length).toBe(1); // Opening melds removed
             expect(game.pHand.some(c => c.id === 7)).toBe(true); // Card back in hand
        });
    });

    describe('Joker Logic', () => {
        it('should require swapped Joker to be used', () => {
            game.hasOpened.human = true;

            // Mock table meld: 4, 5, JK
            const meld = [new Card('♥', '4', 1), new Card('♥', '5', 2), new Card('JK', 'Joker', 3)];
            // Organize the meld first so Joker gets its representation
            const organizedMeld = organizeMeld(meld);
            game.melds.push(organizedMeld);

            // Hand has 6H
            const myCard = new Card('♥', '6', 10);
            game.pHand.push(myCard);

            // Swap
            const sRes = game.attemptJokerSwap(0, 10);
            expect(sRes.success).toBe(true);
            expect(game.swappedJokerIds).toContain(3);

            // Try to discard without using Joker
            game.pHand.push(new Card('♠', '2', 99));
            const dRes = game.attemptDiscard(99);

            expect(dRes.success).toBe(false);
            expect(dRes.msg).toContain('Must meld');
        });
    });

    describe('Jolly Hand', () => {
        it('should allow taking Jolly Hand if conditions met', () => {
            // 12 Cards
            for (let i = 0; i < 12; i++) game.pHand.push(new Card('♥', '2', i));
            game.bottomCard = new Card('♥', 'K', 100);
            game.phase = 'draw';

            const res = game.attemptJollyHand();
            expect(res.success).toBe(true);
            expect(game.isJollyTurn).toBe(true);
            expect(game.pHand.length).toBe(13);
        });

        it('should fail if Jolly Hand is taken but not won', () => {
            // Setup Jolly State
            game.isJollyTurn = true;
            game.pHand = [new Card('♥', '2', 1), new Card('♥', '3', 2)]; // Still have cards

            // Try discard
            const res = game.attemptDiscard(1);
            expect(res.success).toBe(false);
            expect(res.msg).toContain('must meld ALL');
        });
    });

    describe('Discard Pile', () => {
        it('should reshuffle discard into stock if stock empty', () => {
            game.deck.setCards([]); // Empty stock
            game.discardPile = [new Card('♥', '2', 1), new Card('♥', '3', 2)];
            game.phase = 'draw';

            const res = game.drawCard('stock');
            expect(res.success).toBe(true);
            // 1 drawn, 1 remaining in new stock
            // (Actually implementation pops, so last of discard becomes drawn or similar depending on order)
            // Logic: deck set to discard, shuffled. discard cleared. card drawn.
            expect(game.deck.isEmpty()).toBe(false);
            expect(game.discardPile.length).toBe(0);
        });
    });
});
