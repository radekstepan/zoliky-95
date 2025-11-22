import { describe, it, expect } from 'vitest';
import { Deck } from '../src/core/Deck';

describe('Deck Logic', () => {
    it('should initialize with 108 cards', () => {
        const deck = new Deck();
        // 2 decks: 52 * 2 = 104 + 4 jokers = 108
        // Logic inside deck might vary slightly on implementation access, 
        // but we can test by drawing all.
        let count = 0;
        while(deck.draw()) {
            count++;
        }
        expect(count).toBe(108);
    });

    it('should handle empty deck', () => {
        const deck = new Deck();
        while(deck.draw()) {} // empty it
        expect(deck.draw()).toBeUndefined();
        expect(deck.isEmpty()).toBe(true);
    });
});
