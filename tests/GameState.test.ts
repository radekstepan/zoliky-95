import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';

describe('GameState Integration', () => {
    let game: GameState;

    beforeEach(() => {
        game = new GameState();
        game.initGame();
    });

    it('should initialize correctly', () => {
        // New rules: Player 1 (Human) gets 13 cards, CPU gets 12.
        expect(game.pHand.length).toBe(13);
        expect(game.cHand.length).toBe(12);
        // Discard pile starts empty (Human must discard 13th card to start)
        expect(game.discardPile.length).toBe(0);
        expect(game.round).toBe(1);
    });

    it('should handle drawing from stock', () => {
        // Human starts with 13 cards in 'action' phase.
        // Must discard first to end turn 1.
        const discardCard = game.pHand[0];
        game.attemptDiscard(discardCard.id);
        
        // CPU Turn runs immediately (mock/fast-forward)
        game.processCpuTurn();
        
        // Now Round 2, Human turn, 'draw' phase.
        expect(game.phase).toBe('draw');
        
        const initialHandSize = game.pHand.length; // Should be 12
        const res = game.drawCard('stock');
        
        expect(res.success).toBe(true);
        expect(game.pHand.length).toBe(initialHandSize + 1); // 13
        expect(game.phase).toBe('action');
    });

    it('should prevent melding before Round 3', () => {
        // Round 1
        const meld = [new Card('♥', 'K', 100), new Card('♠', 'K', 101), new Card('♣', 'K', 102)];
        const res = game.attemptMeld(meld);
        expect(res.success).toBe(false);
        expect(res.msg).toContain('Round 3');
    });

    it('should allow melding at Round 3', () => {
        game.round = 3;
        // Setup phase to action (simulate having drawn)
        game.phase = 'action'; 
        
        const meld = [new Card('♥', 'K', 100), new Card('♠', 'K', 101), new Card('♣', 'K', 102)];
        
        const res = game.attemptMeld(meld);
        expect(res.success).toBe(true);
        expect(game.melds.length).toBe(1);
    });

    it('should enforce opening score logic upon discard', () => {
        game.round = 3;
        game.phase = 'action';

        // Create small meld (Points: 6) - Insufficient for opening
        const smallMeld = [new Card('♥', '2', 100), new Card('♠', '2', 101), new Card('♣', '2', 102)];
        game.attemptMeld(smallMeld); 

        // Try to end turn
        const discardCard = game.pHand[0];
        const res = game.attemptDiscard(discardCard.id);

        expect(res.success).toBe(false);
        // Check for points message first
        expect(res.msg).toContain('36');
    });
    
    it('should track discard pile pickup constraint', () => {
        // Setup: Put a card in discard pile
        game.discardPile.push(new Card('♥', '10', 999));
        game.phase = 'draw'; // ensure drawing phase

        // User draws from discard
        const res = game.drawCard('discard');
        expect(res.success).toBe(true);
        expect(game.drawnFromDiscardId).toBe(999);

        // User tries to discard immediately without melding
        // Need to select a card to discard
        const handCard = game.pHand.find(c => c.id !== 999) || game.pHand[0];
        const resDisc = game.attemptDiscard(handCard.id);
        
        expect(resDisc.success).toBe(false);
        expect(resDisc.msg).toContain('Must meld');
    });
});
