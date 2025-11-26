import { describe, it, expect } from 'vitest';
import { organizeMeld, validateMeld } from '../src/core/rules';
import { Card } from '../src/core/Card';

describe('Bug Reproduction - Joker Undefined', () => {
    it('should correctly organize K, A, Joker (Run) without creating undefined rank', () => {
        // Run: K, A, Joker. 
        // Logic: Joker should become Q (Left side), because Right side (A+1) is impossible.
        const k = new Card('♥', 'K', 1);
        const a = new Card('♥', 'A', 2);
        const joker = new Card('JK', 'Joker', 3);

        const meld = [k, a, joker];
        
        // Validation should pass (Q, K, A)
        expect(validateMeld(meld).valid).toBe(true);

        const organized = organizeMeld(meld);
        
        // Expected: Joker is Q (at start)
        // Or at least, Joker representation should NOT be undefined
        const j = organized.find(c => c.isJoker)!;
        
        expect(j.representation).toBeDefined();
        expect(j.representation!.rank).toBeDefined();
        expect(j.representation!.rank).not.toBe('undefined');
        expect(j.representation!.rank).toBe('Q');
        
        // Ensure visual correctness logic
        const rep = j.representation!;
        const display = `<span>${rep.rank}</span>`;
        expect(display).not.toContain('undefined');
    });
});
