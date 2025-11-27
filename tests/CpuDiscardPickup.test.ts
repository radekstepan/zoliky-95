import { describe, it, expect } from 'vitest';
import { GameState } from '../src/GameState';
import { Card } from '../src/core/Card';
import { processCpuTurn } from '../src/game/CpuActions';

describe('CPU Discard Pickup Logic', () => {
    it('should pick up Joker from discard if it helps (e.g. low hand count)', () => {
        const game = new GameState();
        game.initGame();

        // Setup CPU Hand: 2 cards (e.g. 2 of Hearts, 3 of Hearts)
        game.cHand = [
            new Card('♥', '2', 101),
            new Card('♥', '3', 102)
        ];

        // Setup Discard Pile: Top card is Joker
        const joker = new Card('JK', 'Joker', 999);
        game.discardPile = [joker];

        // Ensure it's CPU turn and Draw Phase
        game.turn = 'cpu';
        game.phase = 'draw';
        game.round = 3; // Ensure round is high enough for AI logic if needed
        game.hasOpened.cpu = true; // Assume opened to allow easy melding if that's a constraint, 
        // though picking up Joker is good regardless.
        // Actually, if not opened, picking up Joker helps open.

        // Execute CPU Turn
        const result = processCpuTurn(game);

        // Expectation: CPU should have drawn from discard
        expect(result.drawSource).toBe('discard');

        // Verify Joker is in hand (or played)
        // If played immediately, it might be in meldsPlayed.
        // If kept, it's in cHand.
        const jokerInHand = game.cHand.some(c => c.id === 999);
        const jokerPlayed = result.meldsPlayed?.some(m => m.some(c => c.id === 999));

        expect(jokerInHand || jokerPlayed).toBe(true);
    });
});
