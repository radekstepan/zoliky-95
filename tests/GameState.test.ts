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
        expect(game.pHand.length).toBe(13);
        expect(game.cHand.length).toBe(12);
        expect(game.discardPile.length).toBe(0);
        expect(game.round).toBe(1);
    });

    it('should prevent drawing from discard before Round 3', () => {
        // Round 1
        game.discardPile.push(new Card('♥', '5', 999));
        game.phase = 'draw';
        const res = game.drawCard('discard');
        expect(res.success).toBe(false);
        expect(res.msg).toContain('Round 3');
    });

    it('should allow drawing from discard at Round 3', () => {
        game.round = 3;
        game.discardPile.push(new Card('♥', '5', 999));
        game.phase = 'draw';
        const res = game.drawCard('discard');
        expect(res.success).toBe(true);
    });

    it('should allow undoing a discard draw', () => {
        game.round = 3;
        const testCard = new Card('♥', '5', 999);
        game.discardPile.push(testCard);
        game.phase = 'draw';
        
        // Draw
        game.drawCard('discard');
        expect(game.pHand.some(c => c.id === 999)).toBe(true);
        expect(game.discardPile.length).toBe(0);
        expect(game.drawnFromDiscardId).toBe(999);
        
        // Undo
        const undoRes = game.undoDraw();
        expect(undoRes.success).toBe(true);
        expect(game.pHand.some(c => c.id === 999)).toBe(false);
        expect(game.discardPile.length).toBe(1);
        expect(game.discardPile[0].id).toBe(999);
        expect(game.phase).toBe('draw');
    });

    it('should NOT allow undoing after melding', () => {
        game.round = 3;
        const testCard = new Card('♥', '5', 999);
        game.discardPile.push(testCard);
        game.phase = 'draw';
        
        game.drawCard('discard');
        
        // Mock a meld event (adding to turnMelds)
        game.turnMelds.push(0); 
        
        const undoRes = game.undoDraw();
        expect(undoRes.success).toBe(false);
        expect(undoRes.msg).toContain('after melding');
    });
});
