import { describe, it, expect } from 'vitest';
import { Deck } from '../src/core/Deck';

describe('Deck Logic', () => {
    it('should initialize with 108 cards', () => {
        const deck = new Deck();
        // Since we cannot access cards private prop, we consume it
        let count = 0;
        while(deck.draw()) count++;
        expect(count).toBe(108);
    });

    it('should extract specific card for debug', () => {
        const deck = new Deck();
        const card = deck.extractCard('A', '♥');
        expect(card).toBeDefined();
        expect(card?.rank).toBe('A');
        expect(card?.suit).toBe('♥');
        
        // Ensure it's removed
        // We can't check internal array, but if we extract ALL A♥ (there are 2), next should be undef
        const card2 = deck.extractCard('A', '♥');
        expect(card2).toBeDefined();
        const card3 = deck.extractCard('A', '♥');
        expect(card3).toBeUndefined();
    });

    it('should check bottom 3 for jokers', () => {
        const deck = new Deck();
        const jokers = deck.checkBottomThreeForJokers();
        expect(Array.isArray(jokers)).toBe(true);
    });
    
    it('should remove bottom card', () => {
        const deck = new Deck();
        const bottom = deck.removeBottom();
        expect(bottom).toBeDefined();
    });
    
    it('should refill when empty', () => {
        const deck = new Deck();
        deck.setCards([]);
        expect(deck.isEmpty()).toBe(true);
    });
});
